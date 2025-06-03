const router = require('express').Router()
const LabelController = require('../controllers/labelController')

const authMiddleware = require('../middlewares/authMiddleware')

router.use('/label', authMiddleware);

router.post("/label", LabelController.createLabel);
router.get("/label", LabelController.getLabels);
router.delete("/label/:labelId", LabelController.deleteLabel);
router.delete("/label/:labelId", LabelController.deleteLabel);


module.exports = router ;