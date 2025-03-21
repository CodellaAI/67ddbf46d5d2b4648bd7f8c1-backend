
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tweet = require('../models/Tweet');

// @route   GET api/search
// @desc    Search tweets and users
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Search for users
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } }
      ]
    })
    .select('-password -email')
    .limit(10);
    
    // Search for tweets
    const tweets = await Tweet.find({
      content: { $regex: q, $options: 'i' }
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('user', 'name username profileImage');
    
    res.json({ users, tweets });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
