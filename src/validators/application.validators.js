const { body, validationResult } = require("express-validator");

// validation rules for TUPAD application
exports.validateTupadApplication = [
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('date_of_birth').isDate().withMessage('Date of birth must be a valid date'),
    body('age').isInt({ min: 18 }).withMessage('Age must be at least 18'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
    body('civil_status').isIn(['Single', 'Married', 'Widowed', 'Divorced']).withMessage('Civil status must be Single, Married, Widowed, or Divorced'),
    body('contact_number').notEmpty().withMessage('Contact number is required'),    
    body('occupation').notEmpty().withMessage('Occupation is required'),
    body('monthly_income').isFloat({ min: 0 }).withMessage('Monthly income must be a positive number'),
    body('valid_id_type').notEmpty().withMessage('Valid ID type is required'),  

    (req, res, next) => {
        const errors = validationResult(req);   
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }     next();   
    }
];