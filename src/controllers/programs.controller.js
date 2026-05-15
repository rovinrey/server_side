import { getAllPrograms, getProgramStats } from '../services/programs.services';
import authMiddleware from '../middlewares/auth.middleware';
import { requireAdminOrStaff } from '../validators/common.validators';

export async function getAllPrograms(req, res) {
  try {
    const programs = await getAllPrograms();
    res.json(programs);
  } catch (error) {
    console.error('Programs list error:', error.message);
    res.status(500).json({ message: 'Error fetching programs' });
  }
}

export async function getProgramStats(req, res) {
  try {
    const { programId } = req.params;
    const stats = await getProgramStats(programId);
    res.json(stats);
  } catch (error) {
    console.error('Program stats error:', error.message);
    res.status(500).json({ message: 'Error fetching program stats' });
  }
}
