const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Load environment variables from .env if present, otherwise fallback to .env.example
const envPath = path.join(__dirname, '../../.env');
const envExamplePath = path.join(__dirname, '../../.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
} else {
  dotenv.config();
}

// Fallback default environment configuration
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '5000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_that_is_at_least_32_characters_long_for_adama_city';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'another_super_secret_refresh_jwt_key_that_is_at_least_32_characters_long_for_adama_city';

const app = require('./app');
const SocketService = require('./services/SocketService');

// MongoDB Connection
const connectDB = require('./config/db');
connectDB();

// Start server
const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port} in ${process.env.NODE_ENV} mode... 🚀`);
});

// Initialize real-time WebSocket / Socket.IO tracking
SocketService.init(server);


// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

