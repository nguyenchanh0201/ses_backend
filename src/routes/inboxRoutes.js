const router = require('express').Router()
const InboxController = require('../controllers/inboxController')


router.get('/inbox/:userId', InboxController.getInboxes);

module.exports = router;