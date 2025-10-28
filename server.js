// server.js - Healthcare Expense Tracker Backend
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'expenses.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Initialize data file if it doesn't exist
const initializeDataFile = async () => {
    try {
        await fs.access(DATA_FILE);
    } catch (error) {
        // File doesn't exist, create it with empty array
        await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
        console.log('Initialized expenses.json file');
    }
};

// Helper function to read expenses from file
const readExpenses = async () => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading expenses:', error);
        return [];
    }
};

// Helper function to write expenses to file
const writeExpenses = async (expenses) => {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(expenses, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing expenses:', error);
        return false;
    }
};

// Validation middleware
const validateExpense = (req, res, next) => {
    const { description, amount, category, date } = req.body;
    const errors = [];

    if (!description || description.trim().length === 0) {
        errors.push('Description is required');
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        errors.push('Valid amount is required');
    }

    if (!category || !['medication', 'consultation', 'test', 'insurance', 'other'].includes(category)) {
        errors.push('Valid category is required');
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push('Valid date is required (YYYY-MM-DD format)');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors
        });
    }

    next();
};

// Routes

// GET /api/expenses - Get all expenses
app.get('/api/expenses', async (req, res) => {
    try {
        const expenses = await readExpenses();
        
        // Optional query parameters for filtering
        const { category, startDate, endDate, limit } = req.query;
        let filteredExpenses = expenses;

        // Filter by category
        if (category) {
            filteredExpenses = filteredExpenses.filter(expense => 
                expense.category === category
            );
        }

        // Filter by date range
        if (startDate || endDate) {
            filteredExpenses = filteredExpenses.filter(expense => {
                const expenseDate = new Date(expense.date);
                const start = startDate ? new Date(startDate) : new Date('1900-01-01');
                const end = endDate ? new Date(endDate) : new Date('2100-12-31');
                return expenseDate >= start && expenseDate <= end;
            });
        }

        // Limit results
        if (limit && !isNaN(limit)) {
            filteredExpenses = filteredExpenses.slice(0, parseInt(limit));
        }

        // Sort by date (newest first)
        filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            data: filteredExpenses,
            total: filteredExpenses.length
        });
    } catch (error) {
        console.error('Error getting expenses:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving expenses'
        });
    }
});

// GET /api/expenses/:id - Get specific expense
app.get('/api/expenses/:id', async (req, res) => {
    try {
        const expenses = await readExpenses();
        const expense = expenses.find(exp => exp.id === req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.json({
            success: true,
            data: expense
        });
    } catch (error) {
        console.error('Error getting expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving expense'
        });
    }
});

// POST /api/expenses - Create new expense
app.post('/api/expenses', validateExpense, async (req, res) => {
    try {
        const expenses = await readExpenses();
        
        const newExpense = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            description: req.body.description.trim(),
            amount: parseFloat(req.body.amount),
            category: req.body.category,
            date: req.body.date,
            notes: req.body.notes ? req.body.notes.trim() : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        expenses.push(newExpense);
        const success = await writeExpenses(expenses);

        if (success) {
            res.status(201).json({
                success: true,
                message: 'Expense created successfully',
                data: newExpense
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error saving expense'
            });
        }
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating expense'
        });
    }
});

// PUT /api/expenses/:id - Update existing expense
app.put('/api/expenses/:id', validateExpense, async (req, res) => {
    try {
        const expenses = await readExpenses();
        const expenseIndex = expenses.findIndex(exp => exp.id === req.params.id);

        if (expenseIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        // Update the expense
        expenses[expenseIndex] = {
            ...expenses[expenseIndex],
            description: req.body.description.trim(),
            amount: parseFloat(req.body.amount),
            category: req.body.category,
            date: req.body.date,
            notes: req.body.notes ? req.body.notes.trim() : '',
            updatedAt: new Date().toISOString()
        };

        const success = await writeExpenses(expenses);

        if (success) {
            res.json({
                success: true,
                message: 'Expense updated successfully',
                data: expenses[expenseIndex]
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error updating expense'
            });
        }
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating expense'
        });
    }
});

// DELETE /api/expenses/:id - Delete specific expense
app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const expenses = await readExpenses();
        const expenseIndex = expenses.findIndex(exp => exp.id === req.params.id);

        if (expenseIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        const deletedExpense = expenses.splice(expenseIndex, 1)[0];
        const success = await writeExpenses(expenses);

        if (success) {
            res.json({
                success: true,
                message: 'Expense deleted successfully',
                data: deletedExpense
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error deleting expense'
            });
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({
            success: false,