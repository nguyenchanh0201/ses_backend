const router = require('express').Router();
const inboxRoutes = require('./inboxRoutes');
const userRoutes = require('./userRoutes');
const authRoutes = require('./authRoutes');
const labelRoutes = require('./labelRoutes');

router.use(inboxRoutes);  
router.use(userRoutes);   
router.use(labelRoutes);
router.use(authRoutes);

module.exports = router;
