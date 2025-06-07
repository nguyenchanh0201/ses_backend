const router = require('express').Router()

const authMiddleware = require('../middlewares/authMiddleware')

//Cần validate nữa 

const UserController = require('../controllers/userController');

router.get('/user/settings', authMiddleware, UserController.getUserSettings) // Get user settings

router.put('/user/settings/2fa', authMiddleware, UserController.updateSettings) 

router.put('/user/settings/autoreply', authMiddleware, UserController.updateAutoReply)

router.post('/user/settings/password', authMiddleware, UserController.changePassword)




router.get('/user', authMiddleware, UserController.getProfile)
router.put('/user', authMiddleware, UserController.updateProfile)



module.exports = router; 