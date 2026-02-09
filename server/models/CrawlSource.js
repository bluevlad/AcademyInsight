const mongoose = require('mongoose');

const crawlSourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '소스 이름은 필수입니다'],
    trim: true
  },
  url: {
    type: String,
    required: [true, 'URL은 필수입니다'],
    trim: true
  },
  sourceType: {
    type: String,
    required: true,
    enum: ['naver_cafe', 'daum_cafe', 'dcinside']
  },
  sourceId: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastCrawledAt: {
    type: Date,
    default: null
  },
  crawlConfig: {
    requiresLogin: { type: Boolean, default: false },
    minDelay: { type: Number, default: 1000 },
    maxDelay: { type: Number, default: 3000 }
  }
}, {
  timestamps: true
});

crawlSourceSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
crawlSourceSchema.index({ isActive: 1 });

module.exports = mongoose.model('CrawlSource', crawlSourceSchema);
