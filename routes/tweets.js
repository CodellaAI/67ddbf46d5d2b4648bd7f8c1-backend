
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Tweet = require('../models/Tweet');
const User = require('../models/User');

// @route   POST api/tweets
// @desc    Create a tweet
// @access  Private
router.post(
  '/',
  [
    auth,
    upload.single('image'),
    body('content', 'Content is required').not().isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const newTweet = new Tweet({
        user: req.user.id,
        content: req.body.content,
        image: req.file ? `/uploads/${req.file.filename}` : null
      });
      
      const tweet = await newTweet.save();
      
      // Populate user field
      await tweet.populate('user', 'name username profileImage');
      
      res.json(tweet);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   GET api/tweets
// @desc    Get all tweets (timeline)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Get tweets from users that the current user follows and the user's own tweets
    const tweets = await Tweet.find({
      $or: [
        { user: { $in: [...req.user.following, req.user.id] } },
        { retweets: { $in: [req.user.id] } }
      ],
      isReply: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name username profileImage')
    .populate({
      path: 'parent',
      populate: {
        path: 'user',
        select: 'name username profileImage'
      }
    });
    
    res.json(tweets);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/tweets/:id
// @desc    Get tweet by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id)
      .populate('user', 'name username profileImage')
      .populate({
        path: 'parent',
        populate: {
          path: 'user',
          select: 'name username profileImage'
        }
      });
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    res.json(tweet);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/tweets/:id
// @desc    Delete a tweet
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check user
    if (tweet.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }
    
    await tweet.deleteOne();
    
    res.json({ message: 'Tweet removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST api/tweets/:id/like
// @desc    Like or unlike a tweet
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check if the tweet has already been liked
    const isLiked = tweet.likes.includes(req.user.id);
    
    if (isLiked) {
      // Unlike
      tweet.likes = tweet.likes.filter(like => like.toString() !== req.user.id);
    } else {
      // Like
      tweet.likes.unshift(req.user.id);
    }
    
    await tweet.save();
    
    res.json({ isLiked: !isLiked, userId: req.user.id });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST api/tweets/:id/retweet
// @desc    Retweet or unretweet a tweet
// @access  Private
router.post('/:id/retweet', auth, async (req, res) => {
  try {
    const tweet = await Tweet.findById(req.params.id);
    
    if (!tweet) {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    
    // Check if the tweet has already been retweeted
    const isRetweeted = tweet.retweets.includes(req.user.id);
    
    if (isRetweeted) {
      // Unretweet
      tweet.retweets = tweet.retweets.filter(retweet => retweet.toString() !== req.user.id);
    } else {
      // Retweet
      tweet.retweets.unshift(req.user.id);
    }
    
    await tweet.save();
    
    res.json({ isRetweeted: !isRetweeted, userId: req.user.id });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   POST api/tweets/:id/reply
// @desc    Reply to a tweet
// @access  Private
router.post(
  '/:id/reply',
  [
    auth,
    upload.single('image'),
    body('content', 'Content is required').not().isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const parentTweet = await Tweet.findById(req.params.id);
      
      if (!parentTweet) {
        return res.status(404).json({ message: 'Tweet not found' });
      }
      
      const newReply = new Tweet({
        user: req.user.id,
        content: req.body.content,
        image: req.file ? `/uploads/${req.file.filename}` : null,
        parent: req.params.id,
        isReply: true
      });
      
      const reply = await newReply.save();
      
      // Populate user field
      await reply.populate('user', 'name username profileImage');
      
      res.json(reply);
    } catch (err) {
      console.error(err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Tweet not found' });
      }
      res.status(500).send('Server error');
    }
  }
);

// @route   GET api/tweets/:id/replies
// @desc    Get replies to a tweet
// @access  Public
router.get('/:id/replies', async (req, res) => {
  try {
    const replies = await Tweet.find({ 
      parent: req.params.id,
      isReply: true
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name username profileImage');
    
    res.json(replies);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Tweet not found' });
    }
    res.status(500).send('Server error');
  }
});

// @route   GET api/tweets/user/:userId
// @desc    Get tweets by user ID
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const tweets = await Tweet.find({ 
      user: req.params.userId,
      isReply: false
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name username profileImage');
    
    res.json(tweets);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).send('Server error');
  }
});

module.exports = router;
