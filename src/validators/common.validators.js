/**
 * Common validation helpers shared across all validators.
 * Keeps per-program validators lean and DRY.
 */

const VALID_PROGRAMS = ['tupad', 'spes', 'dilp', 'gip', 'job_seekers'];
const VALID_GENDERS = ['Male', 'Female', 'Other'];
const VALID_CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'];
const VALID_APPLICATION_STATUSES = ['Pending', 'Approved', 'Rejected'];

const PHONE_REGEX = /^\+?[\d\s()-]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim a value safely, returning null for falsy inputs */
const safeTrim = (val) => (val != null ? String(val).trim() : null);

/** Parse integer safely, NaN → null */
const safeInt = (val) => {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
};

/** Parse float safely, NaN → null */
const safeFloat = (val) => {
    const n = parseFloat(val);
    return Number.isNaN(n) ? null : n;
};

/** Calculate age from a birth date string */
const calculateAge = (birthDateValue) => {
    const birthDate = new Date(birthDateValue);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
    return age;
};

/** Validate that a date string is valid and not in the future */
const isValidPastDate = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    return d <= new Date();
};

/** Validate contact number format */
const isValidPhone = (phone) => {
    if (!phone) return false;
    const trimmed = String(phone).trim();
    const digitsOnly = trimmed.replace(/\D/g, '');
    return PHONE_REGEX.test(trimmed) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
};

/** Validate email format */
const isValidEmail = (email) => {
    if (!email) return false;
    return EMAIL_REGEX.test(String(email).trim());
};

/**
 * Middleware: require admin role
 */
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

/**
 * Middleware: require admin or staff role
 */
const requireAdminOrStaff = (req, res, next) => {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'staff') {
        return res.status(403).json({ message: 'Admin or staff access required' });
    }
    next();
};

/**
 * Middleware: validate numeric param is a positive integer
 */
const validateIdParam = (paramName) => (req, res, next) => {
    const val = safeInt(req.params[paramName]);
    if (!val || val < 1) {
        return res.status(400).json({ message: `${paramName} must be a positive integer` });
    }
    next();
};

module.exports = {
    VALID_PROGRAMS,
    VALID_GENDERS,
    VALID_CIVIL_STATUSES,
    VALID_APPLICATION_STATUSES,
    PHONE_REGEX,
    EMAIL_REGEX,
    safeTrim,
    safeInt,
    safeFloat,
    calculateAge,
    isValidPastDate,
    isValidPhone,
    isValidEmail,
    requireAdmin,
    requireAdminOrStaff,
    validateIdParam,
};
