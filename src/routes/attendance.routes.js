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

<<<<<<< HEAD
router.get('/', authMiddleware, attendanceController.getAttendanceRecords);
router.get('/monitoring', authMiddleware, attendanceController.getMonitoringRecords);
router.get('/program/id/:programId', authMiddleware, attendanceController.getProgramAttendanceById);
router.get('/program/:programType', authMiddleware, attendanceController.getProgramAttendance);
router.get('/today', authMiddleware, attendanceController.getTodayAttendance);
router.post('/time-in', authMiddleware, attendanceController.timeIn);
router.post('/time-out', authMiddleware, attendanceController.timeOut);
router.post('/mark', authMiddleware, attendanceController.adminMarkAttendance);
=======
router.get('/', authMiddleware, handleGetAttendanceRecords);
router.get('/monitoring', authMiddleware, handleGetMonitoringRecords);
router.get('/program/:programType', authMiddleware, handleGetProgramAttendance);
router.get('/today', authMiddleware, handleGetTodayAttendance);
router.post('/time-in', authMiddleware, handleTimeIn);
router.post('/time-out', authMiddleware, handleTimeOut);
router.post('/mark', authMiddleware, handleAdminMarkAttendance);
>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7


export default router;
