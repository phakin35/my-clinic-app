const API_URL = 'http://localhost:3000/api';

// State
let appointments = []; 
let currentUser = JSON.parse(localStorage.getItem('clinic_current_user')) || null;
let activeExamId = null;

// Helper: Status Translate
const STATUS_TH = {
    pending: '<span class="text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded">รอเช็คอิน</span>',
    waiting: '<span class="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">รอตรวจ</span>',
    examining: '<span class="text-yellow-600 font-bold bg-yellow-50 px-2 py-1 rounded border border-yellow-200">กำลังตรวจ</span>',
    pharmacy: '<span class="text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded border border-purple-200 animate-pulse">รอชำระเงิน</span>',
    completed: '<span class="text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-200">เสร็จสิ้น</span>',
    cancelled: '<span class="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">ยกเลิก</span>'
};

// --- 1. INIT & UTILS ---
async function init() {
    lucide.createIcons();
    startClock();
    
    if (currentUser) {
        renderUIByRole();
        await fetchAppointments();
    }
}

async function fetchAppointments() {
    try {
        const res = await fetch(`${API_URL}/appointments`);
        if(res.ok) {
            appointments = await res.json();
            
            if(currentUser.role === 'customer') loadCustomerData();
            else if(currentUser.role === 'reception') renderReceptionTable();
            else if(currentUser.role === 'doctor') renderDoctorQueue();
            else if(currentUser.role === 'admin') renderAdminAppts();
            
            if(document.getElementById('queueBoard').style.display === 'block') {
                updateQueueBoard();
            }
        }
    } catch (err) {
        console.error("Connection Error:", err);
    }
}

function formatDate(dateString) {
    if(!dateString) return '-';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('th-TH', options);
}

// --- 2. AUTHENTICATION ---
async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('clinic_current_user', JSON.stringify(currentUser));
            closeModal('loginModal');
            renderUIByRole();
            fetchAppointments();
            Swal.fire({ icon: 'success', title: 'ยินดีต้อนรับ', text: `สวัสดีคุณ ${currentUser.name}`, timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'เข้าสู่ระบบไม่สำเร็จ', text: data.error });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'ไม่สามารถเชื่อมต่อ Server ได้' });
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('reg-name').value,
        username: document.getElementById('reg-user').value,
        password: document.getElementById('reg-pass').value,
        role: document.getElementById('reg-role').value
    };

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            closeModal('registerModal');
            Swal.fire('สำเร็จ', 'สมัครสมาชิกเรียบร้อย', 'success');
        } else {
            Swal.fire('ล้มเหลว', data.error, 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Connection failed', 'error');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('clinic_current_user');
    location.reload();
}

function checkAuthAndBook() {
    if (currentUser) {
        goToDashboard();
    } else {
        openModal('loginModal');
    }
}

// --- 3. NAVIGATION & UI ---
function renderUIByRole() {
    document.getElementById('nav-guest-menu').classList.add('hidden');
    document.getElementById('nav-auth-guest').classList.add('hidden');
    document.getElementById('nav-role-menu').classList.remove('hidden');
    document.getElementById('nav-auth-user').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = currentUser.name;
    document.getElementById('user-role-display').innerText = currentUser.role === 'reception' ? 'Assistant' : currentUser.role.toUpperCase();

    if(currentUser.role === 'customer') {
        document.getElementById('nav-btn-add-pet').classList.remove('hidden');
        document.getElementById('nav-btn-add-pet').classList.add('flex');
    } else {
        document.getElementById('nav-btn-add-pet').classList.add('hidden');
    }

    document.getElementById('landing-page').classList.add('hidden');
    const dashboard = document.getElementById('app-dashboard');
    dashboard.classList.remove('hidden-section');

    ['view-customer', 'view-reception', 'view-doctor', 'view-admin'].forEach(id => {
        document.getElementById(id).classList.add('hidden-section');
    });

    if (currentUser.role === 'customer') {
        document.getElementById('view-customer').classList.remove('hidden-section');
        loadCustomerData();
    } else if (currentUser.role === 'reception') {
        document.getElementById('view-reception').classList.remove('hidden-section');
        renderReceptionTable();
    } else if (currentUser.role === 'doctor') {
        document.getElementById('view-doctor').classList.remove('hidden-section');
        renderDoctorQueue();
    } else if (currentUser.role === 'admin') {
        document.getElementById('view-admin').classList.remove('hidden-section');
    }

    if (['reception', 'doctor', 'admin'].includes(currentUser.role)) {
        document.getElementById('btn-queue-board').classList.remove('hidden');
        document.getElementById('btn-queue-board').classList.add('flex');
    }
    
    lucide.createIcons();
}

function goHome() {
    if(currentUser) goToDashboard();
    else location.reload();
}

function goToDashboard() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app-dashboard').classList.remove('hidden-section');
    scrollToSection('app-dashboard');
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if(el) el.scrollIntoView({ behavior: 'smooth' });
}

function openModal(id, mode = 'user') { 
    document.getElementById(id).classList.remove('hidden'); 
    if(id === 'loginModal') {
        document.getElementById('login-title').innerText = mode === 'staff' ? 'เข้าสู่ระบบ (เจ้าหน้าที่)' : 'เข้าสู่ระบบ';
    }
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openContactModal() { document.getElementById('contactModal').classList.remove('hidden'); }

// --- 4. CUSTOMER LOGIC ---
function loadCustomerData() {
    document.getElementById('cust-ownerName').value = currentUser.name;
    const petSelect = document.getElementById('cust-pet-select');
    petSelect.innerHTML = '<option value="">-- เลือกสัตว์เลี้ยง (จากประวัติเดิม) --</option>';
    
    const myHistory = appointments.filter(a => a.ownerName === currentUser.name); 
    const uniquePets = [...new Set(myHistory.map(item => item.petName))];
    
    uniquePets.forEach(petName => {
        const p = myHistory.find(item => item.petName === petName);
        if(p) {
            const petData = JSON.stringify({ name: p.petName, type: p.petType, breed: p.breed, weight: p.weight, height: p.height });
            petSelect.innerHTML += `<option value='${petData}'>${p.petName} (${p.petType})</option>`;
        }
    });
    
    renderCustomerLists();
}

function renderCustomerLists() {
    const myAppts = appointments.filter(a => a.ownerName === currentUser.name);
    myAppts.sort((a,b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

    // Separate lists
    const upcoming = myAppts.filter(a => ['pending', 'waiting', 'examining', 'pharmacy'].includes(a.status));
    const history = myAppts.filter(a => ['completed', 'cancelled'].includes(a.status));

    const createCard = (a, canCancel) => `
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition">
            <div class="cursor-pointer" onclick="viewAppointmentDetails(${a.id})">
                <div class="font-bold text-slate-800 flex items-center gap-2">
                    ${a.petName} 
                    <span class="text-xs font-normal text-slate-500">(${formatDate(a.appointmentDate)} ${a.timeSlot})</span>
                </div>
                <div class="text-sm text-slate-500">อาการ: ${a.symptoms}</div>
            </div>
            <div class="text-right flex flex-col items-end gap-2">
                <div class="text-xs">${STATUS_TH[a.status] || a.status}</div>
                ${canCancel ? `<button onclick="handleCancelBooking(${a.id})" class="text-xs text-red-400 hover:text-red-600 underline">ยกเลิก</button>` : ''}
                <button onclick="viewAppointmentDetails(${a.id})" class="text-xs text-blue-500 hover:underline">ดูรายละเอียด</button>
            </div>
        </div>`;

    document.getElementById('customer-upcoming-list').innerHTML = upcoming.length 
        ? upcoming.map(a => createCard(a, a.status === 'pending')).join('') 
        : '<div class="text-slate-400 text-sm italic">ไม่มีนัดหมายเร็วๆ นี้</div>';

    document.getElementById('customer-history-list').innerHTML = history.length 
        ? history.map(a => createCard(a, false)).join('') 
        : '<div class="text-slate-400 text-sm italic">ไม่มีประวัติการรักษา</div>';

    lucide.createIcons();
}

function fillPetInfo(jsonStr) {
    try {
        const pet = JSON.parse(jsonStr);
        if(pet) {
            document.getElementById('bk-petName').value = pet.name;
            document.getElementById('bk-petType').value = pet.type;
            document.getElementById('bk-breed').value = pet.breed || '';
            document.getElementById('bk-weight').value = pet.weight || '';
            document.getElementById('bk-height').value = pet.height || '';
        }
    } catch(e) {}
}

function handleAddPet(e) {
    e.preventDefault();
    if(document.getElementById('bk-petName')) {
        document.getElementById('bk-petName').value = document.getElementById('pet-name').value;
        document.getElementById('bk-petType').value = document.getElementById('pet-type').value;
        document.getElementById('bk-breed').value = document.getElementById('pet-breed').value;
        document.getElementById('bk-weight').value = document.getElementById('pet-weight').value;
    }
    closeModal('petModal');
    Swal.fire('พร้อม', 'กรอกข้อมูลสัตว์เลี้ยงลงในแบบฟอร์มจองแล้ว', 'success');
}

async function handleCustomerBooking(e) {
    e.preventDefault();
    const payload = {
        ownerName: currentUser.name,
        phone: document.getElementById('cust-phone').value,
        petName: document.getElementById('bk-petName').value,
        petType: document.getElementById('bk-petType').value,
        breed: document.getElementById('bk-breed').value,
        weight: document.getElementById('bk-weight').value,
        height: document.getElementById('bk-height').value,
        symptoms: document.getElementById('cust-symptom').value,
        appointmentDate: document.getElementById('cust-date').value,
        timeSlot: document.getElementById('cust-time').value,
        isWalkIn: false,
        status: 'pending'
    };

    try {
        const res = await fetch(`${API_URL}/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            await fetchAppointments(); 
            document.querySelector('#view-customer form').reset();
            Swal.fire('จองคิวสำเร็จ', 'ระบบบันทึกข้อมูลเรียบร้อย', 'success');
        }
    } catch(err) {
        Swal.fire('Error', 'Connection failed', 'error');
    }
}

async function handleCancelBooking(id) {
    if(confirm("ยืนยันการยกเลิกนัดหมาย?")) {
        await updateStatus(id, 'cancelled');
        Swal.fire('ยกเลิกแล้ว', '', 'success');
    }
}

// --- 5. RECEPTION LOGIC (Assistant) ---
function renderReceptionTable() {
    const tbody = document.getElementById('reception-table-body');
    const search = document.getElementById('reception-search').value.toLowerCase();
    const filter = document.getElementById('reception-filter').value;
    
    document.getElementById('stat-pending').innerText = appointments.filter(a => a.status === 'pending').length;
    document.getElementById('stat-waiting').innerText = appointments.filter(a => a.status === 'waiting').length;
    document.getElementById('stat-pharmacy').innerText = appointments.filter(a => a.status === 'pharmacy').length;
    document.getElementById('stat-completed').innerText = appointments.filter(a => a.status === 'completed').length;

    const today = new Date().toISOString().split('T')[0]; 
    
    let filtered = appointments.filter(a => {
        if (a.status === 'cancelled') return false; 
        
        let matchDate = true;
        const apptDateStr = a.appointmentDate ? a.appointmentDate.split('T')[0] : '';
        
        if (filter === 'today') {
            if (a.status === 'pharmacy') {
                matchDate = true; 
            } else {
                matchDate = apptDateStr === today;
            }
        }

        const matchSearch = (a.ownerName.toLowerCase().includes(search) || a.petName.toLowerCase().includes(search));
        return matchSearch && matchDate;
    });

    tbody.innerHTML = filtered.map(a => {
        let btnAction = '';
        if(a.status === 'pending') {
            btnAction = `<button onclick="updateStatus(${a.id}, 'waiting')" class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 shadow transition transform hover:scale-105">เช็คอินส่งห้องตรวจ</button>`;
        } else if(a.status === 'waiting') {
            btnAction = `<span class="text-xs text-slate-400 italic">รอพบแพทย์...</span>`;
        } else if(a.status === 'examining') {
            btnAction = `<span class="text-xs text-yellow-600 animate-pulse">แพทย์กำลังตรวจ...</span>`;
        } else if(a.status === 'pharmacy') {
            btnAction = `<button onclick="openBill(${a.id})" class="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 shadow animate-bounce">คิดเงิน/ออกใบเสร็จ</button>`;
        } else if(a.status === 'completed') {
            btnAction = `<span class="text-xs text-green-600 font-bold flex items-center gap-1"><i data-lucide="check-circle" class="w-4 h-4"></i> เรียบร้อย</span>`;
        }

        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-4 font-mono text-slate-600">${a.timeSlot || '-'}</td>
            <td class="p-4 font-bold text-slate-700">
                ${a.ownerName}
                <div class="text-xs text-slate-400 font-normal">${a.phone || ''}</div>
            </td>
            <td class="p-4 text-slate-600">${a.petName} <span class="text-xs bg-slate-200 px-1 rounded">${a.breed || ''}</span></td>
            <td class="p-4 text-sm text-slate-500">${a.petType}</td>
            <td class="p-4">${STATUS_TH[a.status] || a.status}</td>
            <td class="p-4 text-right flex gap-2 justify-end items-center">
                <button onclick="viewAppointmentDetails(${a.id})" class="text-gray-400 hover:text-blue-500"><i data-lucide="eye" class="w-4 h-4"></i></button>
                ${btnAction}
            </td>
        </tr>
        `;
    }).join('');
    lucide.createIcons();
}

async function updateStatus(id, status, extraData = {}) {
    try {
        const payload = { status, ...extraData };
        
        // Optimistic Update
        const localIndex = appointments.findIndex(a => a.id === id);
        if (localIndex !== -1) {
            appointments[localIndex] = { ...appointments[localIndex], ...payload };
            // Force re-render immediately
            if(currentUser.role === 'reception') renderReceptionTable();
            if(currentUser.role === 'doctor') renderDoctorQueue();
            if(currentUser.role === 'customer') loadCustomerData();
        }

        const res = await fetch(`${API_URL}/appointments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if(res.ok) {
            await fetchAppointments();
        }
    } catch(err) {
        console.error(err);
    }
}

async function handleWalkIn(e) {
    e.preventDefault();
    const today = new Date();
    const timeString = today.getHours().toString().padStart(2, '0') + ':' + today.getMinutes().toString().padStart(2, '0');

    const payload = {
        ownerName: document.getElementById('walk-owner').value + " (Walk-in)",
        phone: document.getElementById('walk-phone').value,
        petName: document.getElementById('walk-pet').value,
        petType: document.getElementById('walk-type').value,
        symptoms: document.getElementById('walk-symptom').value,
        appointmentDate: today.toISOString(),
        timeSlot: timeString,
        isWalkIn: true,
        status: 'waiting' // Walk-in goes directly to waiting
    };

    try {
        const res = await fetch(`${API_URL}/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            closeModal('walkInModal');
            document.getElementById('walkInModal').querySelector('form').reset();
            fetchAppointments();
            Swal.fire('สำเร็จ', 'ลงทะเบียน Walk-in เรียบร้อย (ส่งเข้าห้องตรวจ)', 'success');
        }
    } catch(err) { console.error(err); }
}

// Receipt Logic
let currentBillAppt = null;
let currentBillCost = 0;

function openBill(id) {
    const appt = appointments.find(a => a.id === id);
    if(!appt) return;
    currentBillAppt = appt;
    // Ensure cost is treated as number for logic, but stored as string in DB
    currentBillCost = parseFloat(appt.cost) || 0; 
    
    document.getElementById('billing-cost-input').value = currentBillCost > 0 ? currentBillCost : '';
    
    updateReceiptTotal();
    openModal('paymentModal');
}

function updateReceiptTotal() {
    const costInput = document.getElementById('billing-cost-input').value;
    const cost = parseFloat(costInput) || 0;
    currentBillCost = cost;
    
    if(!currentBillAppt) return;

    const html = `
        <div class="text-center mb-2 border-b pb-2">
            <div class="text-lg font-bold text-slate-800">อาเเงว Clinic</div>
            <div class="text-[10px] text-slate-500">โทร. 02-999-9999</div>
            <div class="text-sm font-bold mt-1">ใบเสร็จรับเงิน</div>
        </div>
        <div class="flex justify-between text-[10px] mb-2">
            <div>
                <p><b>ลูกค้า:</b> ${currentBillAppt.ownerName}</p>
                <p><b>สัตว์เลี้ยง:</b> ${currentBillAppt.petName}</p>
            </div>
            <div class="text-right">
                <p><b>วันที่:</b> ${formatDate(currentBillAppt.appointmentDate)}</p>
                <p><b>เลขที่:</b> ${String(currentBillAppt.id).padStart(6, '0')}</p>
            </div>
        </div>
        <table class="w-full text-xs mb-2 border-collapse">
            <thead>
                <tr class="bg-slate-100 border-y border-slate-200">
                    <th class="py-1 text-left pl-1">รายการ</th>
                    <th class="py-1 text-right pr-1">บาท</th>
                </tr>
            </thead>
            <tbody>
                <tr class="border-b border-slate-100">
                    <td class="py-1 pl-1">ค่ารักษา/เวชภัณฑ์</td>
                    <td class="py-1 text-right pr-1">${cost.toFixed(2)}</td>
                </tr>
                <tr class="border-b border-slate-100">
                    <td class="py-1 pl-1">ค่าบริการ</td>
                    <td class="py-1 text-right pr-1">100.00</td>
                </tr>
            </tbody>
            <tfoot>
                <tr class="font-bold">
                    <td class="py-2 text-right">รวมสุทธิ</td>
                    <td class="py-2 text-right pr-1 text-teal-700">${(cost + 100).toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
        <div class="text-center text-[10px] text-slate-400 mt-2">
            <p>ผู้รับเงิน: ${currentUser.name}</p>
        </div>
    `;
    
    document.getElementById('receipt-preview').innerHTML = html;
    document.getElementById('receipt-print-area').innerHTML = html;
}

async function confirmPayment() {
    if(currentBillAppt) {
        // [FIX] Convert cost to String before sending to satisfy Prisma Schema
        await updateStatus(currentBillAppt.id, 'completed', { cost: String(currentBillCost) });
        
        closeModal('paymentModal');
        Swal.fire({
            icon: 'success',
            title: 'ชำระเงินเรียบร้อย',
            text: 'สถานะอัปเดตเป็นเสร็จสิ้นแล้ว',
            timer: 1500,
            showConfirmButton: false
        });
        
        await fetchAppointments();
    }
}

function printReceipt() { window.print(); }

// Detail Modal
function viewAppointmentDetails(id) {
    const appt = appointments.find(a => a.id === id);
    if(!appt) return;
    
    const html = `
        <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="text-gray-500">วันที่:</div><div class="font-bold">${formatDate(appt.appointmentDate)}</div>
            <div class="text-gray-500">เวลา:</div><div class="font-bold">${appt.timeSlot}</div>
            <div class="text-gray-500">สัตว์เลี้ยง:</div><div>${appt.petName} (${appt.petType})</div>
            <div class="text-gray-500">เจ้าของ:</div><div>${appt.ownerName}</div>
            <div class="text-gray-500">เบอร์โทร:</div><div>${appt.phone || '-'}</div>
            <div class="text-gray-500">สถานะ:</div><div>${STATUS_TH[appt.status] || appt.status}</div>
        </div>
        <div class="bg-gray-50 p-3 rounded-lg mb-2">
            <div class="text-xs text-gray-500 font-bold mb-1">อาการเบื้องต้น</div>
            <div>${appt.symptoms}</div>
        </div>
        ${appt.diagnosis ? `
        <div class="bg-blue-50 p-3 rounded-lg mb-2">
            <div class="text-xs text-blue-500 font-bold mb-1">ผลการวินิจฉัย</div>
            <div>${appt.diagnosis}</div>
        </div>` : ''}
        ${appt.prescription ? `
        <div class="bg-green-50 p-3 rounded-lg">
            <div class="text-xs text-green-500 font-bold mb-1">การรักษา/ยา</div>
            <div>${appt.prescription}</div>
        </div>` : ''}
    `;
    document.getElementById('detail-content').innerHTML = html;
    openModal('detailModal');
}

// --- 6. DOCTOR LOGIC ---
function renderDoctorQueue() {
    const list = document.getElementById('doctor-queue-list');
    const showOnlyMyPatients = document.getElementById('doc-filter-my').checked;

    let queue = appointments.filter(a => ['waiting', 'examining'].includes(a.status));

    // Filter logic if doctor assigned (optional based on your schema usage)
    // if (showOnlyMyPatients) queue = queue.filter(...)

    queue.sort((a,b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''));

    if(queue.length === 0) {
        list.innerHTML = '<div class="text-center py-10 text-slate-400 flex flex-col items-center"><i data-lucide="coffee" class="w-12 h-12 mb-2 opacity-50"></i><p>ไม่มีคิวรอตรวจ</p></div>';
        lucide.createIcons();
        return;
    }

    list.innerHTML = queue.map(a => {
        const isActive = a.status === 'examining';
        const bgClass = isActive ? 'bg-teal-50 border-teal-500 shadow-md transform scale-105' : 'bg-white hover:bg-slate-50';
        const walkInBadge = a.isWalkIn ? '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1">Walk-in</span>' : '';
        
        return `
        <div onclick="openExamRoom(${a.id})" class="cursor-pointer p-4 border rounded-xl ${bgClass} transition relative mb-2">
            ${isActive ? '<span class="absolute top-2 right-2 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>' : ''}
            <div class="font-bold text-slate-800 text-lg">${a.petName} ${walkInBadge}</div>
            <div class="text-sm text-slate-500 truncate mb-1">${a.symptoms}</div>
            <div class="flex justify-between items-center mt-2">
                <div class="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">${a.timeSlot || 'Any'}</div>
                <div class="text-xs font-bold ${isActive ? 'text-green-600' : 'text-blue-500'}">${isActive ? 'กำลังตรวจ' : 'รอตรวจ'}</div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function openExamRoom(id) {
    const appt = appointments.find(a => a.id === id);
    if(!appt) return;

    if(appt.status === 'waiting') {
        updateStatus(id, 'examining'); 
    }

    activeExamId = id;
    
    document.getElementById('doc-empty-state').classList.add('hidden');
    document.getElementById('doc-exam-form').classList.remove('hidden');

    document.getElementById('exam-pet-name').innerText = appt.petName;
    document.getElementById('exam-pet-breed').innerText = appt.breed || '-';
    document.getElementById('exam-pet-weight').innerText = appt.weight || '-';
    document.getElementById('exam-owner-name').innerText = appt.ownerName;
    document.getElementById('exam-symptom').innerText = appt.symptoms;
    document.getElementById('exam-appt-id').value = appt.id;
    
    document.getElementById('exam-diagnosis').value = appt.diagnosis || '';
    document.getElementById('exam-treatment').value = appt.prescription || ''; 
    
    document.getElementById('exam-next-date').value = '';
    document.getElementById('exam-next-time').value = '';
    document.getElementById('exam-next-note').value = '';
}

function closeExamRoom() {
    document.getElementById('doc-empty-state').classList.remove('hidden');
    document.getElementById('doc-exam-form').classList.add('hidden');
    activeExamId = null;
}

async function saveExamResult() {
    if(!activeExamId) return;
    
    // 1. Save current exam result -> Status: Pharmacy
    const payload = {
        diagnosis: document.getElementById('exam-diagnosis').value,
        prescription: document.getElementById('exam-treatment').value,
        status: 'pharmacy' // Doctor finished, send to assistant
    };
    
    await updateStatus(activeExamId, 'pharmacy', payload); 
    
    // 2. Handle Follow-up (Creates NEW appointment)
    const nextDate = document.getElementById('exam-next-date').value;
    const nextTime = document.getElementById('exam-next-time').value;
    
    if (nextDate && nextTime) {
        const currentAppt = appointments.find(a => a.id == activeExamId);
        const nextPayload = {
            ownerName: currentAppt.ownerName,
            phone: currentAppt.phone,
            petName: currentAppt.petName,
            petType: currentAppt.petType,
            breed: currentAppt.breed,
            weight: currentAppt.weight,
            height: currentAppt.height,
            symptoms: "นัดติดตามอาการ (Follow-up): " + document.getElementById('exam-next-note').value,
            appointmentDate: nextDate,
            timeSlot: nextTime,
            isWalkIn: false,
            status: 'pending' // New appointment starts as pending
        };
        
        try {
            await fetch(`${API_URL}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextPayload)
            });
            Swal.fire('สำเร็จ', 'บันทึกผลและสร้างนัดหมายใหม่แล้ว', 'success');
        } catch(e) {
            Swal.fire('Warning', 'บันทึกผลแล้ว แต่สร้างนัดหมายใหม่ล้มเหลว', 'warning');
        }
    } else {
        Swal.fire('บันทึกสำเร็จ', 'ส่งต่อให้การเงินแล้ว', 'success');
    }
    
    closeExamRoom();
}

function renderAdminAppts() {
    // Basic Admin View
    const list = document.getElementById('admin-appt-list');
    list.innerHTML = appointments.map(a => `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
            <td class="p-3 text-xs text-slate-400">${a.id}</td>
            <td class="p-3 text-sm">${formatDate(a.appointmentDate)} ${a.timeSlot}</td>
            <td class="p-3 font-bold text-sm">${a.petName}</td>
            <td class="p-3 text-xs">${STATUS_TH[a.status] || a.status}</td>
            <td class="p-3 text-right font-mono">${a.cost ? a.cost : '-'}</td>
            <td class="p-3 text-right"><button onclick="viewAppointmentDetails(${a.id})" class="text-blue-500 hover:underline text-xs">ดู</button></td>
        </tr>`).join('');
}

// --- 8. QUEUE BOARD ---
function toggleQueueBoard() {
    const el = document.getElementById('queueBoard');
    if(el.style.display === 'block') {
        el.style.display = 'none';
    } else {
        el.style.display = 'block';
        updateQueueBoard();
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    }
}

function updateQueueBoard() {
    const calling = appointments.filter(a => a.status === 'examining');
    document.getElementById('queue-calling-list').innerHTML = calling.map(a => `
        <div class="bg-slate-700 p-6 rounded-2xl flex justify-between items-center animate-pulse border-2 border-yellow-500 shadow-lg">
            <div>
                <div class="text-4xl font-bold text-white mb-2">${a.petName}</div>
                <div class="text-xl text-slate-300">เจ้าของ: ${a.ownerName}</div>
            </div>
            <div class="text-right">
                <div class="text-2xl font-bold text-yellow-400">ห้องตรวจ 1</div>
            </div>
        </div>`).join('');

    const waiting = appointments.filter(a => a.status === 'waiting').slice(0, 5);
    document.getElementById('queue-waiting-list').innerHTML = waiting.map(a => `
        <div class="bg-slate-700 p-4 rounded-xl flex justify-between items-center opacity-80 border-l-4 border-blue-500">
            <div>
                <div class="text-2xl font-bold text-white">${a.petName}</div>
                <div class="text-slate-400 text-sm">เจ้าของ: ${a.ownerName}</div>
            </div>
            <div class="text-xl font-mono text-blue-300">${a.timeSlot || 'Walk-in'}</div>
        </div>`).join('');
        
    lucide.createIcons();
}

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
    }, 1000);
}

window.onload = init;