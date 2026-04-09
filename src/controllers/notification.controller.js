const notificationService = require('../services/notification.services');

exports.getMyNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const notifications = await notificationService.getUserNotifications(userId, { limit, offset });
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Error fetching unread count' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await notificationService.markAsRead(id, req.user.id);

        if (!updated) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ message: 'Marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error marking notification as read' });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await notificationService.markAllAsRead(req.user.id);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ message: 'Error marking all as read' });
    }
};
