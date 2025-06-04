const router = require('express').Router();
const inboxRoutes = require('./inboxRoutes');
const userRoutes = require('./userRoutes');
const labelRoutes = require('./labelRoutes');

router.use(inboxRoutes);  
router.use(userRoutes);   
router.use(labelRoutes);

module.exports = router;
