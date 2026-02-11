const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const SECRET_KEY = "happypet-secret-key-change-this"; 

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Middleware for Admin Check
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
};

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password, name, role } = req.body;
    try {
        const user = await prisma.user.create({
            data: { username, password, name, role: role || 'customer' }
        });
        res.json({ message: 'User created' });
    } catch (e) {
        res.status(400).json({ error: 'Username already exists' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.password !== password) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET_KEY);
    res.json({ token, role: user.role, name: user.name });
});

// --- USERS (ADMIN ONLY) ---
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
    const users = await prisma.user.findMany({ orderBy: { id: 'desc' } });
    res.json(users);
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'User deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// --- APPOINTMENTS ---

// Get All
app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            orderBy: { createdAt: 'desc' }
        });
        const formatted = appointments.map(app => ({
            ...app,
            timeDisplay: app.timeSlot || (app.appointmentDate ? new Date(app.appointmentDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'Walk-in'),
            dateDisplay: app.appointmentDate ? new Date(app.appointmentDate).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH')
        }));
        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create
app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { 
        ownerName, petName, petType, breed, weight, height, 
        phone, symptoms, date, timeSlot, isWalkIn 
    } = req.body;
    
    let appointmentDate = new Date();
    if (date) appointmentDate = new Date(date);

    try {
        const newItem = await prisma.appointment.create({
            data: {
                ownerName, petName, petType, breed, weight, height,
                phone, symptoms, isWalkIn: isWalkIn || false,
                appointmentDate, timeSlot,
                status: isWalkIn ? 'waiting' : 'pending'
            }
        });
        res.json(newItem);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Update Status (Staff/Doctor)
app.put('/api/appointments/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status, diagnosis, prescription, price } = req.body;
    try {
        const updateData = { status };
        if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
        if (prescription !== undefined) updateData.prescription = prescription;
        if (price !== undefined) updateData.price = parseFloat(price);

        const updated = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// Admin: Edit Full Appointment Info
app.put('/api/appointments/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { ownerName, petName, date, timeSlot, status, symptoms } = req.body;
    try {
        let appointmentDate = undefined;
        if (date) appointmentDate = new Date(date);

        const updated = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: { 
                ownerName, petName, timeSlot, status, symptoms,
                ...(appointmentDate && { appointmentDate })
            }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Admin: Delete Appointment
app.delete('/api/appointments/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await prisma.appointment.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});