require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./src/config/database');
// Import models to initialize associations
require('./src/models');
const { registerRoutes } = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.IO Setup ─────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join personal room for targeted notifications
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined personal room`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });

  // Shipment room subscription
  socket.on('subscribe:shipment', (shipmentId) => {
    socket.join(`shipment:${shipmentId}`);
  });

  socket.on('unsubscribe:shipment', (shipmentId) => {
    socket.leave(`shipment:${shipmentId}`);
  });
});

// ─── Security & General Middleware ───────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
registerRoutes(app, io);

// ─── Root route ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to CargoFlo API',
    version: '1.0.0',
    docs: '/api/health',
    endpoints: {
      auth: '/api/auth',
      dashboard: '/api/dashboard',
      quotations: '/api/quotations',
      shipments: '/api/shipments',
      jobs: '/api/jobs',
      invoices: '/api/invoices',
      customers: '/api/customers',
      rates: '/api/rates',
      carriers: '/api/carriers',
      ports: '/api/ports',
      tracking: '/api/tracking',
      documents: '/api/documents',
      schedules: '/api/schedules',
      users: '/api/users',
      reports: '/api/reports',
      notifications: '/api/notifications',
    },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log(`\n=======================================`);
    console.log(`  CargoFlo API Server`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Socket.IO: enabled`);
    console.log(`=======================================\n`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, io };
