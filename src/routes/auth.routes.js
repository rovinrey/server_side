const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateSignup, validateLogin } = require('../validators/auth.validators');

router.post('/signup', validateSignup, authController.signup);
router.post('/login', validateLogin, authController.login);
router.get('/getProfile', authMiddleware, authController.getProfile);

module.exports = router;