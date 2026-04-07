// spes data validators 
exports.validatedSpes = (req, res, next) => {
    const { place_of_birth, citizenship, sex, type_of_student, parent_status, education_level, present_address, permanent_address } = req.body;

    if (!sex || !['Male', 'Female'].includes(sex)) {
        return res.status(400).json({ message: 'Sex must be Male or Female' });
    }

    if (!type_of_student) {
        return res.status(400).json({ message: 'Type of student is required' });
    }

    if (!parent_status) {
        return res.status(400).json({ message: 'Parent status is required' });
    }

    if (!education_level) {
        return res.status(400).json({ message: 'Education level is required' });
    }

    next();
};