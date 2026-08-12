const mongoose = require('mongoose');

/**
 * A user-supplied authenticated session (cookie string) for a domain the user
 * is entitled to access. Cookies are stored ENCRYPTED (AES-256-GCM) — the
 * plaintext is only decrypted in the worker at crawl time and is never logged
 * or returned by the API. Injecting these is gated on an explicit AUP
 * acknowledgment (see the crawl route).
 */
const authSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  label: {
    type: String,
    required: [true, 'A label is required'],
    trim: true,
    maxlength: 100
  },
  // Host this session applies to (e.g. "app.example.com")
  domain: {
    type: String,
    required: [true, 'A domain is required'],
    trim: true,
    lowercase: true
  },
  // AES-256-GCM ciphertext ("iv:tag:ciphertext"); never the raw cookie
  encryptedCookies: {
    type: String,
    required: true,
    select: false // never returned unless explicitly asked
  }
}, {
  timestamps: true,
  collection: 'authsessions'
});

authSessionSchema.index({ userId: 1, domain: 1 });

module.exports = mongoose.model('AuthSession', authSessionSchema);
