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
    
    // Load report data when report tab is opened
    if (tabName === 'report') {
        generateReport();
    }
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

// ========== REPORT FUNCTIONS ==========

// Generate report
function generateReport() {
    const reportLoading = document.getElementById('reportLoading');
    const reportContent = document.getElementById('reportContent');
    const reportNoData = document.getElementById('reportNoData');
    
    reportLoading.style.display = 'block';
    reportContent.style.display = 'none';
    reportNoData.style.display = 'none';
    
    // Get unresolved complaints by supervisor
    const unresolvedBySupervisor = getUnresolvedBySupervisor();
    
    // Get repeated complaints
    const repeatedComplaints = getRepeatedComplaints();
    
    // Update statistics
    updateReportStatistics(unresolvedBySupervisor, repeatedComplaints);
    
    // Display unresolved complaints
    displayUnresolvedBySupervisor(unresolvedBySupervisor);
    
    // Display repeated complaints
    displayRepeatedComplaints(repeatedComplaints);
    
    reportLoading.style.display = 'none';
    
    const totalWarnings = Object.values(unresolvedBySupervisor).reduce((sum, s) => sum + s.complaints.length, 0) + repeatedComplaints.length;
    
    if (totalWarnings > 0) {
        reportContent.style.display = 'block';
    } else {
        reportNoData.style.display = 'block';
    }
}

// Get unresolved complaints grouped by supervisor
function getUnresolvedBySupervisor() {
    const result = {};
    
    Object.entries(complaintsData).forEach(([id, complaint]) => {
        if (complaint.status !== 'resolved') {
            const supervisorId = complaint.supervisor;
            const supervisorName = supervisorsData[supervisorId]?.name || 'غير محدد';
            
            if (!result[supervisorId]) {
                result[supervisorId] = {
                    name: supervisorName,
                    complaints: []
                };
            }
            
            result[supervisorId].complaints.push({
                id,
                ...complaint
            });
        }
    });
    
    return Object.entries(result)
        .sort((a, b) => b[1].complaints.length - a[1].complaints.length)
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});
}

// Get repeated complaints from same customers
function getRepeatedComplaints() {
    const customerMap = {};
    
    Object.entries(complaintsData).forEach(([id, complaint]) => {
        const key = `${complaint.phoneNumber}_${complaint.buildingNumber}`;
        
        if (!customerMap[key]) {
            customerMap[key] = {
                customerName: complaint.customerName,
                phoneNumber: complaint.phoneNumber,
                buildingNumber: complaint.buildingNumber,
                area: complaint.area,
                complaints: []
            };
        }
        
        customerMap[key].complaints.push({
            id,
            ...complaint
        });
    });
    
    const repeated = Object.values(customerMap).filter(customer => customer.complaints.length > 1);
    return repeated.sort((a, b) => b.complaints.length - a.complaints.length);
}

// Update report statistics
function updateReportStatistics(unresolvedBySupervisor, repeatedComplaints) {
    const totalUnresolved = Object.values(unresolvedBySupervisor)
        .reduce((sum, supervisor) => sum + supervisor.complaints.length, 0);
    
    const totalRepeated = repeatedComplaints.length;
    const totalWarnings = totalUnresolved + totalRepeated;
    
    document.getElementById('unresolvedCount').textContent = totalUnresolved;
    document.getElementById('repeatedCustomers').textContent = totalRepeated;
    document.getElementById('totalWarnings').textContent = totalWarnings;
}

// Display unresolved complaints by supervisor
function displayUnresolvedBySupervisor(unresolvedBySupervisor) {
    const container = document.getElementById('supervisorWarnings');
    const count = Object.values(unresolvedBySupervisor)
        .reduce((sum, supervisor) => sum + supervisor.complaints.length, 0);
    
    document.getElementById('supervisorWarningCount').textContent = count;
    
    if (count === 0) {
        container.innerHTML = '<p style="text-align: center; color: #4caf50; padding: 20px;">✅ جميع الشكاوى محلولة!</p>';
        return;
    }
    
    let html = '';
    
    Object.entries(unresolvedBySupervisor).forEach(([supervisorId, data]) => {
        html += `
            <div class="supervisor-section">
                <div class="supervisor-name">
                    👤 ${data.name} - (${data.complaints.length} شكوى غير محلولة)
                </div>
        `;
        
        data.complaints.forEach(complaint => {
            const statusText = complaint.status === 'pending' ? 'قيد الانتظار' : 'قيد المعالجة';
            const statusClass = complaint.status === 'pending' ? 'pending' : 'processing';
            const createdDate = new Date(complaint.createdAt);
            const dateStr = createdDate.toLocaleDateString('ar-EG');
            const timeStr = createdDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            html += `
                <div class="complaint-item ${statusClass}">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 250px;">
                            <strong>🔔 ${complaint.complaintId || '-'}</strong> - ${sanitizeHTML(complaint.customerName)}
                            <br>
                            <small>📞 ${sanitizeHTML(complaint.phoneNumber)} | 🏢 ${sanitizeHTML(complaint.buildingNumber)} | 📍 ${sanitizeHTML(complaint.area)}</small>
                            <br>
                            <small>📋 ${sanitizeHTML(complaint.complaintType)} | 🔄 ${statusText}</small>
                            <br>
                            <small>📅 تاريخ الشكوى: ${dateStr} | ⏰ ${timeStr}</small>
                            <br>
                            <div style="margin-top: 10px;">
                                <textarea id="reportNote_${complaint.id}" 
                                          placeholder="اكتب ملاحظات أو تعليقات التقرير هنا..."
                                          style="width: 100%; min-height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; font-size: 13px; resize: vertical;"></textarea>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="exportComplaintReport('${complaint.id}', '${supervisorId}')" 
                                style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 8px 16px; border-radius: 6px; color: white; font-size: 13px; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3); transition: all 0.3s;">
                            📸 تقرير الشكوى
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

// Display repeated complaints
function displayRepeatedComplaints(repeatedComplaints) {
    const container = document.getElementById('repeatedWarnings');
    document.getElementById('repeatedWarningCount').textContent = repeatedComplaints.length;
    
    if (repeatedComplaints.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #4caf50; padding: 20px;">✅ لا توجد شكاوى متكررة!</p>';
        return;
    }
    
    let html = '';
    
    repeatedComplaints.forEach(customer => {
        html += `
            <div class="repeated-section">
                <div class="customer-info">
                    👥 ${sanitizeHTML(customer.customerName)} - ${customer.complaints.length} شكوى
                    <br>
                    <small>📞 ${sanitizeHTML(customer.phoneNumber)} | 🏢 ${sanitizeHTML(customer.buildingNumber)} | 📍 ${sanitizeHTML(customer.area)}</small>
                </div>
        `;
        
        const sortedComplaints = customer.complaints.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        sortedComplaints.forEach((complaint, index) => {
            const createdDate = new Date(complaint.createdAt);
            const dateStr = createdDate.toLocaleDateString('ar-EG');
            const timeStr = createdDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            const statusText = complaint.status === 'pending' ? '⏳ قيد الانتظار' : 
                              complaint.status === 'processing' ? '🔄 قيد المعالجة' : 
                              '✅ تم الحل';
            
            let resolvedInfo = '';
            if (complaint.status === 'resolved' && complaint.closureDate) {
                const resolvedDate = new Date(complaint.closureDate);
                const resolvedDateStr = resolvedDate.toLocaleDateString('ar-EG');
                const resolvedTimeStr = resolvedDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
                resolvedInfo = `<br><small style="color: #4caf50;">✅ تاريخ الحل: ${resolvedDateStr} | ⏰ ${resolvedTimeStr}</small>`;
            }
            
            html += `
                <div class="repeated-complaint">
                    <strong>${index + 1}. ${complaint.complaintId || '-'}</strong> - ${statusText}
                    <br>
                    <small>📋 ${sanitizeHTML(complaint.complaintType)}</small>
                    <br>
                    <small>📅 تاريخ الشكوى: ${dateStr} | ⏰ ${timeStr}</small>
                    ${resolvedInfo}
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

// Export individual complaint report
window.exportComplaintReport = async function(complaintId, supervisorId) {
    try {
        // Get report note from textarea
        const reportNoteElement = document.getElementById(`reportNote_${complaintId}`);
        const reportNote = reportNoteElement ? reportNoteElement.value.trim() : '';
        
        // Get complaint data
        const complaint = complaintsData[complaintId];
        if (!complaint) {
            alert('❌ لم يتم العثور على الشكوى');
            return;
        }
        
        // Get supervisor data
        const supervisor = supervisorsData[supervisorId];
        const supervisorName = supervisor ? supervisor.name : 'غير محدد';
        const supervisorTitle = supervisor && supervisor.title ? supervisor.title : '';
        
        // Calculate duration
        const createdDate = new Date(complaint.createdAt);
        const now = new Date();
        const daysDiff = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        
        // Format dates
        const createdDateStr = createdDate.toLocaleDateString('ar-EG', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const createdTimeStr = createdDate.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', minute: '2-digit', hour12: true 
        });
        const currentDateStr = now.toLocaleDateString('ar-EG', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const currentTimeStr = now.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', minute: '2-digit', hour12: true 
        });
        
        // Status
        const statusText = complaint.status === 'pending' ? '⏳ قيد الانتظار' : 
                          complaint.status === 'processing' ? '🔄 قيد المعالجة' : '✅ تم الحل';
        const statusColor = complaint.status === 'pending' ? '#ff9800' : 
                           complaint.status === 'processing' ? '#2196f3' : '#4caf50';
        
        // Create report HTML
        const reportHTML = `
            <div id="complaintReportContainer" style="width: 800px; background: white; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 35px; text-align: center; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <div style="font-size: 56px; margin-bottom: 12px;">📋</div>
                    <h1 style="margin: 0; font-size: 36px; font-weight: bold;">منظومة إدارة الشكاوى</h1>
                    <p style="margin: 12px 0 0 0; font-size: 20px; opacity: 0.95;">تقرير الشكوى التفصيلي</p>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 14px; opacity: 0.9;">
                        <div>تاريخ التقرير: ${currentDateStr}</div>
                        <div>الوقت: ${currentTimeStr}</div>
                    </div>
                </div>
                
                <div style="padding: 40px;">
                    <!-- Complaint ID -->
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 25px; color: white; box-shadow: 0 3px 8px rgba(0,0,0,0.12);">
                        <div style="font-size: 16px; opacity: 0.9; margin-bottom: 5px;">الرقم المرجعي للشكوى</div>
                        <div style="font-size: 32px; font-weight: bold;">${complaint.complaintId || 'غير محدد'}</div>
                    </div>
                    
                    <!-- Customer Info -->
                    <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 20px; border-right: 5px solid #667eea; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                        <h2 style="margin: 0 0 20px 0; color: #667eea; font-size: 22px; display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #e0e0e0; padding-bottom: 12px;">
                            👤 بيانات العميل
                        </h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 15px;">
                            <div style="padding: 10px; background: white; border-radius: 6px;"><strong style="color: #667eea;">الاسم:</strong> ${sanitizeHTML(complaint.customerName)}</div>
                            <div style="padding: 10px; background: white; border-radius: 6px;"><strong style="color: #667eea;">📞 رقم الهاتف:</strong> ${sanitizeHTML(complaint.phoneNumber)}</div>
                            <div style="padding: 10px; background: white; border-radius: 6px;"><strong style="color: #667eea;">🏢 رقم العقار:</strong> ${sanitizeHTML(complaint.buildingNumber)}</div>
                            <div style="padding: 10px; background: white; border-radius: 6px;"><strong style="color: #667eea;">📍 المنطقة:</strong> ${sanitizeHTML(complaint.area)}</div>
                            ${complaint.city ? `<div style="padding: 10px; background: white; border-radius: 6px;"><strong style="color: #667eea;">🌆 المدينة:</strong> ${sanitizeHTML(complaint.city)}</div>` : ''}
                            ${complaint.address ? `<div style="grid-column: 1 / -1; padding: 10px; background: white; border-radius: 6px;"><strong style="color: #667eea;">📍 العنوان:</strong> ${sanitizeHTML(complaint.address)}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Complaint Info -->
                    <div style="background: #fff8e1; padding: 25px; border-radius: 10px; margin-bottom: 20px; border-right: 5px solid #ff9800; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                        <h2 style="margin: 0 0 20px 0; color: #e65100; font-size: 22px; display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #ffe0b2; padding-bottom: 12px;">
                            📋 بيانات الشكوى
                        </h2>
                        <div style="margin-bottom: 15px; padding: 12px; background: white; border-radius: 6px;"><strong style="color: #e65100;">نوع الشكوى:</strong> ${sanitizeHTML(complaint.complaintType)}</div>
                        <div style="margin-bottom: 15px; padding: 12px; background: white; border-radius: 6px;"><strong style="color: #e65100;">الحالة:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></div>
                        <div style="margin-bottom: 15px; padding: 12px; background: white; border-radius: 6px;"><strong style="color: #e65100;">📅 تاريخ الاستلام:</strong> ${createdDateStr} - ${createdTimeStr}</div>
                        ${complaint.complaintDescription ? `
                            <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
                                <strong style="color: #e65100;">الوصف التفصيلي:</strong><br>
                                <div style="margin-top: 10px; line-height: 1.8; color: #333;">${sanitizeHTML(complaint.complaintDescription)}</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Supervisor Info -->
                    <div style="background: #e3f2fd; padding: 25px; border-radius: 10px; margin-bottom: 20px; border-right: 5px solid #2196f3; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                        <h2 style="margin: 0 0 20px 0; color: #1976d2; font-size: 22px; display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #bbdefb; padding-bottom: 12px;">
                            👨‍💼 المشرف المسؤول
                        </h2>
                        <div style="font-size: 15px;">
                            <div style="margin-bottom: 12px; padding: 12px; background: white; border-radius: 6px;"><strong style="color: #1976d2;">الاسم:</strong> ${supervisorTitle ? supervisorTitle + ' ' : ''}${supervisorName}</div>
                            ${supervisor && supervisor.phone ? `<div style="margin-bottom: 12px; padding: 12px; background: white; border-radius: 6px;"><strong style="color: #1976d2;">📞 الهاتف:</strong> ${sanitizeHTML(supervisor.phone)}</div>` : ''}
                            ${supervisor && supervisor.area ? `<div style="padding: 12px; background: white; border-radius: 6px;"><strong style="color: #1976d2;">📍 المنطقة:</strong> ${sanitizeHTML(supervisor.area)}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Duration Warning -->
                    <div style="background: linear-gradient(135deg, #ff5252 0%, #f48fb1 100%); padding: 30px; border-radius: 10px; color: white; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,0.15); margin-bottom: 25px;">
                        <h2 style="margin: 0 0 15px 0; font-size: 22px;">⏰ مدة عدم الحل</h2>
                        <div style="font-size: 56px; font-weight: bold; margin: 20px 0;">${daysDiff}</div>
                        <div style="font-size: 20px; opacity: 0.95; margin-bottom: 15px;">يوم</div>
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 14px; line-height: 1.8;">
                            من ${createdDateStr}<br>حتى ${currentDateStr}
                        </div>
                    </div>
                    
                    ${reportNote ? `
                    <!-- Report Notes -->
                    <div style="background: #fffde7; padding: 25px; border-radius: 10px; margin-bottom: 20px; border-right: 5px solid #fbc02d; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                        <h2 style="margin: 0 0 20px 0; color: #f57f17; font-size: 22px; display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #fff9c4; padding-bottom: 12px;">
                            📝 التقرير
                        </h2>
                        <div style="padding: 15px; background: white; border-radius: 8px; line-height: 1.8; color: #333; white-space: pre-wrap;">${sanitizeHTML(reportNote)}</div>
                    </div>
                    ` : ''}
                    
                    <!-- Approval Section -->
                    <div style="display: flex; justify-content: flex-end; padding: 20px 0; margin-top: 30px; border-top: 2px solid #e0e0e0;">
                        <div style="text-align: center; min-width: 180px;">
                            <div style="margin-bottom: 8px; font-size: 16px; font-weight: bold; color: #333;">يعتمد</div>
                            <div style="border-bottom: 2px dotted #999; width: 100%; padding-bottom: 2px;">............................................................</div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="background: #f5f5f5; padding: 20px; text-align: center; color: #666; font-size: 13px; border-top: 3px solid #667eea;">
                    <div style="font-weight: bold; margin-bottom: 5px;">هـذا التقريـر صـادر من منظومـة إدارة الشكاوى</div>
                    <div>تم إنشاؤه بتاريخ: ${currentDateStr} - ${currentTimeStr}</div>
                </div>
            </div>
        `;
        
        // Create temporary container
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        document.body.appendChild(tempDiv);
        tempDiv.innerHTML = reportHTML;
        
        const reportContainer = document.getElementById('complaintReportContainer');
        
        // Generate image
        const canvas = await html2canvas(reportContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            width: 800,
            windowWidth: 800
        });
        
        // Convert to blob and download
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const filename = `تقرير-الشكوى-${complaint.complaintId || complaintId}.png`;
            link.download = filename;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            
            // Cleanup
            document.body.removeChild(tempDiv);
            
            alert('✅ تم تصدير تقرير الشكوى بنجاح!');
        });
        
    } catch (error) {
        logger.error('Error exporting complaint report:', error);
        alert('❌ حدث خطأ أثناء تصدير التقرير');
    }
};
