const Post = require('../models/post');
const formidable = require('formidable');
const fs = require('fs');
const _ = require('lodash');
/*
 * Whenever there is postId in the URL, execute postById().
 * postById() will query the database and return that post.
 * Also populate the user who created the post.
 * And make post available in req like so
 * req.post
 */
exports.postById = (req, res, next, id) => {
  Post.findById(id)
    .populate('postedBy', '_id name role')
    .populate('comments.postedBy', '_id name')
    .exec((err, post) => {
      if (err || !post) {
        return res.status(400).json({
          error: err
        });
      }
      // Add this post to the request object so that it is available to play with.
      req.post = post;
      next();
    });
};

exports.getPosts = (req, res) => {
  Post.find()
    .populate('postedBy', '_id name')
    .populate('comments.postedBy', '_id name')
    .select('-__v')
    // '-1' <-- latest one comes first.
    .sort({ created: -1 })
    .then(posts => {
      res.status(200).json(posts);
    })
    .catch(err => console.log(err));
};

exports.createPost = (req, res, next) => {
  let form = new formidable.IncomingForm();

  form.keepExtensions = true;
  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(400).json({
        error: 'Image could not be uploaded'
      });
    }
    let post = new Post(fields);

    req.profile.hashed_password = undefined;
    req.profile.salt = undefined;
    post.postedBy = req.profile;

    if (files.photo) {
      post.photo.data = fs.readFileSync(files.photo.path);
      post.photo.contentType = files.photo.type;
    }
    post.save((err, result) => {
      if (err) {
        return res.status(500).json({
          error: err
        });
      }
      res.json(result);
    });
  });
  // const post = new Post(req.body);
  // console.log('CREATING POST: ', req.body);
  // post.save((err, result) => {
  //   if (err) {
  //     return res.status(500).json({
  //       error: err
  //     });
  //   }
  //   res.status(200).json({
  //     post: result
  //   });
  // });
};

exports.postsByUser = (req, res) => {
  // Its referring to a different model not the post model itself, its looking for a different model (in this case its 'User') that is the reason we need to use 'populate' otherwise if everything  was inside the post model, then we could use something like 'select'. But because its on a different model, we use 'populate'.
  Post.find({ postedBy: req.profile.id })
    .populate('postedBy', '_id name')
    .select('-__v')
    .sort('_created')
    .exec((err, posts) => {
      if (err) {
        return res.status(400).json({ error: err });
      }
      res.json(posts);
    });
};

exports.isPoster = (req, res, next) => {
  let sameUser =
    req.post && req.auth && req.post.postedBy._id.toString() === req.auth._id;
  let adminUser = req.post && req.auth && req.auth.role === 'admin';
  let isPoster = sameUser || adminUser;
  // console.log('req.auth: ', req.auth);
  // console.log('req.post.postedBy: ', req.post.postedBy);
  if (!isPoster) {
    return res.status(403).json({ error: 'User is not authorized' });
  }
  next();
};

// exports.updatePost = (req, res, next) => {
//   let post = req.post;
//   post = _.extend(post, req.body);
//   post.updated = Date.now();
//   post.save(err => {
//     if (err) {
//       return res.status(500).json({ error: err });
//     }
//     res.json(post);
//   });
// };
exports.updatePost = (req, res, next) => {
  let form = new formidable.IncomingForm();
  form.keepExtensions = true;
  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).json({
        error: 'Photo could not be uploaded'
      });
    }
    // save post
    let post = req.post;
    post = _.extend(post, fields);
    post.updated = Date.now();
    if (files.photo) {
      post.photo.data = fs.readFileSync(files.photo.path);
      post.photo.contentType = files.photo.type;
    }
    post.save((err, result) => {
      if (err) {
        return res.status(500).json({
          error: err
        });
      }
      res.json(post);
    });
  });
};

exports.deletePost = (req, res) => {
  let post = req.post;
  post.remove((err, post) => {
    if (err) {
      return res.status(500).json({
        error: err
      });
    }
    res.json({ message: 'Post deleted successfully' });
  });
};

exports.photo = (req, res, next) => {
  // Set the header, because we are sending the image to the front end so we need to make sure that we are sending proper content type.
  res.set('Content-Type', req.post.photo.contentType);
  return res.send(req.post.photo.data);
};

exports.singlePost = (req, res) => {
  return res.json(req.post);
};

exports.like = (req, res) => {
  Post.findByIdAndUpdate(
    req.body.postId,
    {
      $push: { likes: req.body.userId }
    },
    { new: true }
  ).exec((err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    } else {
      res.json(result);
    }
  });
};

exports.unlike = (req, res) => {
  Post.findByIdAndUpdate(
    req.body.postId,
    {
      $pull: { likes: req.body.userId }
    },
    { new: true }
  ).exec((err, result) => {
    if (err) {
      return res.status(500).json({
        error: err
      });
    } else {
      res.json(result);
    }
  });
};

exports.comment = (req, res) => {
  let comment = req.body.comment;
  comment.postedBy = req.body.userId;
  Post.findByIdAndUpdate(
    req.body.postId,
    {
      $push: { comments: comment }
    },
    { new: true }
  )
    .populate('comments.postedBy', '_id name')
    .populate('postedBy', '_id name')
    .exec((err, result) => {
      if (err) {
        return res.status(500).json({ error: err });
      } else {
        res.json(result);
      }
    });
};

exports.uncomment = (req, res) => {
  let comment = req.body.comment;
  Post.findByIdAndUpdate(
    req.body.postId,
    {
      $pull: { comments: { _id: comment._id } }
    },
    { new: true }
  )
    .populate('comments.postedBy', '_id name')
    .populate('postedBy', '_id name')
    .exec((err, result) => {
      if (err) {
        return res.status(500).json({ error: err });
      } else {
        res.json(result);
      }
    });
};
