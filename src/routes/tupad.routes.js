// routes/tupadRoutes.js
const express = require('express');
const cors = require('cors');
const router = express.Router();

const controller = require('../controllers/tupad.controller');
const auth = require('../middlewares/auth.middleware');
const { validateTupad } = require('../validators/tupad.validators');

router.post(
    '/apply/tupad',
    auth,
    validateTupad,
    controller.applyTupad
);

module.exports = router;