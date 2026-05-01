const programService = require('../services/programs.services');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdminOrStaff } = require('../validators/common.validators');

exports.getAllPrograms = async (req, res) => {
  try {
    const programs = await programService.getAllPrograms();
    res.json(programs);
  } catch (error) {
    console.error('Programs list error:', error.message);
    res.status(500).json({ message: 'Error fetching programs' });
  }
};

exports.getProgramStats = async (req, res) => {
  try {
    const { programId } = req.params;
    const stats = await programService.getProgramStats(programId);
    res.json(stats);
  } catch (error) {
    console.error('Program stats error:', error.message);
    res.status(500).json({ message: 'Error fetching program stats' });
  }
};
