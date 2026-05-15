const beforeAfterService = require('../services/beforeAfter.reports.services');

exports.exportLiquidationBeforeAfterWord = async (req, res) => {
  try {
    const buffer = await beforeAfterService.buildLiquidationBeforeAfterWord(req.body);
    const filename = buffer.filename || `BeforeAfter_Liquidation_Accomplishment_${new Date().toISOString().slice(0, 10)}.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  } catch (error) {
    console.error('Before/After Word export error:', error);
    res.status(500).json({ message: error?.message || 'Error exporting Word report' });
  }
};

exports.exportLiquidationBeforeAfterExcel = async (req, res) => {
  try {
    await beforeAfterService.buildLiquidationBeforeAfterExcel(req.body, res);
  } catch (error) {
    console.error('Before/After Excel export error:', error);
    res.status(500).json({ message: error?.message || 'Error exporting Excel report' });
  }
};

