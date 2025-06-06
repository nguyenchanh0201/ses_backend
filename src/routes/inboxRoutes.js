const router = require('express').Router()
const InboxController = require('../controllers/inboxController')
const StatusController = require('../controllers/statusController')
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');

// Multer storage configuration (optional)
const storage = multer.memoryStorage(); // Store files in memory (can be changed to diskStorage)
const upload = multer({ storage: storage });


router.post('/inbox/label', authMiddleware, StatusController.addLabelToInbox);

router.get('/inbox', authMiddleware, InboxController.getInboxes); //authMiddleware
router.post('/inbox', authMiddleware, InboxController.sendInbox); //authMiddleware

router.post('/upload', authMiddleware, upload.single('file') , InboxController.uploadAttachment);



module.exports = router;