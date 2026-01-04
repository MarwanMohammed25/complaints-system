import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, push, set, get, update, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { sanitizeHTML } from './utils.js';
import { logger } from './logger.js';
import { addTrackedListener } from './cleanup.js';

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let supervisorsData = {};
let managersData = {};
let complaintsData = {};

// Tab switching
window.switchTab = function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
};

// Check authentication
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '../index.html';
    } else {
        loadData();
    }
});

// Logout functionality
addTrackedListener(document.getElementById('logoutBtn'), 'click', async () => {
    try {
        await signOut(auth);
        window.location.href = '../index.html';
    } catch (error) {
        logger.error('Logout error:', error);
        alert('حدث خطأ أثناء تسجيل الخروج');
    }
});

// Load all data
async function loadData() {
    try {
        // Load complaints
        const complaintsRef = ref(database, 'complaints');
        const complaintsSnapshot = await get(complaintsRef);
        if (complaintsSnapshot.exists()) {
            complaintsData = complaintsSnapshot.val();
        }

        // Load supervisors and managers
        await loadSupervisors();
        await loadManagers();

    } catch (error) {
        logger.error('Error loading data:', error);
        alert('حدث خطأ أثناء تحميل البيانات');
    }
}

// ========== SUPERVISORS SECTION ==========

async function loadSupervisors() {
    const loading = document.getElementById('supervisorLoading');
    const table = document.getElementById('supervisorsTable');
    const noData = document.getElementById('supervisorNoData');

    try {
        loading.style.display = 'block';
        table.style.display = 'none';
        noData.style.display = 'none';

        const supervisorsRef = ref(database, 'supervisors');
        const snapshot = await get(supervisorsRef);

        loading.style.display = 'none';

        if (snapshot.exists()) {
            supervisorsData = snapshot.val();
            displaySupervisors(supervisorsData);
            table.style.display = 'block';
        } else {
            noData.style.display = 'block';
        }
    } catch (error) {
        logger.error('Error loading supervisors:', error);
        loading.style.display = 'none';
    }
}

function displaySupervisors(supervisors, searchTerm = '') {
    const tbody = document.getElementById('supervisorsBody');
    tbody.innerHTML = '';

    const supervisorsArray = Object.entries(supervisors).map(([id, data]) => ({
        id,
        ...data
    }));

    let filteredSupervisors = supervisorsArray;

    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredSupervisors = filteredSupervisors.filter(s => 
            s.name.toLowerCase().includes(search) ||
            s.phone.includes(search) ||
            s.area.toLowerCase().includes(search)
        );
    }

    filteredSupervisors.forEach(supervisor => {
        const complaintCount = Object.values(complaintsData).filter(
            c => c.supervisor === supervisor.id
        ).length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitizeHTML(supervisor.name)}</td>
            <td>${sanitizeHTML(supervisor.title || '-')}</td>
            <td>${sanitizeHTML(supervisor.phone)}</td>
            <td>${sanitizeHTML(supervisor.area)}</td>
            <td>${sanitizeHTML(supervisor.city || '-')}</td>
            <td>${sanitizeHTML(supervisor.notes || '-')}</td>
            <td><span class="complaint-badge">${complaintCount}</span></td>
            <td>
                <button onclick="editSupervisor('${supervisor.id}')" class="btn btn-edit">✏️ تعديل</button>
                <button onclick="deleteSupervisor('${supervisor.id}', ${complaintCount})" class="btn btn-delete">🗑️ حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (filteredSupervisors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">لا توجد نتائج</td></tr>';
    }
}

// Supervisor form submission
addTrackedListener(document.getElementById('supervisorForm'), 'submit', async (e) => {
    e.preventDefault();
    
    const phoneError = document.getElementById('supervisorPhoneError');
    const successMessage = document.getElementById('supervisorSuccessMessage');
    
    phoneError.style.display = 'none';
    successMessage.style.display = 'none';

    const name = document.getElementById('supervisorName').value.trim();
    const title = document.getElementById('supervisorTitle').value.trim();
    const phone = document.getElementById('supervisorPhone').value.trim();
    const area = document.getElementById('supervisorArea').value.trim();
    const city = document.getElementById('supervisorCity').value.trim();
    const notes = document.getElementById('supervisorNotes').value.trim();

    if (phone && phone.length > 0) {
        const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
        if (!phoneRegex.test(phone)) {
            phoneError.style.display = 'block';
            return;
        }
    }

    const supervisor = {
        name,
        title: title || '-',
        phone: phone || 'غير متوفر',
        area,
        city: city || '-',
        notes,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
    };

    try {
        const supervisorsRef = ref(database, 'supervisors');
        const newSupervisorRef = push(supervisorsRef);
        await set(newSupervisorRef, supervisor);

        successMessage.style.display = 'block';
        document.getElementById('supervisorForm').reset();
        await loadSupervisors();
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);

    } catch (error) {
        logger.error('Error saving supervisor:', error);
        alert('حدث خطأ أثناء حفظ المشرف');
    }
});

// Supervisor phone validation
addTrackedListener(document.getElementById('supervisorPhone'), 'input', (e) => {
    const phoneValue = e.target.value.trim();
    const phoneError = document.getElementById('supervisorPhoneError');
    
    if (!phoneValue) {
        phoneError.style.display = 'none';
        return;
    }
    
    const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
    phoneError.style.display = phoneRegex.test(phoneValue) ? 'none' : 'block';
});

// Supervisor search
addTrackedListener(document.getElementById('supervisorSearchInput'), 'input', (e) => {
    displaySupervisors(supervisorsData, e.target.value);
});

// Edit supervisor
window.editSupervisor = function(supervisorId) {
    const supervisor = supervisorsData[supervisorId];
    if (!supervisor) return;

    document.getElementById('editSupervisorId').value = supervisorId;
    document.getElementById('editSupervisorName').value = supervisor.name;
    document.getElementById('editSupervisorTitle').value = supervisor.title || '';
    document.getElementById('editSupervisorPhone').value = supervisor.phone;
    document.getElementById('editSupervisorArea').value = supervisor.area;
    document.getElementById('editSupervisorCity').value = supervisor.city || '';
    document.getElementById('editSupervisorNotes').value = supervisor.notes || '';

    document.getElementById('editSupervisorModal').style.display = 'block';
};

window.closeEditSupervisorModal = function() {
    document.getElementById('editSupervisorModal').style.display = 'none';
};

addTrackedListener(document.getElementById('editSupervisorForm'), 'submit', async (e) => {
    e.preventDefault();

    const supervisorId = document.getElementById('editSupervisorId').value;
    const name = document.getElementById('editSupervisorName').value.trim();
    const title = document.getElementById('editSupervisorTitle').value.trim();
    const phone = document.getElementById('editSupervisorPhone').value.trim();
    const area = document.getElementById('editSupervisorArea').value.trim();
    const city = document.getElementById('editSupervisorCity').value.trim();
    const notes = document.getElementById('editSupervisorNotes').value.trim();

    if (phone) {
        const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
        if (!phoneRegex.test(phone)) {
            alert('الرجاء إدخال رقم هاتف صحيح');
            return;
        }
    }

    try {
        const supervisorRef = ref(database, `supervisors/${supervisorId}`);
        await update(supervisorRef, {
            name,
            title: title || '-',
            phone: phone || 'غير متوفر',
            area,
            city: city || '-',
            notes,
            updatedAt: new Date().toISOString()
        });

        closeEditSupervisorModal();
        await loadSupervisors();
        alert('تم تحديث بيانات المشرف بنجاح');

    } catch (error) {
        logger.error('Error updating supervisor:', error);
        alert('حدث خطأ أثناء تحديث البيانات');
    }
});

// Delete supervisor
window.deleteSupervisor = async function(supervisorId, complaintCount) {
    if (complaintCount > 0) {
        if (!confirm(`هذا المشرف لديه ${complaintCount} شكوى مرتبطة به. هل أنت متأكد من الحذف؟`)) {
            return;
        }
    } else {
        if (!confirm('هل أنت متأكد من حذف هذا المشرف؟')) {
            return;
        }
    }

    try {
        const supervisorRef = ref(database, `supervisors/${supervisorId}`);
        await remove(supervisorRef);
        await loadSupervisors();
        alert('تم حذف المشرف بنجاح');
    } catch (error) {
        logger.error('Error deleting supervisor:', error);
        alert('حدث خطأ أثناء حذف المشرف');
    }
};

// ========== MANAGERS SECTION ==========

async function loadManagers() {
    const loading = document.getElementById('managerLoading');
    const table = document.getElementById('managersTable');
    const noData = document.getElementById('managerNoData');

    try {
        loading.style.display = 'block';
        table.style.display = 'none';
        noData.style.display = 'none';

        const managersRef = ref(database, 'managers');
        const snapshot = await get(managersRef);

        loading.style.display = 'none';

        if (snapshot.exists()) {
            managersData = snapshot.val();
            displayManagers(managersData);
            table.style.display = 'block';
        } else {
            noData.style.display = 'block';
        }
    } catch (error) {
        logger.error('Error loading managers:', error);
        loading.style.display = 'none';
    }
}

function displayManagers(managers, searchTerm = '') {
    const tbody = document.getElementById('managersBody');
    tbody.innerHTML = '';

    const managersArray = Object.entries(managers).map(([id, data]) => ({
        id,
        ...data
    }));

    let filteredManagers = managersArray;

    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredManagers = filteredManagers.filter(m => 
            m.name.toLowerCase().includes(search) ||
            m.phone.includes(search) ||
            (m.department && m.department.toLowerCase().includes(search))
        );
    }

    filteredManagers.forEach(manager => {
        const complaintCount = Object.values(complaintsData).filter(
            c => c.manager === manager.id
        ).length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitizeHTML(manager.name)}</td>
            <td>${sanitizeHTML(manager.title || '-')}</td>
            <td>${sanitizeHTML(manager.phone)}</td>
            <td>${sanitizeHTML(manager.department || '-')}</td>
            <td>${sanitizeHTML(manager.city || '-')}</td>
            <td>${sanitizeHTML(manager.notes || '-')}</td>
            <td><span class="complaint-badge">${complaintCount}</span></td>
            <td>
                <button onclick="editManager('${manager.id}')" class="btn btn-edit">✏️ تعديل</button>
                <button onclick="deleteManager('${manager.id}', ${complaintCount})" class="btn btn-delete">🗑️ حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (filteredManagers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">لا توجد نتائج</td></tr>';
    }
}

// Manager form submission
addTrackedListener(document.getElementById('managerForm'), 'submit', async (e) => {
    e.preventDefault();
    
    const phoneError = document.getElementById('managerPhoneError');
    const successMessage = document.getElementById('managerSuccessMessage');
    
    phoneError.style.display = 'none';
    successMessage.style.display = 'none';

    const name = document.getElementById('managerName').value.trim();
    const title = document.getElementById('managerTitle').value.trim();
    const phone = document.getElementById('managerPhone').value.trim();
    const department = document.getElementById('managerDepartment').value.trim();
    const city = document.getElementById('managerCity').value.trim();
    const notes = document.getElementById('managerNotes').value.trim();

    if (phone && phone.length > 0) {
        const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
        if (!phoneRegex.test(phone)) {
            phoneError.style.display = 'block';
            return;
        }
    }

    const manager = {
        name,
        title: title || '-',
        phone: phone || 'غير متوفر',
        department,
        city: city || '-',
        notes,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
    };

    try {
        const managersRef = ref(database, 'managers');
        const newManagerRef = push(managersRef);
        await set(newManagerRef, manager);

        successMessage.style.display = 'block';
        document.getElementById('managerForm').reset();
        await loadManagers();
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);

    } catch (error) {
        logger.error('Error saving manager:', error);
        alert('حدث خطأ أثناء حفظ المدير');
    }
});

// Manager phone validation
addTrackedListener(document.getElementById('managerPhone'), 'input', (e) => {
    const phoneValue = e.target.value.trim();
    const phoneError = document.getElementById('managerPhoneError');
    
    if (!phoneValue) {
        phoneError.style.display = 'none';
        return;
    }
    
    const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
    phoneError.style.display = phoneRegex.test(phoneValue) ? 'none' : 'block';
});

// Manager search
addTrackedListener(document.getElementById('managerSearchInput'), 'input', (e) => {
    displayManagers(managersData, e.target.value);
});

// Edit manager
window.editManager = function(managerId) {
    const manager = managersData[managerId];
    if (!manager) return;

    document.getElementById('editManagerId').value = managerId;
    document.getElementById('editManagerName').value = manager.name;
    document.getElementById('editManagerTitle').value = manager.title || '';
    document.getElementById('editManagerPhone').value = manager.phone;
    document.getElementById('editManagerDepartment').value = manager.department;
    document.getElementById('editManagerCity').value = manager.city || '';
    document.getElementById('editManagerNotes').value = manager.notes || '';

    document.getElementById('editManagerModal').style.display = 'block';
};

window.closeEditManagerModal = function() {
    document.getElementById('editManagerModal').style.display = 'none';
};

addTrackedListener(document.getElementById('editManagerForm'), 'submit', async (e) => {
    e.preventDefault();

    const managerId = document.getElementById('editManagerId').value;
    const name = document.getElementById('editManagerName').value.trim();
    const title = document.getElementById('editManagerTitle').value.trim();
    const phone = document.getElementById('editManagerPhone').value.trim();
    const department = document.getElementById('editManagerDepartment').value.trim();
    const city = document.getElementById('editManagerCity').value.trim();
    const notes = document.getElementById('editManagerNotes').value.trim();

    if (phone) {
        const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
        if (!phoneRegex.test(phone)) {
            alert('الرجاء إدخال رقم هاتف صحيح');
            return;
        }
    }

    try {
        const managerRef = ref(database, `managers/${managerId}`);
        await update(managerRef, {
            name,
            title: title || '-',
            phone: phone || 'غير متوفر',
            department,
            city: city || '-',
            notes,
            updatedAt: new Date().toISOString()
        });

        closeEditManagerModal();
        await loadManagers();
        alert('تم تحديث بيانات المدير بنجاح');

    } catch (error) {
        logger.error('Error updating manager:', error);
        alert('حدث خطأ أثناء تحديث البيانات');
    }
});

// Delete manager
window.deleteManager = async function(managerId, complaintCount) {
    if (complaintCount > 0) {
        if (!confirm(`هذا المدير لديه ${complaintCount} شكوى مرتبطة به. هل أنت متأكد من الحذف؟`)) {
            return;
        }
    } else {
        if (!confirm('هل أنت متأكد من حذف هذا المدير؟')) {
            return;
        }
    }

    try {
        const managerRef = ref(database, `managers/${managerId}`);
        await remove(managerRef);
        await loadManagers();
        alert('تم حذف المدير بنجاح');
    } catch (error) {
        logger.error('Error deleting manager:', error);
        alert('حدث خطأ أثناء حذف المدير');
    }
};

// Close modals on outside click
addTrackedListener(document.getElementById('editSupervisorModal'), 'click', (e) => {
    if (e.target.id === 'editSupervisorModal') {
        closeEditSupervisorModal();
    }
});

addTrackedListener(document.getElementById('editManagerModal'), 'click', (e) => {
    if (e.target.id === 'editManagerModal') {
        closeEditManagerModal();
    }
});
