
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const User = require('../models/User');
const Tweet = require('../models/Tweet');

// @route   GET api/users/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/users/:username
// @desc    Get user by username
// @access  Public
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .select('-email');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/users/me
// @desc    Update current user
// @access  Private
router.put('/me', auth, async (req, res) => {
  const { name, bio, location, website } = req.body;
  
  // Build user object
  const userFields = {};
  if (name) userFields.name = name;
  if (bio) userFields.bio = bio;
  if (location) userFields.location = location;
  if (website) userFields.website = website;
  
  try {
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userFields },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/users/me/profile-image
// @desc    Update profile image
// @access  Private
router.put(
  '/me/profile-image',
  [auth, upload.single('image')],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Update profile image
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { profileImage: `/uploads/${req.file.filename}` },
        { new: true }
      ).select('-password');
      
      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   PUT api/users/me/cover-image
// @desc    Update cover image
// @access  Private
router.put(
  '/me/cover-image',
  [auth, upload.single('image')],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Update cover image
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { coverImage: `/uploads/${req.file.filename}` },
        { new: true }
      ).select('-password');
      
      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route   POST api/users/:id/follow
// @desc    Follow/unfollow a user
// @access  Private
router.post('/:id/follow', auth, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    
    const userToFollow = await User.findById(req.params.id);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if already following
    const isFollowing = req.user.following.includes(req.params.id);
    
    if (isFollowing) {
      // Unfollow user
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { following: req.params.id }
      });
      
      await User.findByIdAndUpdate(req.params.id, {
        $pull: { followers: req.user.id }
      });
      
      res.json({ isFollowing: false, userId: req.user.id });
    } else {
      // Follow user
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { following: req.params.id }
      });
      
      await User.findByIdAndUpdate(req.params.id, {
        $addToSet: { followers: req.user.id }
      });
      
      res.json({ isFollowing: true, userId: req.user.id });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/users/suggestions
// @desc    Get user suggestions (who to follow)
// @access  Private
router.get('/suggestions', auth, async (req, res) => {
  try {
    // Find users that the current user is not following
    // Exclude the current user
    const users = await User.find({
      _id: { $nin: [...req.user.following, req.user.id] }
    })
    .select('-password -email')
    .limit(5);
    
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
