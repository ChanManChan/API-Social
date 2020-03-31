const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema;
const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: 'Title is required',
    minlength: 4,
    maxlength: 150
  },
  body: {
    type: String,
    required: 'Body is required',
    minlength: 4,
    maxlength: 2000
  },
  photo: {
    // Buffer what it really is, is when you upload image (Normally images are big in size). So when you upload from the front end, it will go backend in the request body.
    //So it takes some time to receive the entire image, so during that time it will be available in this buffer (so it is some sort of space that is allocated by the nodejs core to give a bit of space.). So when its coming, until it is fully received it will be available in the buffer. So it will be storing this photo in the binary data format in the database. So later we can extract it from the database and display it to our front end client.
    data: Buffer,
    // contentType <-- image information (like file format etc. etc.)
    contentType: String
  },
  postedBy: {
    type: ObjectId,
    ref: 'User'
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: Date,
  likes: [{ type: ObjectId, ref: 'User' }],
  comments: [
    {
      text: String,
      created: { type: Date, default: Date.now },
      postedBy: { type: ObjectId, ref: 'User' }
    }
  ]
});

module.exports = mongoose.model('Post', postSchema);
