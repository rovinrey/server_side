const adminDocsService = require('../services/admin.documents.services');
const path = require('path');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } = require('docx');

const VALID_PROGRAMS = ['tupad', 'spes', 'dilp', 'gip', 'job_seekers'];

const PROGRAM_LABELS = {
    tupad: 'TUPAD',
    spes: 'SPES',
    dilp: 'DILP',
    gip: 'GIP',
    job_seekers: 'Job Seekers',
};

const DOCUMENT_TYPE_LABELS = {
    government_id: 'Government ID',
    valid_government_id: 'Valid Government ID',
    barangay_certification: 'Barangay Certification',
    birth_certificate: 'Birth Certificate',
    application_form: 'Application Form',
    project_proposal: 'Project Proposal',
    barangay_clearance: 'Barangay Clearance',
    business_registration: 'Business Registration',
    transcript_of_records: 'Transcript of Records',
    certificate_of_graduation: 'Certificate of Graduation',
    nbi_police_clearance: 'NBI/Police Clearance',
    updated_resume: 'Updated Resume',
    proof_of_address: 'Proof of Address',
    certifications: 'Certifications',
};

const formatLabel = (key) =>
    DOCUMENT_TYPE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * GET /api/admin/documents
 * Returns all submitted documents across all users.
 * Query params: ?programType=tupad&userId=5
 */
exports.getAllDocuments = async (req, res) => {
    try {
        const { programType, userId } = req.query;

        if (programType && !VALID_PROGRAMS.includes(programType)) {
            return res.status(400).json({ message: 'Invalid program type' });
        }

        const docs = await adminDocsService.getAllDocuments({
            programType: programType || null,
            userId: userId ? parseInt(userId, 10) : null,
        });

        const mapped = docs.map((doc) => ({
            document_id: doc.document_id,
            user_id: doc.user_id,
            user_name: [doc.first_name, doc.last_name].filter(Boolean).join(' ') || doc.email || 'Unknown',
            email: doc.email,
            program_type: doc.program_type,
            document_type: doc.document_type,
            document_type_label: formatLabel(doc.document_type),
            original_name: doc.original_name,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            uploaded_at: doc.uploaded_at,
            url: `/uploads/beneficiary-documents/${path.basename(doc.file_path)}`,
        }));

        return res.status(200).json({ documents: mapped });
    } catch (error) {
        console.error('Error fetching admin documents:', error.message);
        return res.status(500).json({ message: 'Error fetching documents' });
    }
};

/**
 * GET /api/admin/documents/spes
 * Returns all SPES application documents across all users.
 */
exports.getAllSpesDocuments = async (req, res) => {
    try {
        const { userId } = req.query;
        const docs = await adminDocsService.getAllSpesDocuments({
            userId: userId ? parseInt(userId, 10) : null,
        });

        const SPES_FIELDS = {
            form2_path: 'SPES Form 2',
            form2a_path: 'SPES Form 2A',
            form4_path: 'SPES Form 4',
            passport_photo_path: 'Passport Photo',
            birth_cert_path: 'Birth Certificate',
            indigency_path: 'Certificate of Indigency',
            registration_path: 'Certificate of Registration',
            grades_path: 'Certificate of Grades',
            philjobnet_screenshot_path: 'PhilJobNet Screenshot',
        };

        const mapped = docs.map((row) => {
            const documents = {};
            Object.entries(SPES_FIELDS).forEach(([col, label]) => {
                documents[label] = row[col]
                    ? `/uploads/spes-documents/${path.basename(row[col])}`
                    : null;
            });

            return {
                spes_application_id: row.spes_application_id,
                user_id: row.user_id,
                user_name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Unknown',
                email: row.email,
                application_status: row.application_status,
                documents,
                admin_remarks: row.admin_remarks,
                updated_at: row.updated_at,
            };
        });

        return res.status(200).json({ spes_documents: mapped });
    } catch (error) {
        console.error('Error fetching admin SPES documents:', error.message);
        return res.status(500).json({ message: 'Error fetching SPES documents' });
    }
};

/**
 * GET /api/admin/documents/export-word/:userId
 * Generates and downloads a .docx file summarizing a user's submitted documents.
 * The admin can then edit the Word file before printing/submitting to DOLE.
 */
exports.exportDocumentsToWord = async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }

    try {
        const docs = await adminDocsService.getUserDocumentsForExport(userId);

        if (docs.length === 0) {
            return res.status(404).json({ message: 'No documents found for this user' });
        }

        const userInfo = docs[0];
        const applicantName = [userInfo.first_name, userInfo.last_name].filter(Boolean).join(' ') || 'Unknown';

        // Group documents by program
        const byProgram = {};
        docs.forEach((doc) => {
            const prog = doc.program_type;
            if (!byProgram[prog]) byProgram[prog] = [];
            byProgram[prog].push(doc);
        });

        // Build Word document sections
        const children = [];

        // Title
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: 'DOCUMENT SUBMISSION REPORT',
                        bold: true,
                        size: 32,
                        font: 'Arial',
                    }),
                ],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: 'For Submission to Department of Labor and Employment (DOLE)',
                        size: 22,
                        font: 'Arial',
                        italics: true,
                    }),
                ],
            }),
            new Paragraph({ spacing: { after: 200 }, children: [] })
        );

        // Applicant Information
        children.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
                children: [
                    new TextRun({ text: 'APPLICANT INFORMATION', bold: true, size: 24, font: 'Arial' }),
                ],
            })
        );

        const infoRows = [
            ['Applicant Name', applicantName],
            ['Email', userInfo.email || 'N/A'],
            ['Phone', userInfo.phone || 'N/A'],
            ['Address', userInfo.address || 'N/A'],
            ['Date Generated', new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })],
        ];

        const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

        infoRows.forEach(([label, value]) => {
            children.push(
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 30, type: WidthType.PERCENTAGE },
                                    borders: noBorders,
                                    children: [
                                        new Paragraph({
                                            children: [new TextRun({ text: label, bold: true, size: 20, font: 'Arial' })],
                                        }),
                                    ],
                                }),
                                new TableCell({
                                    width: { size: 70, type: WidthType.PERCENTAGE },
                                    borders: noBorders,
                                    children: [
                                        new Paragraph({
                                            children: [new TextRun({ text: `: ${value}`, size: 20, font: 'Arial' })],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                })
            );
        });

        children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

        // Per-program document table
        Object.entries(byProgram).forEach(([program, programDocs]) => {
            children.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 100 },
                    children: [
                        new TextRun({
                            text: `${PROGRAM_LABELS[program] || program.toUpperCase()} - SUBMITTED DOCUMENTS`,
                            bold: true,
                            size: 24,
                            font: 'Arial',
                        }),
                    ],
                })
            );

            const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
            const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

            // Table header
            const headerRow = new TableRow({
                tableHeader: true,
                children: ['#', 'Document Type', 'File Name', 'Date Submitted'].map(
                    (text) =>
                        new TableCell({
                            borders: cellBorders,
                            shading: { fill: '2563EB' },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text, bold: true, size: 18, font: 'Arial', color: 'FFFFFF' })],
                                }),
                            ],
                        })
                ),
            });

            // Table body
            const dataRows = programDocs.map((doc, idx) =>
                new TableRow({
                    children: [
                        new TableCell({
                            borders: cellBorders,
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [new TextRun({ text: String(idx + 1), size: 18, font: 'Arial' })],
                                }),
                            ],
                        }),
                        new TableCell({
                            borders: cellBorders,
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatLabel(doc.document_type), size: 18, font: 'Arial' })],
                                }),
                            ],
                        }),
                        new TableCell({
                            borders: cellBorders,
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: doc.original_name || 'N/A', size: 18, font: 'Arial' })],
                                }),
                            ],
                        }),
                        new TableCell({
                            borders: cellBorders,
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: doc.uploaded_at
                                                ? new Date(doc.uploaded_at).toLocaleDateString('en-PH', {
                                                      year: 'numeric',
                                                      month: 'short',
                                                      day: 'numeric',
                                                  })
                                                : 'N/A',
                                            size: 18,
                                            font: 'Arial',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                })
            );

            children.push(
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [headerRow, ...dataRows],
                })
            );
        });

        // Signature block
        children.push(
            new Paragraph({ spacing: { before: 600, after: 200 }, children: [] }),
            new Paragraph({
                children: [
                    new TextRun({ text: 'Prepared by: ___________________________', size: 20, font: 'Arial' }),
                ],
            }),
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: '                          (PESO Staff)', size: 18, font: 'Arial', italics: true }),
                ],
            }),
            new Paragraph({ spacing: { after: 200 }, children: [] }),
            new Paragraph({
                children: [
                    new TextRun({ text: 'Reviewed by: ___________________________', size: 20, font: 'Arial' }),
                ],
            }),
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: '                          (PESO Manager)', size: 18, font: 'Arial', italics: true }),
                ],
            }),
            new Paragraph({ spacing: { after: 200 }, children: [] }),
            new Paragraph({
                children: [
                    new TextRun({ text: 'Date: ___________________________', size: 20, font: 'Arial' }),
                ],
            })
        );

        // Generate the document
        const doc = new Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                        },
                    },
                    children,
                },
            ],
        });

        const buffer = await Packer.toBuffer(doc);

        const safeFileName = applicantName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
        const fileName = `Document_Report_${safeFileName}_${new Date().toISOString().slice(0, 10)}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error exporting documents to Word:', error.message);
        return res.status(500).json({ message: 'Error generating Word document' });
    }
};

/**
 * GET /api/admin/documents/view/:documentId
 * Serve a specific document file for admin viewing.
 */
exports.viewDocument = async (req, res) => {
    const documentId = parseInt(req.params.documentId, 10);
    if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
    }

    try {
        const doc = await adminDocsService.getDocumentById(documentId);
        if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const filePath = doc.file_path;
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found on server' });
        }

        res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${doc.original_name}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error('Error viewing document:', error.message);
        return res.status(500).json({ message: 'Error viewing document' });
    }
};

/**
 * DELETE /api/admin/documents/:documentId
 * Delete a generic beneficiary document.
 */
exports.deleteDocument = async (req, res) => {
    const documentId = parseInt(req.params.documentId, 10);
    if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
    }

    try {
        const result = await adminDocsService.deleteDocument(documentId);
        if (!result) {
            return res.status(404).json({ message: 'Document not found' });
        }
        return res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error.message);
        return res.status(500).json({ message: 'Error deleting document' });
    }
};

/**
 * PUT /api/admin/documents/:documentId
 * Replace a generic beneficiary document file.
 */
exports.replaceDocument = async (req, res) => {
    const documentId = parseInt(req.params.documentId, 10);
    if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const result = await adminDocsService.replaceDocument(documentId, req.file);
        if (!result) {
            return res.status(404).json({ message: 'Document not found' });
        }
        return res.status(200).json({ message: 'Document replaced successfully', document: result });
    } catch (error) {
        console.error('Error replacing document:', error.message);
        return res.status(500).json({ message: 'Error replacing document' });
    }
};

/**
 * GET /api/admin/documents/spes/view/:applicationId/:fieldId
 * Serve a specific SPES document file.
 */
exports.viewSpesDocument = async (req, res) => {
    const applicationId = parseInt(req.params.applicationId, 10);
    const { fieldId } = req.params;

    if (isNaN(applicationId)) {
        return res.status(400).json({ message: 'Invalid application ID' });
    }

    try {
        const filePath = await adminDocsService.getSpesDocumentPath(applicationId, fieldId);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };
        const mime = mimeMap[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error('Error viewing SPES document:', error.message);
        return res.status(500).json({ message: 'Error viewing document' });
    }
};

/**
 * DELETE /api/admin/documents/spes/:applicationId/:fieldId
 * Delete a specific SPES document.
 */
exports.deleteSpesDocument = async (req, res) => {
    const applicationId = parseInt(req.params.applicationId, 10);
    const { fieldId } = req.params;

    if (isNaN(applicationId)) {
        return res.status(400).json({ message: 'Invalid application ID' });
    }

    try {
        const result = await adminDocsService.deleteSpesDocument(applicationId, fieldId);
        if (!result) {
            return res.status(404).json({ message: 'Document not found or invalid field' });
        }
        return res.status(200).json({ message: 'SPES document deleted successfully' });
    } catch (error) {
        console.error('Error deleting SPES document:', error.message);
        return res.status(500).json({ message: 'Error deleting SPES document' });
    }
};

/**
 * PUT /api/admin/documents/spes/:applicationId/:fieldId
 * Replace a specific SPES document file.
 */
exports.replaceSpesDocument = async (req, res) => {
    const applicationId = parseInt(req.params.applicationId, 10);
    const { fieldId } = req.params;

    if (isNaN(applicationId)) {
        return res.status(400).json({ message: 'Invalid application ID' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const result = await adminDocsService.replaceSpesDocument(applicationId, fieldId, req.file);
        if (!result) {
            return res.status(404).json({ message: 'Document not found or invalid field' });
        }
        return res.status(200).json({ message: 'SPES document replaced successfully' });
    } catch (error) {
        console.error('Error replacing SPES document:', error.message);
        return res.status(500).json({ message: 'Error replacing SPES document' });
    }
};
