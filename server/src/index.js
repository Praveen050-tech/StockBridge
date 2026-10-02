require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const { initSocket } = require('./config/socket');

const authRoutes = require('./routes/auth.routes');
const shopRoutes = require('./routes/shop.routes');
const godownRoutes = require('./routes/godown.routes');
const voiceRoutes = require('./routes/voice.routes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Setup Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Initialize Real-Time WebSockets
const io = initSocket(server);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    app: 'StockBridge Logistics API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/godown', godownRoutes);
app.use('/api/voice', voiceRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
async function startServer() {
  await testConnection();

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 StockBridge Backend running on http://localhost:${PORT}`);
    console.log(`⚡ Real-time Socket.io active on ws://localhost:${PORT}`);
    console.log(`📦 Role Dashboards: Shop Owner & Godown Admin ready`);
    console.log(`======================================================\n`);
  });
}

startServer();
