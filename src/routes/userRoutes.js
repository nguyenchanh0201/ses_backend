const router = require('express').Router()

//Cần validate nữa 

const AuthController = require('../controllers/authController');

router.post('/auth/signup', AuthController.signUp);
router.post('/auth/signin', AuthController.signIn);

module.exports = router; 