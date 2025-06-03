const router = require('express').Router()
const InboxController = require('../controllers/inboxController')
const authMiddleware = require('../middlewares/authMiddleware')


router.get('/inbox', InboxController.getInboxes); //authMiddleware
router.post('/inbox', InboxController.sendInbox); //authMiddleware



module.exports = router;