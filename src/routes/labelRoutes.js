const router = require('express').Router();
const LabelController = require('../controllers/labelController');
const StatusController = require('../controllers/statusController');
const authMiddleware = require('../middlewares/authMiddleware');


// POST /label -> Tạo một label mới
router.post("/label", authMiddleware, LabelController.createLabel);

// GET /label -> Lấy danh sách tất cả label
router.get("/label", authMiddleware, LabelController.getLabels);

// DELETE /label/:labelId -> Xóa một label theo ID
router.delete("/label/:labelId", authMiddleware, LabelController.deleteLabel);

// PUT /label/:labelId -> Cập nhật/đổi tên một label theo ID
router.put("/label/:labelId", authMiddleware, LabelController.renameLabel);


/* =================================================================
 * ROUTE CHO MỐI QUAN HỆ LABEL <-> INBOX
 * ================================================================= */

// POST /label/:labelId/inboxes -> Thêm một inbox vào một label cụ thể.
router.post(
    '/label/:labelId/inboxes',
    authMiddleware,
    StatusController.addInboxToLabel 
);

router.delete(
    '/label/:labelId/inboxes',
    authMiddleware,
    StatusController.removeInboxFromLabel
);


module.exports = router;