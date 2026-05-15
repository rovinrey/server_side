const ExcelJS = require('exceljs');
const { Packer, Document, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } = require('docx');

const validatePayload = (payload) => {
  const errors = [];
  const mustStr = (k) => {
    if (!payload?.[k] || typeof payload[k] !== 'string') errors.push(`${k} is required`);
  };

  mustStr('program_type');
  mustStr('program_name');
  mustStr('location');
  mustStr('gps');

  const mustTimeline = (section, label) => {
    if (!payload?.[section]) errors.push(`${label} timeline is required`);
    else {
      if (!payload[section]?.date || typeof payload[section]?.date !== 'string') errors.push(`${label}.date is required`);
      if (!payload[section]?.description || typeof payload[section]?.description !== 'string') errors.push(`${label}.description is required`);
    }
  };

  mustTimeline('before', 'Before');
  mustTimeline('during', 'During');
  mustTimeline('after', 'After');

  const mustPhotos = (section) => {
    const arr = payload?.[section];
    if (!Array.isArray(arr)) return;
    // Each photo must have url and caption
    arr.forEach((p, idx) => {
      if (!p?.url || typeof p.url !== 'string') errors.push(`${section}[${idx}].url is required`);
      if (!p?.caption || typeof p.caption !== 'string') errors.push(`${section}[${idx}].caption is required`);
    });
  };

  mustPhotos('before_photos');
  mustPhotos('during_photos');
  mustPhotos('after_photos');

  return errors;
};

const safeText = (v) => (v === undefined || v === null ? '' : String(v));

const addPhotoCaptionsToDoc = (sectionTitle, photos) => {
  const runs = [
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: sectionTitle, bold: true })] }),
  ];

  const items = Array.isArray(photos) ? photos : [];
  if (items.length === 0) {
    runs.push(new Paragraph({ children: [new TextRun({ text: 'No photo documentation provided.', italics: true })] }));
    return runs;
  }

  items.forEach((p, idx) => {
    runs.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `${idx + 1}. ${p.caption}`, italics: true, size: 18 }),
        ],
      })
    );

    // Embedding images from remote URLs requires fetching bytes.
    // To keep this working without external fetch logic, we only include captions.
  });

  return runs;
};

exports.buildLiquidationBeforeAfterWord = async (payload) => {
  const validationErrors = validatePayload(payload);
  if (validationErrors.length > 0) {
    const err = new Error(validationErrors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  const filename = `BeforeAfter_Liquidation_Accomplishment_${new Date().toISOString().slice(0, 10)}.docx`;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'DOLE LIQUIDATION ACCOMPLISHMENT REPORT', bold: true, size: 24 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `${safeText(payload.program_type).toUpperCase()} | ${safeText(payload.program_name)}\n${safeText(payload.location)}`,
                italics: true,
                size: 18,
              }),
            ],
          }),

          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'GPS / Location', bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: safeText(payload.gps), size: 18 })] }),

          new Paragraph({ spacing: { after: 200 } }),

          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'BEFORE', bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Date: ${payload.before.date}`, bold: true, size: 18 })] }),
          new Paragraph({ children: [new TextRun({ text: safeText(payload.before.description), size: 18 })] }),
          ...addPhotoCaptionsToDoc('Photo Documentation (Before)', payload.before_photos),

          new Paragraph({ spacing: { after: 200 } }),

          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'DURING', bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Date: ${payload.during.date}`, bold: true, size: 18 })] }),
          new Paragraph({ children: [new TextRun({ text: safeText(payload.during.description), size: 18 })] }),
          ...addPhotoCaptionsToDoc('Photo Documentation (During)', payload.during_photos),

          new Paragraph({ spacing: { after: 200 } }),

          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'AFTER', bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Date: ${payload.after.date}`, bold: true, size: 18 })] }),
          new Paragraph({ children: [new TextRun({ text: safeText(payload.after.description), size: 18 })] }),
          ...addPhotoCaptionsToDoc('Photo Documentation (After)', payload.after_photos),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),
          new Paragraph({
            spacing: { after: 80 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Prepared by: _______________________________', size: 18 }),],
          }),
        ],
      },
    ],
  });

  const docBuf = await Packer.toBuffer(doc);
  docBuf.filename = filename;
  return docBuf;
};

const landscapeSetup = {
  paperSize: 9,
  orientation: 'landscape',
  fitToPage: true,
  fitToWidth: 1,
  margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
};

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const THIN_BORDER = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

const formatCellBorder = (cell) => {
  cell.border = THIN_BORDER;
};

exports.buildLiquidationBeforeAfterExcel = async (payload, res) => {
  const validationErrors = validatePayload(payload);
  if (validationErrors.length > 0) {
    return res.status(400).json({ message: validationErrors.join('; ') });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PESO Juban Management System';
  const ws = wb.addWorksheet('Before-After', { pageSetup: landscapeSetup });

  let row = 1;
  ws.getCell(`A${row}`).value = 'DOLE LIQUIDATION ACCOMPLISHMENT REPORT';
  ws.getCell(`A${row}`).font = { bold: true, size: 16 };
  ws.mergeCells(`A${row}:G${row}`);
  row++;

  ws.getCell(`A${row}`).value = `${payload.program_type.toUpperCase()} | ${payload.program_name}`;
  ws.getCell(`A${row}`).font = { italics: true, size: 11 };
  ws.mergeCells(`A${row}:G${row}`);
  row++;

  ws.getCell(`A${row}`).value = `Location: ${payload.location}`;
  ws.getCell(`A${row}`).font = { size: 11 };
  ws.mergeCells(`A${row}:G${row}`);
  row++;

  ws.getCell(`A${row}`).value = `GPS: ${payload.gps}`;
  ws.getCell(`A${row}`).font = { size: 11 };
  ws.mergeCells(`A${row}:G${row}`);
  row += 2;

  const renderSection = (title, timeline, photos) => {
    ws.getCell(`A${row}`).value = title;
    ws.getCell(`A${row}`).font = { bold: true, size: 13 };
    ws.mergeCells(`A${row}:G${row}`);
    row++;

    const dateCell = ws.getCell(`A${row}`);
    dateCell.value = `Date: ${timeline.date}`;
    dateCell.font = { bold: true, size: 11 };
    ws.mergeCells(`A${row}:G${row}`);
    row++;

    const descCell = ws.getCell(`A${row}`);
    descCell.value = `Description: ${timeline.description}`;
    descCell.font = { size: 11 };
    ws.mergeCells(`A${row}:G${row}`);
    row += 2;

    // Photo captions table
    ws.getCell(`A${row}`).value = 'Photo Documentation (captions)';
    ws.getCell(`A${row}`).font = { bold: true, size: 11 };
    ws.mergeCells(`A${row}:G${row}`);
    row++;

    const headers = ['#', 'Caption', 'URL'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10 };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      formatCellBorder(cell);
    });
    ws.getRow(row).height = 20;
    row++;

    const list = Array.isArray(photos) ? photos : [];
    if (list.length === 0) {
      const cell = ws.getCell(row, 1);
      cell.value = 'No photos provided.';
      ws.mergeCells(`A${row}:G${row}`);
      row += 2;
      return;
    }

    list.forEach((p, idx) => {
      const r = ws.getRow(row);
      r.getCell(1).value = idx + 1;
      r.getCell(2).value = p.caption || '';
      r.getCell(3).value = p.url || '';
      r.getCell(1).font = { size: 9 };
      r.getCell(2).font = { size: 9 };
      r.getCell(3).font = { size: 9 };
      r.eachCell({ includeEmpty: false }, (c) => {
        c.alignment = { vertical: 'top', wrapText: true };
        formatCellBorder(c);
      });
      row++;
    });

    row += 1;
  };

  renderSection('BEFORE', payload.before, payload.before_photos);
  renderSection('DURING', payload.during, payload.during_photos);
  renderSection('AFTER', payload.after, payload.after_photos);

  // columns
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 35;
  ws.getColumn(3).width = 35;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const filename = `BeforeAfter_Liquidation_Accomplishment_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
};

