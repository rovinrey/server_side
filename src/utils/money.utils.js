/**
 * Monetary helpers for payroll and payouts.
 * Amounts are handled in **minor units** (centavos) where possible to avoid JS binary floating-point drift.
 *
 * @module utils/money.utils
 */

/**
 * Parses a monetary value into integer minor units (e.g. PHP centavos).
 * Accepts strings like "435", "435.00", "1,234.50" or finite non-negative numbers (rounded to 2 decimals).
 *
 * @param {number|string|null|undefined} amount
 * @returns {number} Minor units (integer ≥ 0).
 * @throws {Error} If the value is missing, negative, or not parseable.
 */
function parseMoneyToMinorUnits(amount) {

    if (amount === null || amount === undefined || amount === '') {
        throw new Error('Amount is required');
    }
    if (typeof amount === 'number') {
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error('Amount must be a finite non-negative number');
        }
        return Math.round(amount * 100);
    }
    const s = String(amount).trim().replace(/,/g, '');
    if (!s.length) throw new Error('Amount is required');
    if (!/^\d+(\.\d*)?$/.test(s)) {
        throw new Error(`Invalid monetary format: ${amount}`);
    }
    const [whole, fracRaw = ''] = s.split('.');
    const frac = (fracRaw + '00').slice(0, 2);
    const minor = parseInt(whole, 10) * 100 + parseInt(frac, 10);
    if (!Number.isFinite(minor) || minor < 0) {
        throw new Error('Invalid monetary amount');
    }
    return minor;
}

/**
 * Converts minor units to a fixed two-decimal string suitable for SQL DECIMAL columns.
 *
 * @param {number} minorUnits
 * @returns {string}
 */
function minorUnitsToDecimalString(minorUnits) {
    if (!Number.isFinite(minorUnits) || minorUnits < 0 || !Number.isInteger(minorUnits)) {
        throw new Error('minorUnits must be a non-negative integer');
    }
    const whole = Math.floor(minorUnits / 100);
    const frac = minorUnits % 100;
    return `${whole}.${frac.toString().padStart(2, '0')}`;
}

/**
 * Computes **gross line payout**: days worked × daily wage, using integer arithmetic on minor units.
 *
 * @param {number|string} daysWorked Non-negative whole days.
 * @param {number|string} dailyWage Daily rate (same currency as payouts).
 * @returns {string} Total payout as a decimal string with two fractional digits.
 * @throws {Error} If inputs are invalid.
 */
function calculateLinePayout(daysWorked, dailyWage) {
    const days = typeof daysWorked === 'number' ? daysWorked : parseInt(String(daysWorked), 10);
    if (!Number.isFinite(days) || days < 0 || !Number.isInteger(days)) {
        throw new Error('daysWorked must be a non-negative integer');
    }
    const wageMinor = parseMoneyToMinorUnits(dailyWage);
    const totalMinor = days * wageMinor;
    return minorUnitsToDecimalString(totalMinor);
}

/**
 * Sums an array of monetary strings or numbers and returns a two-decimal string.
 * Uses minor-unit arithmetic per element.
 *
 * @param {(number|string)[]} parts
 * @returns {string}
 */
function sumMoneyParts(parts) {
    let sumMinor = 0;
    for (const p of parts) {
        sumMinor += parseMoneyToMinorUnits(p);
    }
    return minorUnitsToDecimalString(sumMinor);
}

/**
 * Validates and normalizes a non-negative money amount for persistence (two decimal string).
 *
 * @param {number|string} amount
 * @returns {string}
 */
function normalizeMoneyString(amount) {
    return minorUnitsToDecimalString(parseMoneyToMinorUnits(amount));
}

export { 

    parseMoneyToMinorUnits,
    minorUnitsToDecimalString,
    calculateLinePayout,
    sumMoneyParts,
    normalizeMoneyString,
};
