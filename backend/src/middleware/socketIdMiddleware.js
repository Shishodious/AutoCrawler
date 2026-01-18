/**
 * Socket ID Middleware
 * Extracts socket ID from HTTP request headers and attaches it to req object
 * This allows linking HTTP requests with Socket.IO connections for real-time events
 */

/**
 * Middleware to extract socket ID from request headers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const extractSocketId = (req, res, next) => {
  // Extract socket ID from X-Socket-ID header
  const socketId = req.headers['x-socket-id'];
  
  if (socketId) {
    req.socketId = socketId;
    console.log(`[SocketID Middleware] Socket ID attached: ${socketId}`);
  } else {
    // Socket ID is optional for backward compatibility
    console.log('[SocketID Middleware] No socket ID provided (API-only mode)');
    req.socketId = null;
  }
  
  next();
};

module.exports = extractSocketId;
