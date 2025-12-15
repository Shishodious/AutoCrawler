const mongoose = require('mongoose');

const siteDataSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true
  },
  links: [{
    type: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SiteData', siteDataSchema);
