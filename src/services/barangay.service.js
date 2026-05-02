const db = require('../../config');

// List of all 25 barangays in Juban, Sorsogon
const JUBAN_BARANGAYS = [
    "Anog",
    "Aroroy",
    "Bacolod",
    "Binanuahan",
    "Biriran",
    "Buraburan",
    "Calateo",
    "Calmayon",
    "Carohayon",
    "Catanagan",
    "Catanusan",
    "Cogon",
    "Embarcadero",
    "Guruyan",
    "Lajong",
    "Maalo",
    "North Poblacion",
    "Puting Sapa",
    "Rangas",
    "Sablayan",
    "Sipaya",
    "South Poblacion",
    "Taboc",
    "Tinago",
    "Tughan"
];

// Get list of all barangays
exports.getBarangayList = async () => {
    return {
        barangays: JUBAN_BARANGAYS.map(name => ({ name }))
    };
};

// Helper function to calculate date filters based on timeRange
const getDateFilter = (timeRange) => {
    const now = new Date();
    let startDate = null;
    
    switch (timeRange) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
        case '6months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            break;
        case 'year':
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            break;
        default:
            // Default to all time (no date filter)
            return null;
    }
    
    return startDate;
};

// Helper function to extract barangay from address with multiple format support
const extractBarangay = (address) => {
    if (!address || typeof address !== 'string') return null;
    
    const trimmed = address.trim();
    if (!trimmed) return null;
    
    // Try different parsing strategies
    const parts = trimmed.split(',').map(p => p.trim());
    
    if (parts.length >= 2) {
        // Format: "Street, Barangay, City" or "Barangay, City"
        // Try 2nd part first (index 1) for "Barangay, City" format
        if (parts[1]) return parts[1];
        // Fall back to 1st part if 2nd is empty
        return parts[0];
    } else if (parts.length === 1) {
        // Single part - check if it matches any known barangay
        return parts[0];
    }
    
    return null;
};

// Helper function to normalize program type for display
const normalizeProgramType = (programType) => {
    if (!programType) return 'N/A';
    const normalized = programType.toLowerCase().trim();
    // Map to friendly display names
    const programMap = {
        'tupad': 'TUPAD',
        'spes': 'SPES',
        'dilp': 'DILP',
        'gip': 'GIP',
        'job_seekers': 'Job Seekers',
        'jobseeker': 'Job Seekers'
    };
    return programMap[normalized] || programType.toUpperCase();
};

// Main function to get filtered barangay data
exports.getFilteredBarangays = async ({ program, timeRange, sortOrder, selectedBarangay }) => {
    // Build the WHERE clause
    let whereConditions = [];
    let params = [];
    
    // Date filter
    const startDate = getDateFilter(timeRange);
    if (startDate) {
        whereConditions.push("b.created_at >= ?");
        params.push(startDate);
    }
    
    // Program filter - filter by program type in applications
    let useJoin = false;
    if (program && program !== 'all') {
        useJoin = true;
    }
    
    const baseWhereClause = whereConditions.length > 0 
        ? "WHERE " + whereConditions.join(" AND ") + " AND b.address IS NOT NULL AND TRIM(b.address) != ''"
        : "WHERE b.address IS NOT NULL AND TRIM(b.address) != ''";
    
    // Determine sort order
    const orderClause = sortOrder === 'desc' 
        ? "ORDER BY barangay DESC, program_type ASC" 
        : "ORDER BY barangay ASC, program_type ASC";
    
    // Build SQL based on whether we need program_type in results
    let sql;
    if (useJoin) {
        // When filtering by program, still show that program type
        sql = `
            SELECT 
                b.address,
                b.gender,
                b.beneficiary_id,
                b.user_id,
                a.program_type
            FROM beneficiaries b
            INNER JOIN applications a ON b.user_id = a.user_id
            ${baseWhereClause}
        `;
    } else {
        // Get program type from any approved application for the beneficiary
        sql = `
            SELECT 
                b.address,
                b.gender,
                b.beneficiary_id,
                b.user_id,
                (
                    SELECT a2.program_type 
                    FROM applications a2 
                    WHERE a2.user_id = b.user_id 
                    AND a2.status = 'Approved'
                    ORDER BY a2.updated_at DESC 
                    LIMIT 1
                ) AS program_type
            FROM beneficiaries b
            ${baseWhereClause}
        `;
    }
    
    // Debug: Log the SQL and params
    console.log('Barangay query:', sql);
    console.log('Params:', params);
    
    const [rows] = await db.execute(sql, params);
    
    // Debug: Log sample addresses to understand format
    if (rows.length > 0) {
        console.log('Sample addresses:', rows.slice(0, 3).map(r => r.address));
    }
    
    // Process rows and extract barangay using the helper function
    const processedData = rows.map(row => ({
        barangay: extractBarangay(row.address),
        gender: row.gender,
        program_type: row.program_type || 'N/A'
    })).filter(row => row.barangay && row.barangay.toLowerCase() !== 'unknown');
    
    // Apply selected barangay filter if specified
    const filteredData = (selectedBarangay && selectedBarangay !== 'all')
        ? processedData.filter(row => row.barangay === selectedBarangay)
        : processedData;
    
    // Apply program filter if specified (after getting program_type)
    let finalData = filteredData;
    if (program && program !== 'all') {
        finalData = filteredData.filter(row => 
            (row.program_type || '').toLowerCase() === program.toLowerCase()
        );
    }
    
    // Group by barangay AND program_type
    const barangayGroups = {};
    finalData.forEach(row => {
        const key = `${row.barangay}|${row.program_type}`;
        if (!barangayGroups[key]) {
            barangayGroups[key] = { 
                barangay: row.barangay, 
                program_type: normalizeProgramType(row.program_type),
                male: 0, 
                female: 0, 
                total: 0 
            };
        }
        const gender = (row.gender || '').toLowerCase().trim();
        if (gender === 'male') {
            barangayGroups[key].male++;
        } else if (gender === 'female') {
            barangayGroups[key].female++;
        } else {
            // Default to male if gender not specified (count as 0 for both)
            // Or could count as unknown - but we show 0 for both
        }
        barangayGroups[key].total++;
    });
    
    // Convert to array and sort
    const sortedBarangays = Object.values(barangayGroups)
        .map(data => ({
            barangay: data.barangay,
            program_type: data.program_type,
            male: data.male || 0,
            female: data.female || 0,
            total: data.total || 0
        }))
        .sort((a, b) => {
            const barangayCompare = sortOrder === 'desc' 
                ? b.barangay.localeCompare(a.barangay) 
                : a.barangay.localeCompare(b.barangay);
            if (barangayCompare !== 0) return barangayCompare;
            // Secondary sort by program_type
            return a.program_type.localeCompare(b.program_type);
        })
        .slice(0, 50);
    
    // Calculate totals
    const totalMale = sortedBarangays.reduce((sum, row) => sum + row.male, 0);
    const totalFemale = sortedBarangays.reduce((sum, row) => sum + row.female, 0);
    const grandTotal = sortedBarangays.reduce((sum, row) => sum + row.total, 0);
    
    return {
        barangays: sortedBarangays,
        summary: {
            total_male: totalMale,
            total_female: totalFemale,
            grand_total: grandTotal
        },
        filters: {
            program: program || 'all',
            timeRange: timeRange || 'year',
            sortOrder: sortOrder || 'asc',
            selectedBarangay: selectedBarangay || 'all'
        },
        debug: {
            totalRowsFound: rows.length,
            rowsWithBarangay: processedData.length
        }
    };
};

// Legacy function for backwards compatibility
exports.getBarangayBeneficiariesStats = async () => {
    const [rows] = await db.execute(`
        SELECT 
            SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(b.address), ',', 2), ',', -1) AS barangay,
            SUM(CASE WHEN LOWER(TRIM(b.gender)) = 'male' THEN 1 ELSE 0 END) AS male_count,
            SUM(CASE WHEN LOWER(TRIM(b.gender)) = 'female' THEN 1 ELSE 0 END) AS female_count,
            COUNT(*) AS total_beneficiaries
        FROM beneficiaries b 
        WHERE b.address IS NOT NULL AND TRIM(b.address) != ''
        GROUP BY barangay
        ORDER BY total_beneficiaries DESC
        LIMIT 20
    `);
    
    const totalMale = rows.reduce((sum, row) => sum + (row.male_count || 0), 0);
    const totalFemale = rows.reduce((sum, row) => sum + (row.female_count || 0), 0);
    const grandTotal = rows.reduce((sum, row) => sum + (row.total_beneficiaries || 0), 0);
    
    return {
        barangays: rows.map(row => ({
            barangay: row.barangay || 'Unknown',
            male: row.male_count || 0,
            female: row.female_count || 0,
            total: row.total_beneficiaries || 0
        })),
        summary: {
            total_male: totalMale,
            total_female: totalFemale,
            grand_total: grandTotal
        }
    };
};
