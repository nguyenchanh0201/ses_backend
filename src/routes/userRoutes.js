const router = require('express').Router()

const authMiddleware = require('../middlewares/authMiddleware')

//Cần validate nữa 

const AuthController = require('../controllers/userController');

router.post('/user/password', authMiddleware, AuthController.changePassword)
router.get('/user', authMiddleware, AuthController.getProfile)



module.exports = router; 