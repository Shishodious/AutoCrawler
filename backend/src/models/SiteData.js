const mongoose = require('mongoose');

const siteDataSchema = new mongoose.Schema({
  // Basic site information
  url: {
    type: String,
    required: [true, 'URL is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Basic URL validation
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid URL format'
    },
    index: true
  },
  
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [500, 'Title cannot exceed 500 characters']
  },
  
  links: [{
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty strings
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid link URL format'
    }
  }],
  
  // Metadata
  metadata: {
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    keywords: [{
      type: String,
      trim: true
    }],
    author: {
      type: String,
      trim: true
    },
    ogImage: {
      type: String,
      trim: true
    },
    favicon: {
      type: String,
      trim: true
    },
    language: {
      type: String,
      trim: true
    },
    contentType: {
      type: String,
      trim: true,
      default: 'text/html'
    }
  },
  
  // Crawler statistics
  crawlerStats: {
    method: {
      type: String,
      enum: ['axios', 'puppeteer', 'hybrid'],
      required: [true, 'Crawler method is required'],
      index: true
    },
    duration: {
      type: Number, // in milliseconds
      required: [true, 'Crawl duration is required'],
      min: [0, 'Duration cannot be negative']
    },
    depth: {
      type: Number,
      required: [true, 'Crawl depth is required'],
      min: [0, 'Depth cannot be negative'],
      max: [10, 'Depth cannot exceed 10'],
      index: true
    },
    statusCode: {
      type: Number,
      min: [100, 'Invalid HTTP status code'],
      max: [599, 'Invalid HTTP status code']
    },
    responseSize: {
      type: Number, // in bytes
      min: [0, 'Response size cannot be negative']
    }
  },
  
  // SSL/TLS information
  sslInfo: {
    tlsVersion: {
      type: String,
      trim: true,
      enum: {
        values: ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3', 'SSLv3', 'N/A'],
        message: '{VALUE} is not a valid TLS version'
      }
    },
    certificateValid: {
      type: Boolean,
      default: null
    },
    certificateIssuer: {
      type: String,
      trim: true
    },
    certificateExpiry: {
      type: Date
    },
    protocol: {
      type: String,
      enum: ['http', 'https'],
      required: true
    }
  },
  
  // Error tracking and retry information
  retryCount: {
    type: Number,
    default: 0,
    min: [0, 'Retry count cannot be negative'],
    max: [10, 'Retry count cannot exceed 10']
  },
  
  errorType: {
    type: String,
    enum: ['TIMEOUT', 'DNS_ERROR', 'CONNECTION_ERROR', 'SSL_ERROR', 'HTTP_ERROR', 'PARSE_ERROR', 'UNKNOWN', 'NONE'],
    default: 'NONE'
  },
  
  errorMessage: {
    type: String,
    trim: true,
    maxlength: [500, 'Error message cannot exceed 500 characters']
  },
  
  // Success status
  crawlSuccess: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // User reference (if applicable)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Crawl session ID (for grouping pages from recursive crawls)
  crawlSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: false
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'sitedata'
});

// Indexes for performance optimization
siteDataSchema.index({ url: 1, createdAt: -1 });
siteDataSchema.index({ 'crawlerStats.method': 1, crawlSuccess: 1 });
siteDataSchema.index({ userId: 1, createdAt: -1 });
siteDataSchema.index({ errorType: 1 }, { sparse: true });
siteDataSchema.index({ crawlSessionId: 1, createdAt: -1 }, { sparse: true });

// Virtual for crawl age
siteDataSchema.virtual('crawlAge').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for formatted duration
siteDataSchema.virtual('formattedDuration').get(function() {
  if (!this.crawlerStats || !this.crawlerStats.duration) return 'N/A';
  const duration = this.crawlerStats.duration;
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
});

// Schema methods

// Method to increment retry count
siteDataSchema.methods.incrementRetry = function() {
  this.retryCount += 1;
  return this.save();
};

// Method to mark as failed
siteDataSchema.methods.markAsFailed = function(errorType, errorMessage) {
  this.crawlSuccess = false;
  this.errorType = errorType || 'UNKNOWN';
  this.errorMessage = errorMessage;
  return this.save();
};

// Method to get summary
siteDataSchema.methods.getSummary = function() {
  return {
    url: this.url,
    title: this.title,
    method: this.crawlerStats?.method,
    duration: this.formattedDuration,
    depth: this.crawlerStats?.depth,
    success: this.crawlSuccess,
    linksFound: this.links?.length || 0,
    crawledAt: this.createdAt
  };
};

// Static method to find by URL
siteDataSchema.statics.findByUrl = function(url) {
  return this.findOne({ url: url }).exec();
};

// Static method to find successful crawls
siteDataSchema.statics.findSuccessfulCrawls = function(limit = 10) {
  return this.find({ crawlSuccess: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

// Static method to find failed crawls
siteDataSchema.statics.findFailedCrawls = function(limit = 10) {
  return this.find({ crawlSuccess: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

// Static method to get crawl statistics
siteDataSchema.statics.getCrawlStats = async function() {
  const total = await this.countDocuments();
  const successful = await this.countDocuments({ crawlSuccess: true });
  const failed = await this.countDocuments({ crawlSuccess: false });
  
  const avgDuration = await this.aggregate([
    { $match: { crawlSuccess: true } },
    { $group: { _id: null, avgDuration: { $avg: '$crawlerStats.duration' } } }
  ]);
  
  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%',
    avgDuration: avgDuration.length > 0 ? avgDuration[0].avgDuration : 0
  };
};

// Static method to find by user
siteDataSchema.statics.findByUser = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

// Pre-save middleware to extract protocol from URL
siteDataSchema.pre('validate', function (next) {
  //we did pre validate bcz earlier it was .pre(save) and it checked before saving but now we are checking before validation. Earlier it used to fail bcz validation fails before saving 
  // Initialize sslInfo if it doesn't exist
  if (!this.sslInfo) {
    this.sslInfo = {};
  }
  
  // Extract protocol from URL if not already set
  if (this.url && !this.sslInfo.protocol) {
    try {
      const urlObj = new URL(this.url);
      this.sslInfo.protocol = urlObj.protocol.replace(':', '');
    } catch (error) {
      // If URL is invalid, set default to http
      this.sslInfo.protocol = 'http';
    }
  }
  next();
});

// Enable virtuals in JSON
siteDataSchema.set('toJSON', { virtuals: true });
siteDataSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SiteData', siteDataSchema);
