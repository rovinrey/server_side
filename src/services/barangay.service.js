const db = require('../../config');

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

