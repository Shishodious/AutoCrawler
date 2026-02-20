const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Express middleware to verify JWT token from Authorization header.
 * Attaches req.user on success, returns 401 on failure.
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Strip "Bearer " prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = authMiddleware;
