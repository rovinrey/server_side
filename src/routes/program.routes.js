const express = require('express');
const router = express.Router();
const programController = require('../controllers/program.controller');

// Create a new program
router.post('/', programController.createProgram);

// Get all programs
router.get('/allPrograms', programController.getAllPrograms);

// Get a single program
router.get('/:program_id', programController.getProgram);

// Update a program
router.put('/:program_id', programController.updateProgram);

// Delete a program
router.delete('/:program_id', programController.deleteProgram);

module.exports = router;
