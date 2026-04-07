const db = require('../../db');

// Create a new program
exports.createProgram = async (req, res) => {
    try {
        const { name, location, slots, budget, status } = req.body;

        if (!name || !location || !slots || !budget) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const query = `
            INSERT INTO programs (program_name, location, slots, budget, status, filled, used)
            VALUES (?, ?, ?, ?, ?, 0, 0)
        `;

        const [result] = await db.execute(query, [name, location, slots, budget, status]);

        res.status(201).json({ 
            message: "Program created successfully!", 
            id: result.insertId,
            program: {
                program_id: result.insertId,
                name,
                location,
                slots,
                budget,
                status,
                filled: 0,
                used: 0
            }
        });
    } catch (error) {
        console.error("Error creating program:", error);
        res.status(500).json({ message: "Error creating program", error: error.message });
    }
};

// Get all programs
exports.getAllPrograms = async (req, res) => {
    try {
        const query = 'SELECT * FROM programs ORDER BY program_id DESC';
        const [programs] = await db.execute(query);
        res.status(200).json(programs);
    } catch (error) {
        console.error("Error fetching programs:", error);
        res.status(500).json({ message: "Error fetching programs", error: error.message });
    }
};

// Get a single program
exports.getProgram = async (req, res) => {
    try {
        const { program_id } = req.params;
        const query = 'SELECT * FROM programs WHERE program_id = ?';
        const [program] = await db.execute(query, [program_id]);
        
        if (program.length === 0) {
            return res.status(404).json({ message: "Program not found" });
        }

        res.status(200).json(program[0]);
    } catch (error) {
        console.error("Error fetching program:", error);
        res.status(500).json({ message: "Error fetching program", error: error.message });
    }
};

// Update a program
exports.updateProgram = async (req, res) => {
    try {
        const { program_id } = req.params;
        const { name, location, slots, budget, status } = req.body;

        const query = `
            UPDATE programs 
            SET program_name = ?, location = ?, slots = ?, budget = ?, status = ?
            WHERE program_id = ?
        `;

        const [result] = await db.execute(query, [name, location, slots, budget, status, program_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Program not found" });
        }

        res.status(200).json({ message: "Program updated successfully!" });
    } catch (error) {
        console.error("Error updating program:", error);
        res.status(500).json({ message: "Error updating program", error: error.message });
    }
};

// Delete a program
exports.deleteProgram = async (req, res) => {
    try {
        const { program_id } = req.params;
        
        const query = 'DELETE FROM programs WHERE program_id = ?';
        const [result] = await db.execute(query, [program_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Program not found" });
        }

        res.status(200).json({ message: "Program deleted successfully!" });
    } catch (error) {
        console.error("Error deleting program:", error);
        res.status(500).json({ message: "Error deleting program", error: error.message });
    }
};
