const mongoose = require('mongoose');

const academySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '학원 이름은 필수입니다'],
    unique: true,
    trim: true
  },
  nameEn: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  keywords: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

academySchema.index({ isActive: 1 });

module.exports = mongoose.model('Academy', academySchema);
