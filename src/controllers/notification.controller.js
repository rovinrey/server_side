import { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../services/notification.services.js';

export async function handleGetMyNotifications(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User ID not found in token' });
        }

        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const notifications = await getUserNotifications(userId, { limit, offset });
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error.message);
        res.status(500).json({ message: 'Error fetching notifications', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
}

export async function handleGetUnreadCount(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User ID not found in token' });
        }
        
        const count = await getUnreadCount(userId);
        res.json({ count: count || 0 });
    } catch (error) {
        console.error('Error fetching unread count:', error.message);
        res.status(500).json({ message: 'Error fetching unread count' });
    }
}

export async function handleMarkAsRead(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ message: 'User ID not found in token' });
        }
        
        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'Invalid notification ID' });
        }

        const updated = await markAsRead(id, userId);

        if (!updated) {
            return res.status(404).json({ message: 'Notification not found or already read' });
        }

        res.json({ message: 'Marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error.message);
        res.status(500).json({ message: 'Error marking notification as read' });
    }
}

export async function handleMarkAllAsRead(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User ID not found in token' });
        }

        await markAllAsRead(userId);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error.message);
        res.status(500).json({ message: 'Error marking all as read' });
    }
}
