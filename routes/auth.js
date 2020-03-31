const express = require('express');
const {
  signup,
  signin,
  signout,
  forgotPassword,
  resetPassword,
  socialLogin
} = require('../controllers/auth');
const { userById } = require('../controllers/user');
const { userSignupValidator, passwordResetValidator } = require('../validator');

const router = express.Router();

router.post('/signup', userSignupValidator, signup);
router.post('/signin', signin);
router.get('/signout', signout);

// Route for social login
router.post('/social-login', socialLogin);

// password forgot and reset routes
router.put('/forgot-password', forgotPassword);
router.put('/reset-password', passwordResetValidator, resetPassword);

// we are looking for the parameter in the incoming request URL
/**Execute a method that will get the user information based on the userId, it will make a query to the DB.
 * Gets the user information from the Database.
 * And appends it to the request object.
 * Any route containing :userId, our app will first execute userById().
 */
router.param('userId', userById);

module.exports = router;
