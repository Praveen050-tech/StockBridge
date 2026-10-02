let ioInstance = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
    }
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Client connected to real-time socket: ${socket.id}`);

    // Join room based on role & entity ID
    socket.on('join_godown', (godownId) => {
      const room = `godown_${godownId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('join_shop', (shopUserId) => {
      const room = `shop_${shopUserId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  ioInstance = io;
  return io;
}

function getIO() {
  if (!ioInstance) {
    // Return dummy broadcaster to avoid crashing if socket not yet attached
    return {
      to: () => ({ emit: () => {} }),
      emit: () => {}
    };
  }
  return ioInstance;
}

// Dedicated event helpers for business logic
function notifyNewOrder(godownId, orderData) {
  const io = getIO();
  io.to(`godown_${godownId}`).emit('new_order', orderData);
  io.emit('global_order_placed', { orderId: orderData.id, godownId });
}

function notifyOrderStatusChanged(shopUserId, orderData) {
  const io = getIO();
  io.to(`shop_${shopUserId}`).emit('order_status_changed', orderData);
  io.emit('order_status_broadcast', { orderId: orderData.id, status: orderData.status });
}

function notifyGodownStockUpdated(godownId, productUpdate) {
  const io = getIO();
  // Broadcast to all connected clients & shops
  io.emit('godown_stock_updated', { godownId, ...productUpdate });
}

function notifyShopStockUpdated(shopUserId, stockData) {
  const io = getIO();
  io.to(`shop_${shopUserId}`).emit('shop_stock_updated', stockData);
}

module.exports = {
  initSocket,
  getIO,
  notifyNewOrder,
  notifyOrderStatusChanged,
  notifyGodownStockUpdated,
  notifyShopStockUpdated
};
