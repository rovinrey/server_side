const attendanceService = require('../services/attendance.services');

const getUserIdFromRequest = (req) => {
  return Number(req.user?.id || req.query.userId || req.body?.userId || 0);
};

exports.getAttendanceRecords = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const records = await attendanceService.getAttendanceRecords(userId);
    res.status(200).json(records);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch attendance records.' });
  }
};

exports.getTodayAttendance = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await attendanceService.getTodayAttendance(userId);
    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch today attendance.' });
  }
};

exports.timeIn = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await attendanceService.timeIn(userId);
    res.status(200).json({ message: 'Timed in successfully.', ...result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Time in failed.' });
  }
};

exports.timeOut = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await attendanceService.timeOut(userId);
    res.status(200).json({ message: 'Timed out successfully.', ...result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Time out failed.' });
  }
};

exports.getMonitoringRecords = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 200);
    const records = await attendanceService.getMonitoringRecords(limit);
    res.status(200).json(records);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch attendance monitoring records.' });
  }
};

exports.getProgramAttendance = async (req, res) => {
  try {
    const { programType } = req.params;
    const { date } = req.query;
    if (!programType) {
      return res.status(400).json({ message: 'programType is required' });
    }
    const records = await attendanceService.getProgramAttendance(programType, date);
    res.status(200).json(records);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch program attendance.' });
  }
};

exports.adminMarkAttendance = async (req, res) => {
  try {
    const { userId, programType, date, status } = req.body;
    if (!userId || !programType || !status) {
      return res.status(400).json({ message: 'userId, programType, and status are required' });
    }
    if (!['Present', 'Absent'].includes(status)) {
      return res.status(400).json({ message: 'status must be Present or Absent' });
    }
    const result = await attendanceService.adminMarkAttendance(userId, programType, date, status);
    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to mark attendance.' });
  }
};
