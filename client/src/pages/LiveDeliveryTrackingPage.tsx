import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  MapPin,
  Navigation,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  Phone,
  User,
} from 'lucide-react';

interface OrderInfo {
  _id: string;
  trackingNumber: string;
  deliveryStatus: string;
  orderStatus: string;
  deliveryAddress: {
    streetAddress: string;
    subCity: string;
    city: string;
    phoneNumber: string;
    latitude?: number;
    longitude?: number;
  };
  buyer?: { name: string; email: string };
}

interface CourierLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Package className="w-5 h-5 text-slate-400" />,
  ASSIGNED: <Truck className="w-5 h-5 text-amber-500" />,
  OUT_FOR_DELIVERY: <Truck className="w-5 h-5 text-blue-500" />,
  DELIVERED: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  FAILED: <AlertCircle className="w-5 h-5 text-rose-500" />,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-slate-600 bg-slate-100',
  ASSIGNED: 'text-amber-700 bg-amber-100',
  OUT_FOR_DELIVERY: 'text-blue-700 bg-blue-100',
  DELIVERED: 'text-emerald-700 bg-emerald-100',
  FAILED: 'text-rose-700 bg-rose-100',
};

const LiveDeliveryTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [courierLocation, setCourierLocation] = useState<CourierLocation | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string>('PENDING');
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const courierMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);

  // Fetch Order Details
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      try {
        const res = await api.get(`/orders/${orderId}`);
        if (res.data.success) {
          setOrder(res.data.order);
          setDeliveryStatus(res.data.order.deliveryStatus || 'PENDING');
        }
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Failed to load order details.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (loading || !order) return;

    let isMounted = true;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) mapInstanceRef.current.remove();

      const defaultCenter: [number, number] =
        order.deliveryAddress?.latitude && order.deliveryAddress?.longitude
          ? [order.deliveryAddress.latitude, order.deliveryAddress.longitude]
          : [8.5400, 39.2700];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Destination marker
      if (order.deliveryAddress?.latitude && order.deliveryAddress?.longitude) {
        const destIcon = L.divIcon({
          className: 'dest-pin',
          html: `
            <div style="background: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16,185,129,0.4); border: 2.5px solid white;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        destinationMarkerRef.current = L.marker(
          [order.deliveryAddress.latitude, order.deliveryAddress.longitude],
          { icon: destIcon }
        )
          .bindTooltip(`📦 Delivery: ${order.deliveryAddress.streetAddress}`, { permanent: false })
          .addTo(map);
      }

      mapInstanceRef.current = map;
    };

    setTimeout(initMap, 200);

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, order]);

  // Update courier marker when location changes
  const updateCourierMarker = async (lat: number, lng: number) => {
    const L = (await import('leaflet')).default;
    if (!mapInstanceRef.current) return;

    const courierIcon = L.divIcon({
      className: 'courier-live-pin',
      html: `
        <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 8px rgba(37,99,235,0.2), 0 4px 14px rgba(37,99,235,0.5); border: 2.5px solid white; animation: pulse 2s infinite;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="10" x="1" y="9" rx="2" ry="2"></rect><path d="M17 9H1"></path><path d="M1 13h7"></path><path d="M19 12V7a2 2 0 0 0-2-2H5"></path><path d="m21 12-5-5-5 5"></path><circle cx="6" cy="19" r="2"></circle><circle cx="18" cy="19" r="2"></circle></svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (courierMarkerRef.current) {
      courierMarkerRef.current.setLatLng([lat, lng]);
    } else {
      courierMarkerRef.current = L.marker([lat, lng], { icon: courierIcon })
        .bindTooltip('🚚 Courier (Live GPS)', { permanent: false })
        .addTo(mapInstanceRef.current);
    }

    mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.8 });
  };

  // Connect Socket.IO for live tracking
  useEffect(() => {
    if (!orderId || !user || loading) return;

    const isActiveDelivery = ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(deliveryStatus);
    if (!isActiveDelivery) return;

    let socket: any = null;

    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client');

        // Retrieve auth token for socket authentication
        const authRes = await api.post('/auth/refresh').catch(() => null);
        const token = authRes?.data?.accessToken || '';

        socket = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000', {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
          setSocketConnected(true);
          socket.emit('join_delivery_tracking', { orderId });
        });

        socket.on('delivery_state', (data: any) => {
          if (data.currentLocation) {
            const { latitude, longitude, updatedAt } = data.currentLocation;
            setCourierLocation({ latitude, longitude, updatedAt });
            updateCourierMarker(latitude, longitude);
            setLastUpdated(new Date(updatedAt));
          }
          setDeliveryStatus(data.status);
        });

        socket.on('courier_location_update', (data: any) => {
          const { latitude, longitude, updatedAt } = data;
          setCourierLocation({ latitude, longitude, updatedAt: updatedAt || new Date().toISOString() });
          updateCourierMarker(latitude, longitude);
          setLastUpdated(new Date(updatedAt || Date.now()));
        });

        socket.on('delivery_status_changed', (data: any) => {
          setDeliveryStatus(data.status);
          if (data.status === 'DELIVERED') {
            showToast('🎉 Your order has been delivered!', 'success');
          }
        });

        socket.on('disconnect', () => {
          setSocketConnected(false);
        });

        socket.on('error_message', (data: any) => {
          showToast(data.message || 'Tracking connection error.', 'error');
        });
      } catch (err) {
        console.error('Socket connection failed:', err);
      }
    };

    connectSocket();

    return () => {
      if (socket) {
        socket.emit('leave_delivery_tracking', { orderId });
        socket.disconnect();
      }
    };
  }, [orderId, user, loading, deliveryStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading delivery tracking...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Order Not Found</h2>
          <p className="text-sm text-slate-500">This order does not exist or you do not have access to it.</p>
          <button
            onClick={() => navigate('/buyer-dashboard')}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isTrackingActive = ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(deliveryStatus);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-black text-white">Live Delivery Tracking</h1>
              <p className="text-xs text-slate-400">Order: {order.trackingNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isTrackingActive ? (
              <span
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  socketConnected
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
                />
                {socketConnected ? 'Live GPS Connected' : 'Connecting GPS...'}
              </span>
            ) : (
              <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${STATUS_COLORS[deliveryStatus] || 'text-slate-600 bg-slate-100'}`}>
                {deliveryStatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Order Status & Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Delivery Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">Delivery Status</h2>
            </div>
            <div className="p-5">
              {/* Progress Steps */}
              {['PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'].map((step, idx) => {
                const isCompleted =
                  ['PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'].indexOf(deliveryStatus) >= idx;
                const isCurrent = deliveryStatus === step;

                return (
                  <div key={step} className={`flex items-start gap-3 ${idx < 3 ? 'pb-4' : ''}`}>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-all ${
                        isCompleted
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="text-[10px] font-bold">{idx + 1}</span>
                      )}
                    </div>
                    <div className={`flex-1 ${idx < 3 ? 'border-l-2 pl-3 ml-[-28px] mt-7 mb-[-16px]' : ''}`}>
                      <p
                        className={`text-xs font-bold -mt-6 pl-4 ${
                          isCurrent ? 'text-primary-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {step.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              Delivery Address
            </h2>
            <div className="text-xs text-slate-600 space-y-0.5">
              <p className="font-semibold text-slate-800">{order.deliveryAddress.streetAddress}</p>
              <p>{order.deliveryAddress.subCity}, {order.deliveryAddress.city}</p>
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <a href={`tel:${order.deliveryAddress.phoneNumber}`} className="text-blue-600 font-medium">
                  {order.deliveryAddress.phoneNumber}
                </a>
              </div>
            </div>
          </div>

          {/* Live Location Status */}
          {courierLocation && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <h3 className="text-xs font-bold text-blue-900">Courier GPS Signal</h3>
              </div>
              <p className="text-xs text-blue-700">
                Lat: {courierLocation.latitude.toFixed(5)}, Lng: {courierLocation.longitude.toFixed(5)}
              </p>
              {lastUpdated && (
                <p className="text-[10px] text-blue-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          )}

          {/* Recipient Info */}
          {order.buyer && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
              <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> Recipient
              </h2>
              <p className="text-xs font-semibold text-slate-800">{order.buyer.name}</p>
              <p className="text-xs text-slate-500">{order.buyer.email}</p>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-500" />
              {isTrackingActive ? 'Live Courier Location' : 'Delivery Map'}
            </h2>
            {!isTrackingActive && deliveryStatus !== 'DELIVERED' && (
              <span className="text-xs text-slate-400 font-medium">
                Live tracking activates when courier is assigned & en route
              </span>
            )}
            {deliveryStatus === 'DELIVERED' && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                Successfully Delivered
              </span>
            )}
          </div>

          <div ref={mapContainerRef} className="w-full h-[520px]" />

          {!isTrackingActive && deliveryStatus !== 'DELIVERED' && (
            <div className="p-5 border-t border-slate-100 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Awaiting courier assignment — live GPS tracking will begin automatically</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDeliveryTrackingPage;