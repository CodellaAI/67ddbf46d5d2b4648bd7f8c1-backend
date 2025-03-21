
const mongoose = require('mongoose');

const TweetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 280
  },
  image: {
    type: String
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  retweets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tweet'
  },
  isReply: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Virtual for replies
TweetSchema.virtual('replies', {
  ref: 'Tweet',
  localField: '_id',
  foreignField: 'parent'
});

// Set virtuals to JSON
TweetSchema.set('toJSON', { virtuals: true });
TweetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Tweet', TweetSchema);
