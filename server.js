const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const prisma = new PrismaClient();
const SECRET_KEY = "my-secret-key-change-this-in-production";

app.use(cors());
app.use(express.json());
// ให้ Server เสิร์ฟไฟล์จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// --- Middleware ตรวจสอบสิทธิ์ ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401); // 401 Unauthorized

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403); // 403 Forbidden
        req.user = user;
        next();
    });
};

// --- API: Authentication ---

// สมัครสมาชิก (เฉพาะลูกค้า)
app.post('/api/auth/register', async (req, res) => {
    const { username, password, name, role } = req.body;
    try {
        // สร้าง User ใหม่
        const user = await prisma.user.create({
            data: { 
                username, 
                password, // ใน Production ควร Hash Password ด้วย bcrypt
                name, 
                role: role || 'customer' // ถ้าไม่ส่งมาให้เป็น customer
            }
        });
        res.json({ message: 'User created successfully' });
    } catch (e) {
        res.status(400).json({ error: 'Username already exists' });
    }
});

// เข้าสู่ระบบ
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    // ตรวจสอบรหัสผ่าน (แบบง่าย)
    if (!user || user.password !== password) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }

    // สร้าง Token
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET_KEY);
    res.json({ token, role: user.role, name: user.name });
});

// --- API: Appointments ---

// ดึงข้อมูลนัดหมายทั้งหมด
app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            orderBy: { createdAt: 'desc' } // เรียงจากใหม่ไปเก่า
        });

        // จัดรูปแบบข้อมูลก่อนส่งกลับ
        const formatted = appointments.map(app => ({
            ...app,
            // ถ้ามี TimeSlot ให้ใช้ TimeSlot ถ้าไม่มีให้แปลงจาก Date
            timeDisplay: app.timeSlot || (app.appointmentDate ? new Date(app.appointmentDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'Walk-in'),
            dateDisplay: app.appointmentDate ? new Date(app.appointmentDate).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH')
        }));
        
        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// สร้างนัดหมายใหม่ (จองคิว)
app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { 
        ownerName, petName, petType, breed, weight, height, 
        phone, symptoms, date, timeSlot, isWalkIn 
    } = req.body;
    
    // แปลงวันที่เป็น Date Object
    let appointmentDate = new Date();
    if (date) appointmentDate = new Date(date);

    try {
        const newItem = await prisma.appointment.create({
            data: {
                ownerName, petName, petType, 
                breed, weight, height, // ฟิลด์ใหม่
                phone, symptoms, 
                isWalkIn: isWalkIn || false,
                appointmentDate,
                timeSlot, // เก็บช่วงเวลา เช่น "09:00-09:30"
                status: isWalkIn ? 'waiting' : 'pending' // ถ้า Walk-in ให้สถานะเป็นรอตรวจเลย
            }
        });
        res.json(newItem);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
});

// อัปเดตสถานะ / ผลตรวจ / ราคา
app.put('/api/appointments/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status, diagnosis, prescription, price } = req.body;

    try {
        // สร้าง Object ข้อมูลที่จะอัปเดต (อัปเดตเฉพาะค่าที่ส่งมา)
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
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

// ใช้ Port จาก Environment หรือ 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});