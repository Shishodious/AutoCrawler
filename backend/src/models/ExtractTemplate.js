const mongoose = require('mongoose');

/**
 * A saved, reusable extraction template — a named field schema (+ optional
 * selectors and a domain hint) a user can re-run across many URLs. Turns
 * one-off extraction into a repeatable product surface.
 */
const extractTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Optional domain/URL substring this template is tuned for (e.g. "example.com")
  domainPattern: {
    type: String,
    trim: true
  },
  mode: {
    type: String,
    enum: ['auto', 'selectors', 'llm'],
    default: 'auto'
  },
  // Requested fields: { name, type, description }
  fields: [{
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'string[]'],
      default: 'string'
    },
    description: { type: String, trim: true }
  }],
  // Optional CSS selectors for 'selectors'/'auto' mode: { fieldName: selector }
  selectors: {
    type: mongoose.Schema.Types.Mixed,
    default: undefined
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'extracttemplates'
});

extractTemplateSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ExtractTemplate', extractTemplateSchema);
