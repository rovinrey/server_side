// controllers/tupad.controller.js
const tupadService = require('../services/tupad.services');

exports.applyTupad = async (req, res) => {
    try {
        const data = req.body;
        if (!data.user_id && req.user?.id) {
            data.user_id = req.user.id;
        }

        const result = await tupadService.applyTupad(data);
        res.status(200).json({ message: 'TUPAD application submitted', application_id: result.application_id });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Something went wrong' });
    }
};