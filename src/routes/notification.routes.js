const express = require('express');
const cors = require('cors');
const router = express.Router();
router.use(cors());
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// All notification routes require authentication
router.get('/', authMiddleware, notificationController.getMyNotifications);
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);
router.patch('/:id/read', authMiddleware, notificationController.markAsRead);
router.patch('/read-all', authMiddleware, notificationController.markAllAsRead);

module.exports = router;
