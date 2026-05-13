import { getAttendanceRecords, getTodayAttendance, timeIn, timeOut, getMonitoringRecords, getProgramAttendance, adminMarkAttendance } from '../services/attendance.services.js';

const getUserIdFromRequest = (req) => {
  return Number(req.user?.id || req.query.userId || req.body?.userId || 0);
};

export async function handleGetAttendanceRecords(req, res) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const records = await getAttendanceRecords(userId);
    res.status(200).json(records);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch attendance records.' });
  }
}

export async function handleGetTodayAttendance(req, res) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await getTodayAttendance(userId);
    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch today attendance.' });
  }
}

export async function handleTimeIn(req, res) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await timeIn(userId);
    res.status(200).json({ message: 'Timed in successfully.', ...result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Time in failed.' });
  }
}

export async function handleTimeOut(req, res) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await timeOut(userId);
    res.status(200).json({ message: 'Timed out successfully.', ...result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Time out failed.' });
  }
}

export async function handleGetMonitoringRecords(req, res) {
  try {
    const limit = Number(req.query.limit || 200);
    const records = await getMonitoringRecords(limit);
    res.status(200).json(records);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch attendance monitoring records.' });
  }
}

export async function handleGetProgramAttendance(req, res) {
  try {
    const { programType } = req.params;
    const { date } = req.query;
    if (!programType) {
      return res.status(400).json({ message: 'programType is required' });
    }
    const records = await getProgramAttendance(programType, date);
    res.status(200).json(records);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to fetch program attendance.' });
  }
}

export async function handleAdminMarkAttendance(req, res) {
  try {
    const { userId, programType, date, status } = req.body;
    if (!userId || !programType || !status) {
      return res.status(400).json({ message: 'userId, programType, and status are required' });
    }
    if (!['Present', 'Absent'].includes(status)) {
      return res.status(400).json({ message: 'status must be Present or Absent' });
    }
    const result = await adminMarkAttendance(userId, programType, date, status);
    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || 'Failed to mark attendance.' });
  }
}
