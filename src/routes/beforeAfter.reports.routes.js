const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdminOrStaff } = require('../validators/common.validators');

const beforeAfterController = require('../controllers/beforeAfter.reports.controller');

router.post(
  '/export/before-after/liquidation-accomplishment-word',
  authMiddleware,
  requireAdminOrStaff,
  beforeAfterController.exportLiquidationBeforeAfterWord
);

router.post(
  '/export/before-after/liquidation-accomplishment-excel',
  authMiddleware,
  requireAdminOrStaff,
  beforeAfterController.exportLiquidationBeforeAfterExcel
);

module.exports = router;


