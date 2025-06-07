const router = require('express').Router()
const InboxController = require('../controllers/inboxController')

const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');

// Multer storage configuration (optional)
const storage = multer.memoryStorage(); // Store files in memory (can be changed to diskStorage)
const upload = multer({ storage: storage });

//Sửa 1 draft cũng chỉ là put method inbox


// URL sẽ là: /api/inboxes?keywords=your_search_term
router.patch('/inbox/:inboxId', authMiddleware, InboxController.updateInboxStatus)
router.put('/inbox/:inboxId', authMiddleware, InboxController.updateInbox); // Nếu isSent gửi là false thì update draft else => gửi inbox
router.get('/inbox/:inboxId', authMiddleware, InboxController.getInboxById); //authMiddleware
router.get('/inbox', authMiddleware, InboxController.getInboxes); //authMiddleware
router.post('/inbox', authMiddleware, InboxController.sendInbox); //authMiddleware

router.post('/upload', authMiddleware, upload.single('file') , InboxController.uploadAttachment);



module.exports = router;