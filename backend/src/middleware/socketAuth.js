const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from socket handshake and attaches user to socket
 */
const socketAuth = async (socket, next) => {
  try {
    // Extract token from socket handshake auth
    let token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Remove 'Bearer ' prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    // Verify JWT token using the same secret as Passport
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

    // Find user in database
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach user to socket for use in event handlers
    socket.user = user;
    
    console.log(`✅ Socket authenticated for user: ${user.username}`);
    
    next();
  } catch (error) {
    console.error('❌ Socket authentication failed:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Authentication error: Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Authentication error: Token expired'));
    }
    
    return next(new Error('Authentication error: ' + error.message));
  }
};

module.exports = socketAuth;
