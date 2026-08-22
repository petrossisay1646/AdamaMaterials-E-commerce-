const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');

class SocketService {
  constructor() {
    this.io = null;
    this.lastDbWriteMap = new Map(); // Throttles MongoDB writes per delivery
  }

  init(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: [
          process.env.CLIENT_URL || 'http://localhost:5173',
          'http://localhost:5173',
          'http://localhost:3000',
        ],
        credentials: true,
      },
      pingTimeout: 30000,
    });

    // Socket Authentication Middleware
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.split(' ')[1] ||
          socket.handshake.query?.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user || !user.isActive) {
          return next(new Error('User not found or suspended'));
        }

        socket.user = user;
        next();
      } catch (err) {
        return next(new Error('Invalid or expired socket token'));
      }
    });

    this.io.on('connection', (socket) => {
      // 1. Join Delivery Tracking Room
      socket.on('join_delivery_tracking', async ({ deliveryId, orderId }) => {
        try {
          let delivery = null;
          if (deliveryId) {
            delivery = await Delivery.findById(deliveryId).populate('order');
          } else if (orderId) {
            delivery = await Delivery.findOne({ order: orderId }).populate('order');
          }

          if (!delivery) {
            return socket.emit('error_message', { message: 'Delivery record not found' });
          }

          const order = delivery.order;
          const isBuyer = order && order.buyer.toString() === socket.user._id.toString();
          const isAssignedCourier = delivery.assignedStaff && delivery.assignedStaff.toString() === socket.user._id.toString();
          const isAdminOrStaff = ['ADMIN', 'STAFF'].includes(socket.user.role);

          // Privacy Authorization Guard
          if (!isBuyer && !isAssignedCourier && !isAdminOrStaff) {
            return socket.emit('error_message', { message: 'Unauthorized to track this delivery' });
          }

          const room = `delivery:${delivery._id}`;
          socket.join(room);

          // Send initial tracking state
          socket.emit('delivery_state', {
            deliveryId: delivery._id,
            status: delivery.status,
            trackingActive: ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(delivery.status),
            currentLocation: delivery.currentLocation || null,
            assignedStaff: delivery.assignedStaff,
          });
        } catch (err) {
          socket.emit('error_message', { message: 'Failed to join tracking session' });
        }
      });

      // 2. Courier Emits Live GPS Location Updates
      socket.on('update_courier_gps', async ({ deliveryId, latitude, longitude }) => {
        try {
          const numLat = Number(latitude);
          const numLng = Number(longitude);

          if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
            return;
          }

          const delivery = await Delivery.findById(deliveryId);
          if (!delivery) return;

          // Only assigned courier or Admin can send GPS coordinates
          const isAssignedCourier = delivery.assignedStaff && delivery.assignedStaff.toString() === socket.user._id.toString();
          const isAdmin = socket.user.role === 'ADMIN';

          if (!isAssignedCourier && !isAdmin) {
            return socket.emit('error_message', { message: 'Only the assigned courier can broadcast GPS updates' });
          }

          // Privacy Check: Only track when delivery is actively underway
          if (!['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(delivery.status)) {
            return;
          }

          const now = new Date();
          const locationData = {
            deliveryId: delivery._id,
            latitude: numLat,
            longitude: numLng,
            updatedAt: now.toISOString(),
          };

          // 1. Instant real-time broadcast to all authorized listeners in room
          this.io.to(`delivery:${delivery._id}`).emit('courier_location_update', locationData);

          // 2. Throttled Database write (at most once every 10 seconds per delivery)
          const lastWrite = this.lastDbWriteMap.get(delivery._id.toString()) || 0;
          const writeIntervalMs = 10000;

          if (Date.now() - lastWrite > writeIntervalMs) {
            this.lastDbWriteMap.set(delivery._id.toString(), Date.now());
            delivery.currentLocation = {
              latitude: numLat,
              longitude: numLng,
              updatedAt: now,
            };
            delivery.trackingActive = true;
            await delivery.save();
          }
        } catch (err) {
          console.error('[Socket GPS Update Error]:', err.message);
        }
      });

      // 3. Leave Room
      socket.on('leave_delivery_tracking', ({ deliveryId }) => {
        if (deliveryId) {
          socket.leave(`delivery:${deliveryId}`);
        }
      });

      socket.on('disconnect', () => {});
    });

    return this.io;
  }

  // Helper to notify a delivery room of status changes
  notifyStatusChange(deliveryId, newStatus) {
    if (this.io && deliveryId) {
      this.io.to(`delivery:${deliveryId}`).emit('delivery_status_changed', {
        deliveryId,
        status: newStatus,
        trackingActive: ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(newStatus),
      });
    }
  }
}

module.exports = new SocketService();