// routes/tupadRoutes.js
import { Router } from 'express';
const router = Router();

import { applyTupad } from '../controllers/tupad.controller.js';
import auth from '../middlewares/auth.middleware.js';
import { validateTupad } from '../validators/tupad.validators.js';

router.post(
    '/apply/tupad',
    auth,
    validateTupad,
    applyTupad
);

export default router;