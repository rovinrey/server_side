// ── TUPAD Beneficiaries Excel Export ───────────────
export async function exportTupadBeneficiariesExcel(req, res) {
    try {
        // Only TUPAD program
        const data = await getBeneficiaryMasterList('tupad', null);
        const rows = data.beneficiaries;

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('TUPAD Beneficiaries', { pageSetup: landscapeSetup });

        let row = addTitle(ws, 'TUPAD BENEFICIARIES LIST', 'Program: TUPAD', 27);

        const headers = [
            { header: 'Application ID', width: 12 },
            { header: 'User ID', width: 10 },
            { header: 'Program Type', width: 12 },
            { header: 'Application Status', width: 14 },
            { header: 'First Name', width: 14 },
            { header: 'Middle Name', width: 14 },
            { header: 'Last Name', width: 14 },
            { header: 'Extension Name', width: 10 },
            { header: 'Birth Date', width: 12 },
            { header: 'Age', width: 6 },
            { header: 'Gender', width: 8 },
            { header: 'Civil Status', width: 12 },
            { header: 'Contact Number', width: 14 },
            { header: 'Street/Zone', width: 14 },
            { header: 'Barangay', width: 14 },
            { header: 'City/Municipality', width: 16 },
            { header: 'Province', width: 14 },
            { header: 'District', width: 10 },
            { header: 'ID Type', width: 10 },
            { header: 'ID Number', width: 14 },
            { header: 'ePayment Account No.', width: 18 },
            { header: 'Beneficiary Type', width: 14 },
            { header: 'Occupation', width: 14 },
            { header: 'Avg Monthly Income', width: 16 },
            { header: 'Dependent Count', width: 10 },
            { header: 'Interested in Employment', width: 14 },
            { header: 'Skills Training Needed', width: 16 },
        ];
        row = addHeaderRow(ws, row, headers);

        rows.forEach((b) => {
            row = addDataRow(ws, row, [
                b.application_id,
                b.user_id,
                b.program_type,
                b.application_status,
                b.first_name,
                b.middle_name,
                b.last_name,
                b.extension_name,
                formatDate(b.birth_date),
                b.age,
                b.gender,
                b.civil_status,
                b.contact_number,
                b.street_zone,
                b.barangay,
                b.city_municipality,
                b.province,
                b.district,
                b.id_type,
                b.id_number,
                b.epayment_account_no,
                b.beneficiary_type,
                b.occupation,
                b.avg_monthly_income,
                b.dependent_count,
                b.is_interested_in_employment,
                b.skills_training_needed,
            ]);
        });

        addSignatureBlock(ws, row);
        const filename = `TUPAD_Beneficiaries_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export TUPAD beneficiaries error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting TUPAD beneficiaries' });
    }
}
import ExcelJS from 'exceljs';
const { Workbook } = ExcelJS;

import { getBeneficiaryMasterList, getSummaryReport, getProgramAccomplishment, getPayrollSummary, getAttendanceSummary, getDilpMonitoringReport, getEmploymentFacilitationReport, getSpesReport, getGipReport, getConsolidatedReport } from '../services/reports.services.js';

// ── Shared Excel helpers ─────────────────────────────

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
const THIN_BORDER = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
};

const headerFont = { bold: true, size: 9, name: 'Arial' };
const dataFont = { size: 9, name: 'Arial' };
const titleFont = { bold: true, size: 14, name: 'Arial' };
const subtitleFont = { bold: true, size: 11, name: 'Arial' };

const formatPeso = (amount) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(amount || 0);

const formatDate = (val) => {
    if (!val) return 'N/A';
    const d = new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
};

const formatPercent = (val) => `${(val || 0).toFixed(2)}%`;

const addTitle = (ws, title, subtitle, colCount) => {
    const lastCol = String.fromCharCode(64 + Math.min(colCount, 26));
    ws.mergeCells(`A1:${lastCol}1`);
    const c1 = ws.getCell('A1');
    c1.value = 'Republic of the Philippines';
    c1.font = { size: 9, name: 'Arial' };
    c1.alignment = { horizontal: 'center' };

    ws.mergeCells(`A2:${lastCol}2`);
    const c2 = ws.getCell('A2');
    c2.value = 'Municipality of Juban, Province of Sorsogon';
    c2.font = { size: 9, name: 'Arial' };
    c2.alignment = { horizontal: 'center' };

    ws.mergeCells(`A3:${lastCol}3`);
    const c3 = ws.getCell('A3');
    c3.value = 'PUBLIC EMPLOYMENT SERVICE OFFICE (PESO)';
    c3.font = { bold: true, size: 10, name: 'Arial' };
    c3.alignment = { horizontal: 'center' };

    ws.mergeCells(`A4:${lastCol}4`); // spacer

    ws.mergeCells(`A5:${lastCol}5`);
    const c5 = ws.getCell('A5');
    c5.value = title;
    c5.font = titleFont;
    c5.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(`A6:${lastCol}6`);
    const c6 = ws.getCell('A6');
    c6.value = subtitle;
    c6.font = { italic: true, size: 10, name: 'Arial' };
    c6.alignment = { horizontal: 'center' };

    ws.mergeCells(`A7:${lastCol}7`); // spacer
    return 8; // next row to use
};

const addHeaderRow = (ws, rowNum, headers) => {
    const row = ws.getRow(rowNum);
    headers.forEach((h, i) => {
        const cell = row.getCell(i + 1);
        cell.value = h.header;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = HEADER_FILL;
        cell.border = THIN_BORDER;
        if (h.width) ws.getColumn(i + 1).width = h.width;
    });
    row.height = 24;
    return rowNum + 1;
};

const addDataRow = (ws, rowNum, values) => {
    const row = ws.getRow(rowNum);
    values.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.font = dataFont;
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
    });
    row.height = 18;
    return rowNum + 1;
};

const addSignatureBlock = (ws, rowNum) => {
    const r = rowNum + 2;
    ws.mergeCells(`A${r}:D${r}`);
    ws.getCell(`A${r}`).value = 'Prepared by:';
    ws.getCell(`A${r}`).font = dataFont;

    ws.mergeCells(`H${r}:L${r}`);
    ws.getCell(`H${r}`).value = 'Noted by:';
    ws.getCell(`H${r}`).font = dataFont;

    ws.mergeCells(`A${r + 2}:D${r + 2}`);
    ws.getCell(`A${r + 2}`).value = '______________________________';
    ws.getCell(`A${r + 2}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`A${r + 3}:D${r + 3}`);
    ws.getCell(`A${r + 3}`).value = 'PESO Manager';
    ws.getCell(`A${r + 3}`).font = { size: 9, name: 'Arial', italic: true };
    ws.getCell(`A${r + 3}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`H${r + 2}:L${r + 2}`);
    ws.getCell(`H${r + 2}`).value = '______________________________';
    ws.getCell(`H${r + 2}`).alignment = { horizontal: 'center' };

    ws.mergeCells(`H${r + 3}:L${r + 3}`);
    ws.getCell(`H${r + 3}`).value = 'Municipal Mayor / Authorized Representative';
    ws.getCell(`H${r + 3}`).font = { size: 9, name: 'Arial', italic: true };
    ws.getCell(`H${r + 3}`).alignment = { horizontal: 'center' };
};

const sendWorkbook = async (res, workbook, filename) => {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
};

const landscapeSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
};

// ══════════════════════════════════════════════════════
// JSON endpoints — for frontend dashboard display
// ══════════════════════════════════════════════════════

// ── NEW: Analytics Summary Report ─────────────────────

export async function handleGetSummaryReport(req, res) {
    try {
        const { program, sort, timeRange } = req.query;
        
        const data = await getSummaryReport({
            program: program || 'all',
            timeRange: timeRange || 'year',
            sortOrder: sort || 'asc'
        });
        
        res.json(data);
    } catch (error) {
        console.error('Summary report error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating summary report' });
    }
}

export async function handleGetProgramAccomplishment(req, res) {
    try {
        const { month } = req.query;
        const data = await getProgramAccomplishment(month || null);
        res.json(data);
    } catch (error) {
        console.error('Program accomplishment error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

// get beneficiary master list with optional filters (program, status)
export async function handleGetBeneficiaryMasterList(req, res) {
    try {
        const { program, status } = req.query;
        const data = await getBeneficiaryMasterList(program || null, status || null);
        res.json(data);
    } catch (error) {
        console.error('Beneficiary master list error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

export async function handleGetBarangayBeneficiaries(req, res) {
    try {
        const { program, timeRange, sortOrder, barangay } = req.query;
        const barangayService = require('../services/barangay.service');
        const data = await barangayService.getFilteredBarangays({
            program: program || null,
            timeRange: timeRange || 'year',
            sortOrder: sortOrder || 'asc',
            selectedBarangay: barangay || null
        });
        res.json(data);
    } catch (error) {
        console.error('Barangay beneficiaries error:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching barangay data' });
    }
}

// Get list of all barangays (names only)
export async function handleGetBarangayList(req, res) {
    try {
        const barangayService = require('../services/barangay.service');
        const data = await barangayService.getBarangayList();
        res.json(data);
    } catch (error) {
        console.error('Barangay list error:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching barangay list' });
    }
}

// get the payroll summary for a given month (default to current month)
export async function handleGetPayrollSummary(req, res) {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const data = await getPayrollSummary(month);
        res.json(data);
    } catch (error) {
        console.error('Payroll summary error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

// get the summary of attendance records for a given month, with optional program filter
export async function handleGetAttendanceSummary(req, res) {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const { program } = req.query;
        const data = await getAttendanceSummary(month, program || null);
        res.json(data);
    } catch (error) {
        console.error('Attendance summary error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

export async function handleGetDilpMonitoringReport(req, res) {
    try {
        const { month } = req.query;
        const data = await getDilpMonitoringReport(month || null);
        res.json(data);
    } catch (error) {
        console.error('DILP monitoring error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

export async function handleGetEmploymentFacilitationReport(req, res) {
    try {
        const { month } = req.query;
        const data = await getEmploymentFacilitationReport(month || null);
        res.json(data);
    } catch (error) {
        console.error('Employment facilitation error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

export async function handleGetSpesReport(req, res) {
    try {
        const { month } = req.query;
        const data = await getSpesReport(month || null);
        res.json(data);
    } catch (error) {
        console.error('SPES report error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

export async function handleGetGipReport(req, res) {
    try {
        const { month } = req.query;
        const data = await getGipReport(month || null);
        res.json(data);
    } catch (error) {
        console.error('GIP report error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

export async function handleGetConsolidatedReport(req, res) {
    try {
        const { startMonth, endMonth } = req.query;
        if (!startMonth || !endMonth) {
            return res.status(400).json({ message: 'startMonth and endMonth are required (YYYY-MM format)' });
        }
        const data = await getConsolidatedReport(startMonth, endMonth);
        res.json(data);
    } catch (error) {
        console.error('Consolidated report error:', error.message);
        res.status(500).json({ message: error.message || 'Error generating report' });
    }
}

// ══════════════════════════════════════════════════════
// EXCEL EXPORT endpoints
// ══════════════════════════════════════════════════════

// ── 1. Program Accomplishment Report (Excel) ────────

export async function exportProgramAccomplishment(req, res) {
    try {
        const { month } = req.query;
        const data = await getProgramAccomplishment(month || null);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        wb.created = new Date();

        const ws = wb.addWorksheet('Program Accomplishment', { pageSetup: landscapeSetup });

        const period = month
            ? new Date(month + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
            : 'All Time';

        let row = addTitle(ws, 'PROGRAM ACCOMPLISHMENT REPORT', `Period: ${period}`, 10);

        // Budget utilization table
        const headers = [
            { header: 'No.', width: 5 },
            { header: 'PROGRAM', width: 20 },
            { header: 'BUDGET', width: 16 },
            { header: 'UTILIZED', width: 16 },
            { header: 'REMAINING', width: 16 },
            { header: 'UTILIZATION %', width: 14 },
            { header: 'SLOTS', width: 8 },
            { header: 'FILLED', width: 8 },
            { header: 'FILL RATE %', width: 12 },
            { header: 'STATUS', width: 12 },
        ];
        row = addHeaderRow(ws, row, headers);

        data.programs.forEach((p, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                p.program_name,
                formatPeso(p.budget),
                formatPeso(p.used),
                formatPeso(p.remaining),
                formatPercent(p.utilization_rate),
                p.slots,
                p.filled,
                formatPercent(p.slot_rate),
                p.status,
            ]);
        });

        // Totals row
        const totRow = ws.getRow(row);
        [
            '', 'TOTAL',
            formatPeso(data.totals.budget), formatPeso(data.totals.used), formatPeso(data.totals.remaining),
            formatPercent(data.totals.utilization_rate),
            data.totals.slots, data.totals.filled, formatPercent(data.totals.slot_rate), '',
        ].forEach((val, i) => {
            const cell = totRow.getCell(i + 1);
            cell.value = val;
            cell.font = { bold: true, size: 9, name: 'Arial' };
            cell.border = THIN_BORDER;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        });
        row += 2;

        // Applications summary
        if (data.applicationCounts.length > 0) {
            ws.getCell(`A${row}`).value = 'Applications Summary';
            ws.getCell(`A${row}`).font = subtitleFont;
            row++;
            row = addHeaderRow(ws, row, [
                { header: 'PROGRAM', width: 16 },
                { header: 'STATUS', width: 14 },
                { header: 'COUNT', width: 10 },
            ]);
            data.applicationCounts.forEach(a => {
                row = addDataRow(ws, row, [a.program_type.toUpperCase(), a.status, a.count]);
            });
            row++;
        }

        // Gender breakdown
        if (data.genderByProgram.length > 0) {
            ws.getCell(`A${row}`).value = 'Gender Distribution by Program';
            ws.getCell(`A${row}`).font = subtitleFont;
            row++;
            row = addHeaderRow(ws, row, [
                { header: 'PROGRAM', width: 16 },
                { header: 'GENDER', width: 12 },
                { header: 'COUNT', width: 10 },
            ]);
            data.genderByProgram.forEach(g => {
                row = addDataRow(ws, row, [g.program_type.toUpperCase(), g.gender, g.count]);
            });
        }

        addSignatureBlock(ws, row);

        const filename = `Program_Accomplishment_${month || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export program accomplishment error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 2. Beneficiary Master List (Excel) ──────────────

export async function exportBeneficiaryMasterList(req, res) {
    try {
        const { program, status } = req.query;
        const data = await getBeneficiaryMasterList(program || null, status || null);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('Beneficiary Master List', { pageSetup: landscapeSetup });

        const filter = [program ? program.toUpperCase() : 'ALL PROGRAMS', status || 'ALL STATUS'].join(' — ');
        let row = addTitle(ws, 'BENEFICIARY MASTER LIST', filter, 14);

        const headers = [
            { header: 'No.', width: 5 },
            { header: 'LAST NAME', width: 14 },
            { header: 'FIRST NAME', width: 14 },
            { header: 'MIDDLE NAME', width: 12 },
            { header: 'PROGRAM', width: 12 },
            { header: 'DATE OF BIRTH', width: 14 },
            { header: 'AGE', width: 5 },
            { header: 'SEX', width: 8 },
            { header: 'CIVIL STATUS', width: 12 },
            { header: 'CONTACT NO.', width: 14 },
            { header: 'ADDRESS', width: 26 },
            { header: 'STATUS', width: 10 },
            { header: 'APPLIED', width: 12 },
            { header: 'APPROVED', width: 12 },
        ];
        row = addHeaderRow(ws, row, headers);

        data.beneficiaries.forEach((b, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                (b.last_name || '').toUpperCase(),
                (b.first_name || '').toUpperCase(),
                (b.middle_name || '').toUpperCase(),
                (b.program_type || '').toUpperCase(),
                formatDate(b.birth_date),
                b.age ?? '',
                b.gender || '',
                b.civil_status || '',
                b.contact_number || '',
                b.address || '',
                b.application_status || '',
                formatDate(b.applied_at),
                formatDate(b.approval_date),
            ]);
        });

        // Demographics summary sheet
        const ds = wb.addWorksheet('Demographics Summary');
        let dr = 1;
        ds.getCell(`A${dr}`).value = 'Demographics Summary';
        ds.getCell(`A${dr}`).font = titleFont;
        ds.getColumn(1).width = 20;
        ds.getColumn(2).width = 12;
        ds.getColumn(3).width = 12;
        ds.getColumn(4).width = 12;
        dr += 2;

        ds.getCell(`A${dr}`).value = 'Total Beneficiaries';
        ds.getCell(`A${dr}`).font = { bold: true, size: 10, name: 'Arial' };
        ds.getCell(`B${dr}`).value = data.demographics.total;
        dr++;
        ds.getCell(`A${dr}`).value = 'Male';
        ds.getCell(`B${dr}`).value = data.demographics.male;
        dr++;
        ds.getCell(`A${dr}`).value = 'Female';
        ds.getCell(`B${dr}`).value = data.demographics.female;
        dr += 2;

        // By program
        ds.getCell(`A${dr}`).value = 'By Program';
        ds.getCell(`A${dr}`).font = subtitleFont;
        dr++;
        ds.getCell(`A${dr}`).value = 'Program'; ds.getCell(`A${dr}`).font = headerFont;
        ds.getCell(`B${dr}`).value = 'Total'; ds.getCell(`B${dr}`).font = headerFont;
        ds.getCell(`C${dr}`).value = 'Male'; ds.getCell(`C${dr}`).font = headerFont;
        ds.getCell(`D${dr}`).value = 'Female'; ds.getCell(`D${dr}`).font = headerFont;
        dr++;
        Object.entries(data.demographics.byProgram).forEach(([prog, vals]) => {
            ds.getCell(`A${dr}`).value = prog.toUpperCase();
            ds.getCell(`B${dr}`).value = vals.total;
            ds.getCell(`C${dr}`).value = vals.male;
            ds.getCell(`D${dr}`).value = vals.female;
            dr++;
        });
        dr++;

        // By age
        ds.getCell(`A${dr}`).value = 'By Age Bracket';
        ds.getCell(`A${dr}`).font = subtitleFont;
        dr++;
        Object.entries(data.demographics.byAge).forEach(([bracket, count]) => {
            ds.getCell(`A${dr}`).value = bracket;
            ds.getCell(`B${dr}`).value = count;
            dr++;
        });
        dr++;

        // By civil status
        ds.getCell(`A${dr}`).value = 'By Civil Status';
        ds.getCell(`A${dr}`).font = subtitleFont;
        dr++;
        Object.entries(data.demographics.byCivilStatus).forEach(([cs, count]) => {
            ds.getCell(`A${dr}`).value = cs;
            ds.getCell(`B${dr}`).value = count;
            dr++;
        });

        addSignatureBlock(ws, row);

        const filename = `Beneficiary_Master_List_${program || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export beneficiary master list error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 3. Payroll Summary (Excel) ──────────────────────

export async function exportPayrollSummary(req, res) {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const data = await getPayrollSummary(month);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('Payroll Summary', { pageSetup: landscapeSetup });

        const period = new Date(month + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
        let row = addTitle(ws, 'PAYROLL & DISBURSEMENT SUMMARY', `Period: ${period}  |  Daily Wage: ${formatPeso(data.dailyWage)}`, 10);

        // By Program Status
        const h1 = [
            { header: 'PROGRAM', width: 14 },
            { header: 'STATUS', width: 12 },
            { header: 'BENEFICIARIES', width: 14 },
            { header: 'TOTAL DAYS', width: 12 },
            { header: 'TOTAL PAYOUT', width: 16 },
        ];
        row = addHeaderRow(ws, row, h1);
        data.byProgram.forEach(p => {
            row = addDataRow(ws, row, [
                (p.program_type || '').toUpperCase(),
                p.status,
                p.beneficiary_count,
                p.total_days,
                formatPeso(p.total_payout),
            ]);
        });
        row++;

        // Detailed records
        ws.getCell(`A${row}`).value = 'Detailed Payroll Records';
        ws.getCell(`A${row}`).font = subtitleFont;
        row++;

        const h2 = [
            { header: 'No.', width: 5 },
            { header: 'FULL NAME', width: 22 },
            { header: 'PROGRAM', width: 12 },
            { header: 'GENDER', width: 8 },
            { header: 'DAYS WORKED', width: 12 },
            { header: 'DAILY WAGE', width: 12 },
            { header: 'TOTAL PAYOUT', width: 14 },
            { header: 'STATUS', width: 10 },
            { header: 'ADDRESS', width: 24 },
        ];
        row = addHeaderRow(ws, row, h2);
        data.records.forEach((r, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                r.full_name || 'N/A',
                (r.program_type || '').toUpperCase(),
                r.gender || '',
                r.days_worked,
                formatPeso(r.daily_wage),
                formatPeso(r.total_payout),
                r.status,
                r.address || '',
            ]);
        });

        // Totals
        const totR = ws.getRow(row);
        ['', 'TOTAL', '', '', data.totals.total_days, '', formatPeso(data.totals.total_payout), '', ''].forEach((val, i) => {
            const cell = totR.getCell(i + 1);
            cell.value = val;
            cell.font = { bold: true, size: 9, name: 'Arial' };
            cell.border = THIN_BORDER;
        });
        row += 2;

        // Disbursements
        if (data.disbursements.length > 0) {
            ws.getCell(`A${row}`).value = 'Disbursement Batches';
            ws.getCell(`A${row}`).font = subtitleFont;
            row++;
            const h3 = [
                { header: 'BATCH CODE', width: 16 },
                { header: 'PROGRAM', width: 12 },
                { header: 'AMOUNT', width: 14 },
                { header: 'RECIPIENTS', width: 10 },
                { header: 'MODE', width: 14 },
                { header: 'STATUS', width: 12 },
                { header: 'REF NO.', width: 16 },
                { header: 'SCHEDULED', width: 12 },
                { header: 'RELEASED', width: 12 },
            ];
            row = addHeaderRow(ws, row, h3);
            data.disbursements.forEach(d => {
                row = addDataRow(ws, row, [
                    d.batch_code,
                    (d.program_type || '').toUpperCase(),
                    formatPeso(d.total_amount),
                    d.recipient_count,
                    d.payment_mode,
                    d.status,
                    d.reference_number || '',
                    formatDate(d.scheduled_date),
                    formatDate(d.released_date),
                ]);
            });
        }

        addSignatureBlock(ws, row);

        const filename = `Payroll_Summary_${month}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export payroll summary error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 4. Attendance Summary (Excel) ───────────────────

export async function exportAttendanceSummary(req, res) {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const { program } = req.query;
        const data = await getAttendanceSummary(month, program || null);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('Attendance Summary', { pageSetup: landscapeSetup });

        const period = new Date(month + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
        let row = addTitle(ws, 'ATTENDANCE COMPLIANCE REPORT', `Period: ${period}  |  Program: ${program ? program.toUpperCase() : 'ALL'}`, 9);

        const headers = [
            { header: 'No.', width: 5 },
            { header: 'FULL NAME', width: 22 },
            { header: 'PROGRAM', width: 12 },
            { header: 'PRESENT', width: 10 },
            { header: 'ABSENT', width: 10 },
            { header: 'INCOMPLETE', width: 10 },
            { header: 'TOTAL', width: 8 },
            { header: 'FIRST DATE', width: 12 },
            { header: 'LAST DATE', width: 12 },
        ];
        row = addHeaderRow(ws, row, headers);

        data.records.forEach((r, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                r.full_name || 'N/A',
                (r.program_type || '').toUpperCase(),
                r.present_days,
                r.absent_days,
                r.incomplete_days,
                r.total_records,
                formatDate(r.first_attendance),
                formatDate(r.last_attendance),
            ]);
        });

        // Totals
        const totR = ws.getRow(row);
        ['', 'TOTAL', '',
            data.totals.present_days, data.totals.absent_days, '',
            data.totals.total_records, '', ''].forEach((val, i) => {
            const cell = totR.getCell(i + 1);
            cell.value = val;
            cell.font = { bold: true, size: 9, name: 'Arial' };
            cell.border = THIN_BORDER;
        });
        row++;
        ws.getCell(`A${row}`).value = `Compliance Rate: ${formatPercent(data.totals.compliance_rate)}`;
        ws.getCell(`A${row}`).font = { bold: true, size: 10, name: 'Arial' };

        addSignatureBlock(ws, row + 1);

        const filename = `Attendance_Summary_${month}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export attendance summary error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 5. DILP Project Monitoring (Excel) ──────────────

export async function exportDilpMonitoring(req, res) {
    try {
        const { month } = req.query;
        const data = await getDilpMonitoringReport(month || null);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('DILP Monitoring', { pageSetup: landscapeSetup });

        const period = month
            ? new Date(month + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
            : 'All Time';
        let row = addTitle(ws, 'DILP PROJECT MONITORING REPORT', `DOLE Integrated Livelihood Program  |  Period: ${period}`, 12);

        const headers = [
            { header: 'No.', width: 5 },
            { header: 'PROPONENT', width: 20 },
            { header: 'PROJECT TITLE', width: 22 },
            { header: 'TYPE', width: 10 },
            { header: 'CATEGORY', width: 12 },
            { header: 'PROPOSED AMT', width: 14 },
            { header: 'BARANGAY', width: 12 },
            { header: 'BENEFICIARIES', width: 12 },
            { header: 'EST. INCOME', width: 14 },
            { header: 'STATUS', width: 10 },
            { header: 'DATE FILED', width: 12 },
            { header: 'DATE APPROVED', width: 12 },
        ];
        row = addHeaderRow(ws, row, headers);

        data.projects.forEach((p, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                p.proponent_name || '',
                p.project_title || '',
                p.project_type || '',
                p.category || '',
                formatPeso(p.proposed_amount),
                p.barangay || '',
                p.number_of_beneficiaries || 0,
                formatPeso(p.estimated_monthly_income),
                p.application_status || '',
                formatDate(p.applied_at),
                formatDate(p.approval_date),
            ]);
        });

        // Summary
        row += 2;
        ws.getCell(`A${row}`).value = 'Summary';
        ws.getCell(`A${row}`).font = subtitleFont;
        row++;
        ws.getCell(`A${row}`).value = `Total Projects: ${data.summary.total_projects}`;
        ws.getCell(`A${row}`).font = dataFont;
        row++;
        ws.getCell(`A${row}`).value = `Total Proposed Amount: ${formatPeso(data.summary.total_proposed_amount)}`;
        ws.getCell(`A${row}`).font = dataFont;
        row++;
        ws.getCell(`A${row}`).value = `Total Beneficiaries: ${data.summary.total_beneficiaries}`;
        ws.getCell(`A${row}`).font = dataFont;
        row++;

        data.summary.byCategory.forEach(c => {
            ws.getCell(`A${row}`).value = `  ${c.category}: ${c.count} projects, ${formatPeso(c.amount)}`;
            ws.getCell(`A${row}`).font = dataFont;
            row++;
        });

        addSignatureBlock(ws, row);

        const filename = `DILP_Monitoring_${month || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export DILP monitoring error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 6. Employment Facilitation Report (Excel) ───────

export async function exportEmploymentFacilitation(req, res) {
    try {
        const { month } = req.query;
        const data = await getEmploymentFacilitationReport(month || null);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('Employment Facilitation', { pageSetup: landscapeSetup });

        const period = month
            ? new Date(month + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
            : 'All Time';
        let row = addTitle(ws, 'EMPLOYMENT FACILITATION REPORT', `Job Seekers Registry  |  Period: ${period}`, 12);

        const headers = [
            { header: 'No.', width: 5 },
            { header: 'FULL NAME', width: 22 },
            { header: 'AGE', width: 5 },
            { header: 'SEX', width: 8 },
            { header: 'CIVIL STATUS', width: 12 },
            { header: 'CONTACT', width: 14 },
            { header: 'ADDRESS', width: 22 },
            { header: 'EMP. STATUS', width: 14 },
            { header: 'PREF. WORK', width: 12 },
            { header: 'INDUSTRY', width: 14 },
            { header: 'YRS EXP', width: 8 },
            { header: 'STATUS', width: 10 },
        ];
        row = addHeaderRow(ws, row, headers);

        data.seekers.forEach((s, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                s.full_name || '',
                s.age ?? '',
                s.gender || '',
                s.civil_status || '',
                s.contact_number || '',
                s.address || '',
                s.employment_status || '',
                s.preferred_work_type || '',
                s.preferred_industry || '',
                s.years_of_experience || '',
                s.application_status || '',
            ]);
        });

        // Summary sheet
        const ss = wb.addWorksheet('Summary');
        let sr = 1;
        ss.getCell(`A${sr}`).value = 'Employment Facilitation Summary';
        ss.getCell(`A${sr}`).font = titleFont;
        ss.getColumn(1).width = 22;
        ss.getColumn(2).width = 12;
        sr += 2;

        ss.getCell(`A${sr}`).value = 'Total Registered';
        ss.getCell(`B${sr}`).value = data.summary.total_registered;
        sr++;
        ss.getCell(`A${sr}`).value = 'Male';
        ss.getCell(`B${sr}`).value = data.summary.male;
        sr++;
        ss.getCell(`A${sr}`).value = 'Female';
        ss.getCell(`B${sr}`).value = data.summary.female;
        sr += 2;

        ss.getCell(`A${sr}`).value = 'By Age Bracket';
        ss.getCell(`A${sr}`).font = subtitleFont;
        sr++;
        Object.entries(data.summary.byAge).forEach(([bracket, count]) => {
            ss.getCell(`A${sr}`).value = bracket;
            ss.getCell(`B${sr}`).value = count;
            sr++;
        });
        sr++;

        ss.getCell(`A${sr}`).value = 'By Employment Status';
        ss.getCell(`A${sr}`).font = subtitleFont;
        sr++;
        data.summary.byEmploymentStatus.forEach(e => {
            ss.getCell(`A${sr}`).value = e.status;
            ss.getCell(`B${sr}`).value = e.count;
            sr++;
        });
        sr++;

        ss.getCell(`A${sr}`).value = 'By Preferred Work Type';
        ss.getCell(`A${sr}`).font = subtitleFont;
        sr++;
        data.summary.byWorkType.forEach(w => {
            ss.getCell(`A${sr}`).value = w.type;
            ss.getCell(`B${sr}`).value = w.count;
            sr++;
        });
        sr++;

        ss.getCell(`A${sr}`).value = 'By Preferred Industry';
        ss.getCell(`A${sr}`).font = subtitleFont;
        sr++;
        data.summary.byIndustry.forEach(ind => {
            ss.getCell(`A${sr}`).value = ind.industry;
            ss.getCell(`B${sr}`).value = ind.count;
            sr++;
        });

        addSignatureBlock(ws, row);

        const filename = `Employment_Facilitation_${month || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export employment facilitation error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 7. SPES Intern Report (Excel) ──────────────────

export async function exportSpesReport(req, res) {
    try {
        const { month } = req.query;
        const data = await getSpesReport(month || null);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('SPES Report', { pageSetup: landscapeSetup });

        const period = month
            ? new Date(month + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
            : 'All Time';
        let row = addTitle(ws, 'SPES INTERN / APPLICANT REPORT', `Special Program for Employment of Students  |  Period: ${period}`, 12);

        const headers = [
            { header: 'No.', width: 5 },
            { header: 'FULL NAME', width: 22 },
            { header: 'AGE', width: 5 },
            { header: 'SEX', width: 8 },
            { header: 'CIVIL STATUS', width: 12 },
            { header: 'CONTACT', width: 14 },
            { header: 'ADDRESS', width: 22 },
            { header: 'SCHOOL', width: 20 },
            { header: 'COURSE', width: 18 },
            { header: 'YEAR LEVEL', width: 10 },
            { header: 'EDUCATION', width: 12 },
            { header: 'STATUS', width: 10 },
        ];
        row = addHeaderRow(ws, row, headers);

        data.interns.forEach((s, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                s.full_name || '',
                s.age ?? '',
                s.gender || '',
                s.civil_status || '',
                s.contact_number || '',
                s.address || '',
                s.school || '',
                s.course || '',
                s.year_level || '',
                s.education_level || '',
                s.application_status || '',
            ]);
        });

        // Summary
        row += 2;
        ws.getCell(`A${row}`).value = 'Summary';
        ws.getCell(`A${row}`).font = subtitleFont;
        row++;
        ws.getCell(`A${row}`).value = `Total Applicants: ${data.summary.total}  |  Male: ${data.summary.male}  |  Female: ${data.summary.female}`;
        ws.getCell(`A${row}`).font = dataFont;
        row += 2;

        if (data.summary.byEducation.length > 0) {
            ws.getCell(`A${row}`).value = 'By Education Level:';
            ws.getCell(`A${row}`).font = { bold: true, size: 9, name: 'Arial' };
            row++;
            data.summary.byEducation.forEach(e => {
                ws.getCell(`A${row}`).value = `  ${e.level}: ${e.count}`;
                ws.getCell(`A${row}`).font = dataFont;
                row++;
            });
        }

        addSignatureBlock(ws, row);

        const filename = `SPES_Report_${month || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export SPES report error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 8. GIP Intern Report (Excel) ───────────────────

export async function exportGipReport(req, res) {
    try {
        const { month } = req.query;
        const data = await getGipReport(month || null);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';
        const ws = wb.addWorksheet('GIP Report', { pageSetup: landscapeSetup });

        const period = month
            ? new Date(month + '-01').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
            : 'All Time';
        let row = addTitle(ws, 'GIP INTERN REPORT', `Government Internship Program  |  Period: ${period}`, 12);

        const headers = [
            { header: 'No.', width: 5 },
            { header: 'FULL NAME', width: 22 },
            { header: 'AGE', width: 5 },
            { header: 'SEX', width: 8 },
            { header: 'CIVIL STATUS', width: 12 },
            { header: 'CONTACT', width: 14 },
            { header: 'ADDRESS', width: 22 },
            { header: 'SCHOOL', width: 20 },
            { header: 'COURSE', width: 18 },
            { header: 'YEAR GRAD', width: 10 },
            { header: 'EMP. STATUS', width: 12 },
            { header: 'STATUS', width: 10 },
        ];
        row = addHeaderRow(ws, row, headers);

        data.interns.forEach((g, idx) => {
            row = addDataRow(ws, row, [
                idx + 1,
                g.full_name || '',
                g.age ?? '',
                g.gender || '',
                g.civil_status || '',
                g.contact_number || '',
                g.address || '',
                g.school || '',
                g.course || '',
                g.year_graduated || '',
                g.employment_status || '',
                g.application_status || '',
            ]);
        });

        row += 2;
        ws.getCell(`A${row}`).value = `Summary: Total ${data.summary.total}  |  Male: ${data.summary.male}  |  Female: ${data.summary.female}`;
        ws.getCell(`A${row}`).font = subtitleFont;

        addSignatureBlock(ws, row + 1);

        const filename = `GIP_Report_${month || 'All'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export GIP report error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}

// ── 9. Consolidated Report (Excel) ─────────────────

export async function exportConsolidatedReport(req, res) {
    try {
        const { startMonth, endMonth } = req.query;
        if (!startMonth || !endMonth) {
            return res.status(400).json({ message: 'startMonth and endMonth required (YYYY-MM format)' });
        }

        const data = await getConsolidatedReport(startMonth, endMonth);

        const wb = new Workbook();
        wb.creator = 'PESO Juban Management System';

        // ── Sheet 1: Applications Overview ──
        const ws1 = wb.addWorksheet('Applications', { pageSetup: landscapeSetup });
        let row = addTitle(ws1, 'CONSOLIDATED PESO REPORT', `Period: ${startMonth} to ${endMonth}`, 7);

        ws1.getCell(`A${row}`).value = 'Applications Filed';
        ws1.getCell(`A${row}`).font = subtitleFont;
        row++;
        row = addHeaderRow(ws1, row, [
            { header: 'PROGRAM', width: 14 },
            { header: 'STATUS', width: 12 },
            { header: 'COUNT', width: 8 },
            { header: 'MALE', width: 8 },
            { header: 'FEMALE', width: 8 },
        ]);
        data.applications.forEach(a => {
            row = addDataRow(ws1, row, [
                (a.program_type || '').toUpperCase(),
                a.status,
                a.count,
                a.male,
                a.female,
            ]);
        });
        row += 2;

        // Attendance
        if (data.attendance.length > 0) {
            ws1.getCell(`A${row}`).value = 'Attendance Overview';
            ws1.getCell(`A${row}`).font = subtitleFont;
            row++;
            data.attendance.forEach(a => {
                ws1.getCell(`A${row}`).value = a.status;
                ws1.getCell(`B${row}`).value = a.count;
                row++;
            });
        }

        addSignatureBlock(ws1, row);

        // ── Sheet 2: Payroll Breakdown ──
        const ws2 = wb.addWorksheet('Payroll', { pageSetup: landscapeSetup });
        let r2 = addTitle(ws2, 'PAYROLL SUMMARY', `Period: ${startMonth} to ${endMonth}`, 6);

        r2 = addHeaderRow(ws2, r2, [
            { header: 'MONTH', width: 12 },
            { header: 'PROGRAM', width: 14 },
            { header: 'BENEFICIARIES', width: 14 },
            { header: 'TOTAL DAYS', width: 12 },
            { header: 'TOTAL PAYOUT', width: 16 },
        ]);
        data.payrollMonthly.forEach(p => {
            r2 = addDataRow(ws2, r2, [
                p.payroll_month,
                (p.program_type || '').toUpperCase(),
                p.beneficiary_count,
                p.total_days,
                formatPeso(p.total_payout),
            ]);
        });
        r2++;
        ws2.getCell(`A${r2}`).value = `Total Payout: ${formatPeso(data.payrollTotals.total_payout)}  |  Total Days: ${data.payrollTotals.total_days}`;
        ws2.getCell(`A${r2}`).font = subtitleFont;
        r2 += 2;

        // Disbursements
        if (data.disbursements.length > 0) {
            ws2.getCell(`A${r2}`).value = 'Disbursement Summary';
            ws2.getCell(`A${r2}`).font = subtitleFont;
            r2++;
            r2 = addHeaderRow(ws2, r2, [
                { header: 'STATUS', width: 14 },
                { header: 'BATCHES', width: 10 },
                { header: 'TOTAL AMOUNT', width: 16 },
                { header: 'RECIPIENTS', width: 12 },
            ]);
            data.disbursements.forEach(d => {
                r2 = addDataRow(ws2, r2, [d.status, d.batch_count, formatPeso(d.total_amount), d.total_recipients]);
            });
        }

        addSignatureBlock(ws2, r2);

        // ── Sheet 3: Budget Utilization ──
        const ws3 = wb.addWorksheet('Budget Utilization', { pageSetup: landscapeSetup });
        let r3 = addTitle(ws3, 'BUDGET UTILIZATION REPORT', `As of ${new Date().toLocaleDateString('en-PH')}`, 7);

        r3 = addHeaderRow(ws3, r3, [
            { header: 'PROGRAM', width: 20 },
            { header: 'BUDGET', width: 16 },
            { header: 'UTILIZED', width: 16 },
            { header: 'REMAINING', width: 16 },
            { header: 'UTILIZATION %', width: 14 },
            { header: 'SLOTS', width: 8 },
            { header: 'FILLED', width: 8 },
        ]);
        data.programBudgets.forEach(p => {
            r3 = addDataRow(ws3, r3, [
                p.program_name,
                formatPeso(p.budget),
                formatPeso(p.used),
                formatPeso(p.remaining),
                formatPercent(p.utilization_rate),
                p.slots,
                p.filled,
            ]);
        });

        addSignatureBlock(ws3, r3);

        const filename = `Consolidated_PESO_Report_${startMonth}_to_${endMonth}.xlsx`;
        await sendWorkbook(res, wb, filename);
    } catch (error) {
        console.error('Export consolidated report error:', error.message);
        res.status(500).json({ message: error.message || 'Error exporting report' });
    }
}
