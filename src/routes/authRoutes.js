const router = require('express').Router()

//Cần validate nữa 

const AuthController = require('../controllers/authController');

router.post('/auth/signup', AuthController.signUp);
router.post('/auth/signin', AuthController.signIn);
router.post('/auth/verify', AuthController.checkOTP);
router.post('/auth/forgot', AuthController.requestforgotPassword);
router.post('/auth/resend', AuthController.resendOTP);

module.exports = router; 