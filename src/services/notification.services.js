const db = require('../../db');

/**
 * Create a notification for ALL beneficiaries (broadcast).
 * Inserts one row per beneficiary user.
 */
const notifyAllBeneficiaries = async ({ title, message, type, program_id }) => {
    const [beneficiaries] = await db.execute(
        "SELECT user_id FROM users WHERE role = 'beneficiary'"
    );

    if (beneficiaries.length === 0) return;

    const placeholders = beneficiaries.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const values = beneficiaries.flatMap((b) => [
        b.user_id, title, message, type, program_id || null
    ]);

    await db.execute(
        `INSERT INTO notifications (user_id, title, message, type, program_id) VALUES ${placeholders}`,
        values
    );
};

/**
 * Get all notifications for a specific user, newest first.
 */
const getUserNotifications = async (userId, { limit = 20, offset = 0 } = {}) => {
    const [rows] = await db.execute(
        `SELECT n.notification_id, n.title, n.message, n.type, n.is_read, n.created_at,
                n.program_id, p.program_name, p.status AS program_status, p.start_date, p.end_date
         FROM notifications n
         LEFT JOIN programs p ON n.program_id = p.program_id
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );
    return rows;
};

/**
 * Get unread notification count for a user.
 */
const getUnreadCount = async (userId) => {
    const [rows] = await db.execute(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
    );
    return rows[0].count;
};

/**
 * Mark a single notification as read.
 */
const markAsRead = async (notificationId, userId) => {
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
