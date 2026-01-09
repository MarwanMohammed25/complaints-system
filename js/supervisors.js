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
let complaintsData = {};

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

// Load supervisors and complaints data
async function loadData() {
    const loading = document.getElementById('loading');
    const supervisorsTable = document.getElementById('supervisorsTable');
    const noData = document.getElementById('noData');

    try {
        loading.style.display = 'block';
        supervisorsTable.style.display = 'none';
        noData.style.display = 'none';

        // Load complaints to count per supervisor
        const complaintsRef = ref(database, 'complaints');
        const complaintsSnapshot = await get(complaintsRef);
        if (complaintsSnapshot.exists()) {
            complaintsData = complaintsSnapshot.val();
        }

        // Load supervisors
        const supervisorsRef = ref(database, 'supervisors');
        const supervisorsSnapshot = await get(supervisorsRef);

        loading.style.display = 'none';

        if (supervisorsSnapshot.exists()) {
            supervisorsData = supervisorsSnapshot.val();
            displaySupervisors(supervisorsData);
            supervisorsTable.style.display = 'block';
        } else {
            noData.style.display = 'block';
        }

    } catch (error) {
        logger.error('Error loading data:', error);
        loading.style.display = 'none';
        alert('حدث خطأ أثناء تحميل البيانات');
    }
}

// Display supervisors in table
function displaySupervisors(supervisors, searchTerm = '') {
    const tbody = document.getElementById('supervisorsBody');
    tbody.innerHTML = '';

    const supervisorsArray = Object.entries(supervisors).map(([id, data]) => ({
        id,
        ...data
    }));

    // Filter supervisors based on search
    let filteredSupervisors = supervisorsArray;

    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredSupervisors = filteredSupervisors.filter(s => 
            s.name.toLowerCase().includes(search) ||
            s.phone.includes(search) ||
            s.area.toLowerCase().includes(search)
        );
    }

    // Display filtered supervisors
    filteredSupervisors.forEach(supervisor => {
        // Count complaints for this supervisor
        const complaintCount = Object.values(complaintsData).filter(
            c => c.supervisor === supervisor.id
        ).length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitizeHTML(supervisor.name)}</td>
            <td>${sanitizeHTML(supervisor.phone)}</td>
            <td>${sanitizeHTML(supervisor.area)}</td>
            <td>${sanitizeHTML(supervisor.notes || '-')}</td>
            <td><span style="background: #667eea; color: white; padding: 5px 10px; border-radius: 5px; font-weight: 600;">${complaintCount}</span></td>
            <td>
                <button onclick="editSupervisor('${supervisor.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.9em; margin-left: 5px;">تعديل</button>
                <button onclick="deleteSupervisor('${supervisor.id}', ${complaintCount})" class="btn btn-secondary" style="padding: 5px 10px; background: #dc3545; color: white; font-size: 0.9em;">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (filteredSupervisors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">لا توجد نتائج</td></tr>';
    }
}

// Add supervisor form submission
const supervisorForm = document.getElementById('supervisorForm');
const phoneError = document.getElementById('phoneError');
const successMessage = document.getElementById('successMessage');

addTrackedListener(supervisorForm, 'submit', async (e) => {
    e.preventDefault();
    
    // Hide messages
    phoneError.style.display = 'none';
    successMessage.style.display = 'none';

    // Get form values
    const name = document.getElementById('supervisorName').value.trim();
    const phone = document.getElementById('supervisorPhone').value.trim();
    const area = document.getElementById('supervisorArea').value.trim();
    const notes = document.getElementById('supervisorNotes').value.trim();

    logger.log('Phone value:', phone, 'Length:', phone.length);

    // Validate phone number only if provided (and not empty)
    if (phone && phone.length > 0) {
        const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
        if (!phoneRegex.test(phone)) {
            logger.log('Phone validation failed');
            phoneError.textContent = 'الرجاء إدخال رقم هاتف صحيح';
            phoneError.style.display = 'block';
            return;
        }
    }

    logger.log('Validation passed, saving...');

    // Create supervisor object
    const supervisor = {
        name,
        phone: phone || 'غير متوفر',
        area,
        notes,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
    };

    try {
        // Save to Firebase
        const supervisorsRef = ref(database, 'supervisors');
        const newSupervisorRef = push(supervisorsRef);
        await set(newSupervisorRef, supervisor);

        // Show success message
        successMessage.style.display = 'block';
        
        // Reset form
        supervisorForm.reset();

        // Reload data
        await loadData();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);

    } catch (error) {
        logger.error('Error saving supervisor:', error);
        alert('حدث خطأ أثناء حفظ المشرف. الرجاء المحاولة مرة أخرى.');
    }
});

// Phone number validation on input
addTrackedListener(document.getElementById('supervisorPhone'), 'input', (e) => {
    const phoneValue = e.target.value.trim();
    
    // If empty, hide error
    if (!phoneValue) {
        phoneError.style.display = 'none';
        phoneError.textContent = 'الرجاء إدخال رقم هاتف صحيح';
        return;
    }
    
    // If has value, validate it
    const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
    if (!phoneRegex.test(phoneValue)) {
        phoneError.textContent = 'الرجاء إدخال رقم هاتف صحيح';
        phoneError.style.display = 'block';
    } else {
        phoneError.style.display = 'none';
    }
});

// Search functionality
addTrackedListener(document.getElementById('searchInput'), 'input', (e) => {
    displaySupervisors(supervisorsData, e.target.value);
});

// Edit supervisor
window.editSupervisor = function(supervisorId) {
    const supervisor = supervisorsData[supervisorId];
    if (!supervisor) return;

    document.getElementById('editSupervisorId').value = supervisorId;
    document.getElementById('editSupervisorName').value = supervisor.name;
    document.getElementById('editSupervisorPhone').value = supervisor.phone;
    document.getElementById('editSupervisorArea').value = supervisor.area;
    document.getElementById('editSupervisorNotes').value = supervisor.notes || '';

    document.getElementById('editModal').style.display = 'block';
};

// Close edit modal
window.closeEditModal = function() {
    document.getElementById('editModal').style.display = 'none';
};

// Edit form submission
addTrackedListener(document.getElementById('editForm'), 'submit', async (e) => {
    e.preventDefault();

    const supervisorId = document.getElementById('editSupervisorId').value;
    const name = document.getElementById('editSupervisorName').value.trim();
    const phone = document.getElementById('editSupervisorPhone').value.trim();
    const area = document.getElementById('editSupervisorArea').value.trim();
    const notes = document.getElementById('editSupervisorNotes').value.trim();

    // Validate phone only if provided
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
            phone: phone || 'غير متوفر',
            area,
            notes,
            updatedAt: new Date().toISOString()
        });

        closeEditModal();
        await loadData();
        alert('تم تحديث بيانات المشرف بنجاح');

    } catch (error) {
        console.error('Error updating supervisor:', error);
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
        
        await loadData();
        alert('تم حذف المشرف بنجاح');

    } catch (error) {
        console.error('Error deleting supervisor:', error);
        alert('حدث خطأ أثناء حذف المشرف');
    }
};

// Close modal on outside click
addTrackedListener(document.getElementById('editModal'), 'click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});
