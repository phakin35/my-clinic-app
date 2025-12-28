const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
// const bcrypt = require('bcryptjs'); // ไม่ใช้แล้ว
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const SECRET_KEY = "my-secret-key-change-this-in-production";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- AUTH MIDDLEWARE ---
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

// --- AUTH ROUTES ---

// 1. สมัครสมาชิก (Register) - แบบไม่เข้ารหัส
app.post('/api/auth/register', async (req, res) => {
    const { username, password, name, role } = req.body;
    
    // ไม่ต้อง Hash Password
    // const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
        const user = await prisma.user.create({
            data: {
                username,
                password: password, // เก็บ Password ตรงๆ เลย
                name,
                role: role || 'customer'
            }
        });
        res.json({ message: 'User created', userId: user.id });
    } catch (e) {
        res.status(400).json({ error: 'Username already exists' });
    }
});

// 2. เข้าสู่ระบบ (Login) - แบบไม่เข้ารหัส
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) return res.status(400).json({ error: 'User not found' });

    // เปรียบเทียบรหัสผ่านตรงๆ (String Comparison)
    if (password !== user.password) {
        return res.status(400).json({ error: 'Invalid password' });
    }

    // สร้าง Token
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, role: user.role, name: user.name });
});

// --- API ROUTES (Protected) ---

app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const formatted = appointments.map(app => ({
            ...app,
            timeDisplay: app.appointmentDate ? new Date(app.appointmentDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'Walk-in',
            dateDisplay: app.appointmentDate ? new Date(app.appointmentDate).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH')
        }));
        
        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { ownerName, petName, petType, phone, symptoms, date, time, isWalkIn } = req.body;
    
    let appointmentDate = new Date();
    if (date && time) appointmentDate = new Date(`${date}T${time}:00`);

    try {
        const newItem = await prisma.appointment.create({
            data: {
                ownerName, petName, petType, phone, symptoms,
                isWalkIn: isWalkIn || false,
                appointmentDate,
                status: isWalkIn ? 'waiting' : 'pending'
            }
        });
        res.json(newItem);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.put('/api/appointments/:id/status', authenticateToken, async (req, res) => {
    if (req.user.role === 'customer') return res.status(403).json({ error: 'Access denied' });

    const { id } = req.params;
    const { status, diagnosis, prescription, price } = req.body;

    try {
        const updated = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: { status, diagnosis, prescription, price: price ? parseFloat(price) : undefined }
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed' });
    }
});

// ใช้ process.env.PORT สำหรับ Deploy หรือ 3000 สำหรับ Local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});