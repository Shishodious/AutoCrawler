const socketIO = require('socket.io');
const socketAuth = require('../middleware/socketAuth');

let io = null;

/**
 * Initialize Socket.IO with HTTP server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO instance
 */
const initializeSocket = (server) => {
  if (io) {
    console.warn('⚠️ Socket.IO already initialized');
    return io;
  }

  // Initialize Socket.IO with server
  io = socketIO(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
    // Connection timeout
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Apply authentication middleware to all connections
  io.use(socketAuth);

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (User: ${socket.user.username})`);

    // Send welcome message
    socket.emit('server-response', `Welcome ${socket.user.username}! Connected with ID: ${socket.id}`);

    // Listen for test messages from client
    socket.on('test-from-client', (data) => {
      console.log(`📨 Received from client (${socket.user.username}):`, data);
      socket.emit('server-response', `Server received: ${data}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (User: ${socket.user.username}) - Reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.IO initialized with authentication');
  
  return io;
};

/**
 * Get Socket.IO instance
 * @returns {Object} Socket.IO instance
 * @throws {Error} If Socket.IO is not initialized
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket() first.');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
};
