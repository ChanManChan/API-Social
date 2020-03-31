const express = require('express');
const {
  userById,
  allUsers,
  getUser,
  updateUser,
  deleteUser,
  hasAuthorization,
  userPhoto,
  addFollowing,
  addFollower,
  removeFollowing,
  removeFollower,
  findPeople
} = require('../controllers/user');
const { requireSignin } = require('../controllers/auth');
const router = express.Router();

router.put('/user/follow', requireSignin, addFollowing, addFollower);
router.put('/user/unfollow', requireSignin, removeFollowing, removeFollower);

// This should be accessible to everyone, we don't want to implement authentication
router.get('/users', allUsers);
// If they want to see a single user, they must be logged in.
router.get('/user/:userId', requireSignin, getUser);

router.put('/user/:userId', requireSignin, hasAuthorization, updateUser);

router.delete('/user/:userId', requireSignin, hasAuthorization, deleteUser);

//Photo
router.get('/user/photo/:userId', userPhoto);

// Who to follow?
router.get('/user/findpeople/:userId', requireSignin, findPeople);

// Any route containing :userId, our app will first execute userById(), so that we have 'profile' object in the request available so that we have the user information to play with.
router.param('userId', userById);

module.exports = router;
