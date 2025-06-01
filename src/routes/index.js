const router = require('express').Router();
const inboxRoutes = require('./inboxRoutes');
const userRoutes = require('./userRoutes');

router.use(inboxRoutes);  
// router.use(userRoutes);   

module.exports = router;
