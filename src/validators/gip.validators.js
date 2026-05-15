export const safeTrim = (val) => (typeof val === 'string' ? val.trim() : '');

/**
 * Checks if a date string is valid and in the past
 */
export const isValidPastDate = (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && date < new Date();
};

/**
 * Calculates age based on a birth date string
 */
export const calculateAge = (birthDateString) => {
    const birthday = new Date(birthDateString);
    if (isNaN(birthday)) return null;

    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const m = today.getMonth() - birthday.getMonth();
    
    // Adjust if birthday hasn't happened yet this year
    if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
        age--;
    }
    return age;
};