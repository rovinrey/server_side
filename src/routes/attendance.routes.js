const express = require('express');
const cors = require('cors');
const router = express.Router();
router.use(cors());
const authMiddleware = require('../middlewares/auth.middleware');
const attendanceController = require('../controllers/attendance.controller');

router.get('/', authMiddleware, attendanceController.getAttendanceRecords);
router.get('/monitoring', authMiddleware, attendanceController.getMonitoringRecords);
router.get('/program/:programType', authMiddleware, attendanceController.getProgramAttendance);
router.get('/today', authMiddleware, attendanceController.getTodayAttendance);
router.post('/time-in', authMiddleware, attendanceController.timeIn);
router.post('/time-out', authMiddleware, attendanceController.timeOut);
router.post('/mark', authMiddleware, attendanceController.adminMarkAttendance);

module.exports = router;
