exports.validatedSpes = (req, res, next) => {
    const { 
        date_of_birth, 
        sex, 
        type_of_student, 
        parent_status, 
        education_level,
        place_of_birth,
        citizenship
    } = req.body;

    // 1. Basic Presence Checks
    const requiredFields = [
        'place_of_birth', 'citizenship', 'sex', 
        'type_of_student', 'parent_status', 'education_level'
    ];
    
    for (const field of requiredFields) {
        if (!req.body[field]) {
            return res.status(400).json({ message: `${field.replace(/_/g, ' ')} is required` });
        }
    }

    // 2. Enum Validation
    if (!['Male', 'Female'].includes(sex)) {
        return res.status(400).json({ message: 'Sex must be Male or Female' });
    }

    // 3. Robust Age Validation
    if (!date_of_birth) {
        return res.status(400).json({ message: 'Date of birth is required' });
    }

    const validateAge = (dob) => {
        const today = new Date();
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const age = validateAge(date_of_birth);
    
    // SPES typical age range is 15-25
    if (age < 15 || age > 25) {
        return res.status(400).json({ 
            message: `Ineligible: Age must be between 15 and 25. Current age: ${age}` 
        });
    }

    // 4. Address Object Validation (Optional but recommended)
    if (typeof req.body.present_address !== 'object') {
        return res.status(400).json({ message: 'Present address must be a valid object' });
    }


    // check if the student average is pass or failed
    if (req.body.student_average !== undefined) {
        const average = parseFloat(req.body.student_average);
        if (isNaN(average) || average < 0 || average > 100) {
            return res.status(400).json({ message: 'Student average must be a number between 0 and 100' });
        }   else if (average < 75) {
            return res.status(400).json({ message: 'Ineligible: Student average must be at least 75' });
        }
    }


    next();
};