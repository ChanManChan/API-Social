const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/user');
const expressJwt = require('express-jwt');
const { sendEmail } = require('../helpers');
const _ = require('lodash');
const fetch = require('node-fetch');
const { OAuth2Client } = require('google-auth-library');

exports.signup = async (req, res) => {
  const userExists = await User.findOne({ email: req.body.email });
  if (userExists) return res.status(403).json({ error: 'Email is taken' });
  const user = await new User(req.body);
  await user.save();
  res.status(200).json({ message: 'Signup success! Please login.' });
};

exports.signin = (req, res) => {
  // find the user based on email
  const { email, password } = req.body;
  User.findOne({ email }, (err, user) => {
    if (err || !user) {
      return res.status(401).json({
        error: 'User with that email does not exist. Please signin.'
      });
    }
    // if user is found make sure that email and password matches
    // create authenticate method in model and use here
    if (!user.authenticate(password)) {
      return res.status(401).json({
        error: 'Email and password do not match'
      });
    }
    // generate a token with userId and jwtSecret(from .env)
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
    // persist the token as 't' in cookie with expiry date
    //sometimes your application is doing some complicated stuff like server side rendering and wants to make sure that we get the cookie from the server and don't want to store the cookie in the client side, if they have such approach they can use this (res.cookie('t', token, { expire: new Date() + 9999 })) as well, that's why we are adding both methods, we'll make it available in the response as well, as well as give it through the return statement.
    res.cookie('t', token, { expire: new Date() + 9999 });
    // again, we're giving the token on the res.cookie(...) as well as the actual response (return res.json({ token, user: { _id, email, name } })), depending on the frontend client it will work either way.

    // return response with user and token to frontend client (this is the approach we're going to use).
    const { _id, name, email } = user;
    return res.json({ token, user: { _id, email, name } });
  });
};

exports.signout = (req, res) => {
  // all we need to do is clear the cookie with the name 't'
  res.clearCookie('t');
  return res.json({
    message: 'Signout success!'
  });
};

exports.requireSignin = expressJwt({
  // if the token is valid, express-jwt appends the verified users id in an auth key to the request object.
  secret: process.env.JWT_SECRET,
  // with this we can access auth.id to check the currently signed in user's id
  userProperty: 'auth'
});

//FORGOT PASSWORD
exports.forgotPassword = (req, res) => {
  if (!req.body) return res.status(400).json({ message: 'No request body' });
  if (!req.body.email)
    return res.status(400).json({ message: 'No Email in request body' });
  const { email } = req.body;
  User.findOne({ email }, (err, user) => {
    if (err || !user)
      return res
        .status(401)
        .json({ error: 'User with that email does not exist.' });
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
    // Email Data
    const emailData = {
      from: 'noreply@nandu-node.com',
      to: email,
      subject: 'Password Reset Instructions',
      text: 'Click the provided link to reset your password.',
      html: `<h2>Please use the following link to reset your password:</h2>
      <p>${process.env.CLIENT_URL}/reset-password/${token}</p>`
    };
    return user.updateOne({ resetPasswordLink: token }, (err, success) => {
      if (err) {
        return res.json({ message: err });
      } else {
        sendEmail(emailData);
        return res.status(400).json({
          message: `Email has been sent to ${email}. Follow the instructions to reset your password.`
        });
      }
    });
  });
};

// to allow user to reset password
// first you will find the user in the database with user's resetPasswordLink
// user model's resetPasswordLink's value must match the token
// if the user's resetPasswordLink(token) matches the incoming req.body.resetPasswordLink(token)
// then we got the right user

exports.resetPassword = (req, res) => {
  const { resetPasswordLink, newPassword } = req.body;

  User.findOne({ resetPasswordLink }, (err, user) => {
    // if err or no user
    if (err || !user)
      return res.status('401').json({
        error: 'Invalid Link!'
      });

    const updatedFields = {
      password: newPassword,
      resetPasswordLink: ''
    };

    user = _.extend(user, updatedFields);
    user.updated = Date.now();

    user.save((err, result) => {
      if (err) {
        return res.status(400).json({
          error: err
        });
      }
      res.json({
        message: 'Password updated, Now you can login with your new password.'
      });
    });
  });
};
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
exports.socialLogin = (req, res) => {
  if (req.body.accessToken !== undefined) {
    //  FACEBOOK
    const { userID, accessToken } = req.body;
    const url = `https://graph.facebook.com/v2.11/${userID}/?fields=id,name,email&access_token=${accessToken}`;
    return fetch(url, {
      method: 'GET'
    })
      .then(response => response.json())
      .then(response => {
        console.log('FACEBOOK SUCCESS RESPONSE: ', response);
        const { email, name } = response;
        User.findOne({ email }).exec((err, user) => {
          if (err || !user) {
            // user with this email is not present in our DB therefore sign them up using facebook login
            let password = email + process.env.JWT_SECRET;
            user = new User({ name, email, password });
            req.profile = user;
            user.save((err, data) => {
              if (err) {
                return res.status(500).json({
                  error: err
                });
              }
              const token = jwt.sign(
                { _id: data._id },
                process.env.JWT_SECRET,
                {
                  expiresIn: '7d'
                }
              );
              const { _id, name, email } = data;
              return res.json({
                token,
                user: { _id, name, email }
              });
            });
          } else {
            // update existing user with new social info and login
            req.profile = user;
            user = _.extend(user, response);
            user.updated = Date.now();
            user.save((err, data) => {
              if (err) {
                return res.status(500).json({ error: err });
              }
              const token = jwt.sign(
                { _id: data._id },
                process.env.JWT_SECRET,
                {
                  expiresIn: '7d'
                }
              );
              const { _id, email, name } = data;
              return res.json({
                token,
                user: { _id, name, email }
              });
            });
          }
        });
      })
      .catch(err => console.log(err));
  } else {
    // GOOGLE
    const { tokenId, password } = req.body;
    client
      .verifyIdToken({
        tokenId,
        audience: process.env.GOOGLE_CLIENT_ID
      })
      .then(response => {
        console.log('RESPONSE BACKEND GOOGLE: ', response);
        const { email_verified, name, email } = response.payload;
        if (email_verified) {
          User.findOne({ email }, (err, user) => {
            if (err || !user) {
              user = new User({ name, email, password });
              req.profile = user;
              user.save();
              const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
              res.cookie('t', token, { expire: new Date() + 9999 });
              const { _id, name, email } = user;
              return res.json({ token, user: { _id, name, email } });
            } else {
              // update existing user with new social info and login
              req.profile = user;
              user = _.extend(user, { name, email, password });
              user.updated = Date.now();
              user.save();
              const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
              res.cookie('t', token, { expire: new Date() + 9999 });
              const { _id, name, email } = user;
              return res.json({ token, user: { _id, name, email } });
            }
          });
        } else {
          // if email wasn't verified
          return res.status(400).json({
            error: 'Google login failed. Try again.'
          });
        }
      })
      .catch(err => {
        return res.json({
          error: 'Request failed'
        });
      });
  }
};
