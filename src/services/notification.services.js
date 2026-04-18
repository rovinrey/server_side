const db = require('../../config');

/**
 * Create a notification for ALL beneficiaries (broadcast).
 * Inserts one row per beneficiary user.
 * Handles large batch inserts efficiently.
 */
const notifyAllBeneficiaries = async ({ title, message, type, program_id }) => {
    // Validate required fields
    if (!title || !message) {
        throw new Error('Title and message are required for notifications');
    }

    const [beneficiaries] = await db.execute(
        "SELECT user_id FROM users WHERE role = 'beneficiary' AND user_id IS NOT NULL"
    );

    if (beneficiaries.length === 0) {
        console.warn('No beneficiaries found for notification broadcast');
        return;
    }

    // For large batches, insert in chunks to avoid query size limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < beneficiaries.length; i += BATCH_SIZE) {
        const batch = beneficiaries.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const values = batch.flatMap((b) => [
            b.user_id, title, message, type || 'info', program_id || null
        ]);

        await db.execute(
            `INSERT INTO notifications (user_id, title, message, type, program_id) VALUES ${placeholders}`,
            values
        );
    }
};

/**
 * Get all notifications for a specific user, newest first.
 * Note: LIMIT and OFFSET must be literal values, not parameterized.
 */
const getUserNotifications = async (userId, { limit = 20, offset = 0 } = {}) => {
    if (!userId) {
        throw new Error('User ID is required');
    }
    
    // Ensure limit and offset are positive integers with safe bounds
    const safeLimit = Math.max(1, Math.min(parseInt(limit) || 20, 100));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    const [rows] = await db.execute(
        `SELECT n.notification_id, n.title, n.message, n.type, n.is_read, n.created_at,
                n.program_id, p.program_name, p.status AS program_status, p.start_date, p.end_date
         FROM notifications n
         LEFT JOIN programs p ON n.program_id = p.program_id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [userId]
    );
    return rows || [];
};

/**
 * Get unread notification count for a user.
 */
const getUnreadCount = async (userId) => {
    if (!userId) throw new Error('User ID is required');
    
    const [rows] = await db.execute(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
    );
    return rows[0]?.count || 0;
};

/**
 * Mark a single notification as read.
 */
const markAsRead = async (notificationId, userId) => {
    if (!notificationId || !userId) {
        throw new Error('Notification ID and User ID are required');
    }
    
    const [result] = await db.execute(
        'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
        [notificationId, userId]
    );
    return result.affectedRows > 0;
};

/**
 * Mark all notifications as read for a user.
 */
const markAllAsRead = async (userId) => {
    if (!userId) {
        throw new Error('User ID is required');
    }
    
    await db.execute(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId]
    );
};

module.exports = {
    notifyAllBeneficiaries,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
};
