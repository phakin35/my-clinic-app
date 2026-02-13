const express = require('express');
const cors = require('cors');
const path = require('path'); // เพิ่ม: เรียกใช้ module path
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'], // เปิด Log เพื่อดูการทำงานของ Database
});
const PORT = 3000;

app.use(cors()); // อนุญาตให้หน้าเว็บ (index.html) เรียกใช้งาน API ได้
app.use(express.json()); // รองรับการรับข้อมูลแบบ JSON

// --- สำคัญ: ตั้งค่าให้ Server อ่านไฟล์หน้าเว็บ (HTML/JS) ---
app.use(express.static(__dirname));

// Route สำหรับหน้าแรก (ถ้าเข้า localhost:3000 ให้ส่ง index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ROUTES (API) ---

// 1. Register (สมัครสมาชิก)
app.post('/api/register', async (req, res) => {
    console.log("➡️ Register Request:", req.body);
    try {
        const { username, password, name, role } = req.body;
        
        // Validation ง่ายๆ
        if (!username || !password || !name) {
            throw new Error("ข้อมูลไม่ครบถ้วน (Username, Password, Name จำเป็นต้องมี)");
        }

        const user = await prisma.user.create({
            data: { 
                username, 
                password, 
                name, 
                role: role || 'customer' // ถ้าไม่ส่ง role มา ให้เป็น customer
            }
        });
        console.log("✅ Register Success ID:", user.id);
        res.json({ success: true, user });
    } catch (error) {
        console.error("❌ Register Error:", error.message);
        // P2002 คือรหัส Error ของ Prisma กรณีข้อมูลซ้ำ (Unique constraint failed)
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, error: 'Username นี้ถูกใช้งานแล้ว' });
        }
        res.status(400).json({ success: false, error: 'ระบบผิดพลาด: ' + error.message });
    }
});

// 2. Login (เข้าสู่ระบบ)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (user && user.password === password) {
            console.log(`✅ Login Success: ${username}`);
            res.json({ success: true, user });
        } else {
            console.warn(`⚠️ Login Failed: ${username}`);
            res.status(401).json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Get All Appointments (ดึงรายการนัดหมายทั้งหมด)
app.get('/api/appointments', async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            orderBy: { createdAt: 'desc' } // เรียงจากใหม่ไปเก่า
        });
        res.json(appointments);
    } catch (error) {
        console.error("❌ Fetch Appointments Error:", error);
        res.status(500).json({ error: "ไม่สามารถดึงข้อมูลได้: " + error.message });
    }
});

// 4. Create Appointment (จองคิว / นัดหมาย)
app.post('/api/appointments', async (req, res) => {
    console.log("➡️ Booking Request:", req.body);
    try {
        const { 
            ownerName, phone, 
            petName, petType, breed, weight, height, symptoms,
            appointmentDate, timeSlot, isWalkIn, status
        } = req.body;

        // เช็คข้อมูลสำคัญ
        if (!ownerName || !petName || !petType || !symptoms) {
             throw new Error("ข้อมูลสำคัญไม่ครบ (ชื่อเจ้าของ, ชื่อสัตว์เลี้ยง, ประเภท, อาการ)");
        }

        // แปลงวันที่ (ถ้ามี)
        let validDate = null;
        if (appointmentDate) {
            validDate = new Date(appointmentDate);
            if (isNaN(validDate.getTime())) {
                validDate = null; 
            }
        }

        const newAppt = await prisma.appointment.create({
            data: {
                ownerName, 
                phone: phone || '', 
                petName, 
                petType, 
                breed: breed || '', 
                weight: weight || '', 
                height: height || '', 
                symptoms,
                appointmentDate: validDate,
                timeSlot: timeSlot || '', 
                isWalkIn: isWalkIn || false, 
                status: status || 'pending'
            }
        });
        
        console.log("✅ Booking Created ID:", newAppt.id);
        res.json({ success: true, data: newAppt });
    } catch (error) {
        console.error("❌ Booking Error:", error);
        res.status(500).json({ success: false, error: "บันทึกไม่สำเร็จ: " + error.message });
    }
});

// 5. Update Appointment (อัปเดตสถานะ / บันทึกผลตรวจ / จ่ายเงิน)
app.put('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body; // รับข้อมูลที่จะแก้มาเป็น Object เลย
        console.log(`➡️ Update ID ${id} with:`, data);

        const updated = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: data
        });
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error("❌ Update Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`---------------------------------------------------`);
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📦 Database: Connected via Prisma`);
    console.log(`🌐 Website: Open http://localhost:${PORT} in your browser`); // เพิ่มข้อความแนะนำ
    console.log(`---------------------------------------------------`);
});