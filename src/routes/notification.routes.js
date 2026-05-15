import { Router } from 'express';
const router = Router();
import {
  handleGetMyNotifications,
  handleGetUnreadCount,
  handleMarkAsRead,
  handleMarkAllAsRead,
} from '../controllers/notification.controller.js';

import authMiddleware from '../middlewares/auth.middleware.js';

// All notification routes require authentication
router.get('/', authMiddleware, handleGetMyNotifications);
router.get('/unread-count', authMiddleware, handleGetUnreadCount);
router.patch('/:id/read', authMiddleware, handleMarkAsRead);
router.patch('/read-all', authMiddleware, handleMarkAllAsRead);


export default router;
