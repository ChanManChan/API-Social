const User = require('../models/user');
const _ = require('lodash');
const formidable = require('formidable');
const fs = require('fs');

exports.userById = (req, res, next, id) => {
  User.findById(id)
    // populate followers and following users array
    .populate('following', '_id name')
    .populate('followers', '_id name')
    .exec((err, user) => {
      if (err || !user) {
        return res.status(400).json({
          error: 'User not found'
        });
      }
      /**what if we got the user? in that case i would like to append that user which will contain the user information like email, name etc...., i want to take that user object and append it to the request object
       * Adds profile object in req with user information.
       */
      req.profile = user;
      next();
    });
};

exports.hasAuthorization = (req, res, next) => {
  let sameUser =
    req.profile && req.auth && req.profile._id.toString() === req.auth._id;
  let adminUser = req.profile && req.auth && req.auth.role === 'admin';
  console.log('SAME_USER: ', sameUser, 'ADMIN_USER: ', adminUser);
  const authorized = sameUser || adminUser;
  if (!authorized) {
    return res.status(403).json({
      error: 'User is not authorized to perform this action'
    });
  }
  // This hasAuthorization, we can use later when a user tries to create, update or delete his post. We can also use this on profile update.
  next();
};

exports.allUsers = (req, res) => {
  User.find((err, users) => {
    if (err) {
      return res.status(500).json({
        error: err
      });
    }
    res.json(users);
  }).select('-salt -hashed_password -__v');
};

exports.getUser = (req, res) => {
  req.profile.hashed_password = undefined;
  req.profile.salt = undefined;
  return res.json(req.profile);
};

// exports.updateUser = (req, res, next) => {
//   let user = req.profile;
//   // New information will come from req.body from the user itself.
//   // extend = mutate the source object (user).
//   user = _.extend(user, req.body);
//   user.updated = Date.now();
//   user.save(err => {
//     if (err) {
//       return res
//         .status(500)
//         .json({ error: 'You are not authorized to perform this action.' });
//     }
//     user.hashed_password = undefined;
//     user.salt = undefined;
//     res.json({ user });
//   });
// };
exports.updateUser = (req, res, next) => {
  let form = new formidable.IncomingForm();
  form.keepExtensions = true;
  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(400).json({
        error: 'Photo could not be uploaded'
      });
    }
    // save user
    let user = req.profile;
    user = _.extend(user, fields);
    user.updated = Date.now();
    if (files.photo) {
      user.photo.data = fs.readFileSync(files.photo.path);
      user.photo.contentType = files.photo.type;
    }
    user.save((err, result) => {
      if (err) return res.status(500).json({ error: err });
      user.hashed_password = undefined;
      user.salt = undefined;
      res.json(user);
    });
  });
};

exports.userPhoto = (req, res, next) => {
  if (req.profile.photo.data) {
    res.set('Content-Type', req.profile.photo.contentType);
    return res.send(req.profile.photo.data);
  }
  next();
};

exports.deleteUser = (req, res, next) => {
  let user = req.profile;
  user.remove((err, user) => {
    if (err) {
      return res.status(500).json({
        error: err
      });
    }
    res.json({ message: 'User deleted successfully.' });
  });
};

// ADD FOLLOWING FOLLOWER
// In the routes, make sure 'addFollowing' comes first and then 'addFollowers' comes second.
exports.addFollowing = (req, res, next) => {
  User.findByIdAndUpdate(
    req.body.userId,
    {
      $push: { following: req.body.followId }
    },
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err });
      }
      next();
    }
  );
};

exports.addFollower = (req, res) => {
  User.findByIdAndUpdate(
    req.body.followId,
    { $push: { followers: req.body.userId } },
    { new: true }
  )
    .populate('following', '_id name')
    .populate('followers', '_id name')
    .exec((err, result) => {
      if (err) {
        return res.status(400).json({ error: err });
      }
      // This result will contain the user and his followers and following list.
      result.hashed_password = undefined;
      result.salt = undefined;
      res.json(result);
    });
};

//REMOVE FOLLOWING FOLLOWER
exports.removeFollowing = (req, res, next) => {
  User.findByIdAndUpdate(
    req.body.userId,
    { $pull: { following: req.body.unfollowId } },
    (err, result) => {
      if (err) {
        return res.status(400).json({ error: err });
      }
      next();
    }
  );
};

exports.removeFollower = (req, res) => {
  User.findByIdAndUpdate(
    req.body.unfollowId,
    { $pull: { followers: req.body.userId } },
    { new: true }
  )
    .populate('following', '_id name')
    .populate('followers', '_id name')
    .exec((err, result) => {
      if (err) {
        return res.status(400).json({
          error: err
        });
      }
      result.hashed_password = undefined;
      result.salt = undefined;
      res.json(result);
    });
};

exports.findPeople = (req, res) => {
  let excluded = req.profile.following;
  excluded.push(req.profile._id);
  // $nin = not include
  User.find({ _id: { $nin: excluded } }, (err, users) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    res.json(users);
  }).select('name');
};
