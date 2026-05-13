import { Router } from 'express';
const router = Router();
import { getAllPrograms, getReadyPrograms, getActiveByType, getProgram, createProgram, updateProgram, deleteProgram } from '../controllers/program.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateProgram, validateBudgetUpdate } from '../validators/program.validators.js';

// programs

// Get all programs (authenticated users)
router.get('/allPrograms', authMiddleware, getAllPrograms);

// Get READY programs for beneficiary dashboard
// NOTE: must be defined before "/:program_id" to avoid being treated as an id param.
router.get('/ready', authMiddleware, getReadyPrograms);

// Get active programs by type (for beneficiary program picker)
router.get('/active/:programType', authMiddleware, getActiveByType);

// Get a single program
router.get('/:program_id', authMiddleware, getProgram);

// Create a new program (admin only — controller verifies role + validator checks data)
router.post('/', authMiddleware, validateProgram, createProgram);

// Update a program (validator ensures budget ≥ used)
router.put('/:program_id', authMiddleware, validateProgram, validateBudgetUpdate, updateProgram);

// Delete a program
router.delete('/:program_id', authMiddleware, deleteProgram);

export default router;
