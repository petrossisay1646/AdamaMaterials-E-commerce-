const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');
const AppError = require('./utils/appError');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (for rate limiting and secure cookies)

app.use(express.json());

// HTTP Response Compression (Gzip/Brotli) for high speed
app.use(compression());

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: false, // Allows loading uploaded local images in React
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, bot) or matching allowed origins
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Limit requests from same IP — disabled in development to avoid hot-reload false positives
const limiter = rateLimit({
  max: process.env.NODE_ENV === 'production' ? 200 : 0, // 0 = disabled
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in 15 minutes.',
  skip: () => process.env.NODE_ENV !== 'production',
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body (allow up to 25MB for receipts & photos)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Static file serving for uploads with 1-day browser caching
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'), { maxAge: '1d' }));

// Routes mounting
const authRouter = require('./routes/authRoutes');
const productRouter = require('./routes/productRoutes');
const categoryRouter = require('./routes/categoryRoutes');
const materialTypeRouter = require('./routes/materialTypeRoutes');
const cartRouter = require('./routes/cartRoutes');
const orderRouter = require('./routes/orderRoutes');
const paymentRouter = require('./routes/paymentRoutes');
const deliveryRouter = require('./routes/deliveryRoutes');
const payoutRouter = require('./routes/payoutRoutes');
const disputeRouter = require('./routes/disputeRoutes');
const notificationRouter = require('./routes/notificationRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const adminRouter = require('./routes/adminRoutes');
const mapRouter = require('./routes/mapRoutes');

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/material-types', materialTypeRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/payments', paymentRouter);
app.use('/api/v1/deliveries', deliveryRouter);
app.use('/api/v1/payouts', payoutRouter);
app.use('/api/v1/disputes', disputeRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/map', mapRouter);


// Database Statistics Reset Endpoint (Dev / Testing)
app.post('/api/v1/reset-stats', async (req, res, next) => {
  try {
    const seedData = require('./jobs/seed');
    await seedData(true);
    res.status(200).json({
      success: true,
      message: 'All marketplace statistics, orders, payments, payouts, and notifications have been reset to zero!',
    });
  } catch (err) {
    next(err);
  }
});

// Unhandled routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // Production (Do not leak internal stack traces)
    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    } else {
      // Programming or other unknown error: don't leak details
      console.error('ERROR 💥', err);
      res.status(500).json({
        success: false,
        message: 'Something went wrong on our end.',
      });
    }
  }
});

module.exports = app;
