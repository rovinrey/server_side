import { Router } from 'express';
const router = Router();
import authMiddleware from '../middlewares/auth.middleware.js';
import {
  handleGetAttendanceRecords,
  handleGetMonitoringRecords,
  handleGetProgramAttendance,
  handleGetTodayAttendance,
  handleTimeIn,
  handleTimeOut,
  handleAdminMarkAttendance,
} from '../controllers/attendance.controller.js';

router.get('/', authMiddleware, handleGetAttendanceRecords);
router.get('/monitoring', authMiddleware, handleGetMonitoringRecords);
router.get('/program/:programType', authMiddleware, handleGetProgramAttendance);
router.get('/today', authMiddleware, handleGetTodayAttendance);
router.post('/time-in', authMiddleware, handleTimeIn);
router.post('/time-out', authMiddleware, handleTimeOut);
router.post('/mark', authMiddleware, handleAdminMarkAttendance);


export default router;
