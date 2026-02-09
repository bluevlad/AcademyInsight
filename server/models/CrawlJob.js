const mongoose = require('mongoose');

const crawlJobSchema = new mongoose.Schema({
  source: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrawlSource'
  },
  academy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Academy'
  },
  keyword: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  postsFound: {
    type: Number,
    default: 0
  },
  postsSaved: {
    type: Number,
    default: 0
  },
  duplicatesSkipped: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

crawlJobSchema.index({ status: 1 });
crawlJobSchema.index({ academy: 1, createdAt: -1 });
crawlJobSchema.index({ source: 1, createdAt: -1 });

module.exports = mongoose.model('CrawlJob', crawlJobSchema);
