import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, push, set, get, update, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { sanitizeHTML } from './utils.js';
import { logger } from './logger.js';
import { addTrackedListener } from './cleanup.js';

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let managersData = {};
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

// Load managers and complaints data
async function loadData() {
    const loading = document.getElementById('loading');
    const managersTable = document.getElementById('managersTable');
    const noData = document.getElementById('noData');

    try {
        loading.style.display = 'block';
        managersTable.style.display = 'none';
        noData.style.display = 'none';

        // Load complaints to count per manager
        const complaintsRef = ref(database, 'complaints');
        const complaintsSnapshot = await get(complaintsRef);
        if (complaintsSnapshot.exists()) {
            complaintsData = complaintsSnapshot.val();
        }

        // Load managers
        const managersRef = ref(database, 'managers');
        const managersSnapshot = await get(managersRef);

        loading.style.display = 'none';

        if (managersSnapshot.exists()) {
            managersData = managersSnapshot.val();
            displayManagers(managersData);
            managersTable.style.display = 'block';
        } else {
            noData.style.display = 'block';
        }

    } catch (error) {
        logger.error('Error loading data:', error);
        loading.style.display = 'none';
        alert('حدث خطأ أثناء تحميل البيانات');
    }
}

// Display managers in table
function displayManagers(managers, searchTerm = '') {
    const tbody = document.getElementById('managersBody');
    tbody.innerHTML = '';

    const managersArray = Object.entries(managers).map(([id, data]) => ({
        id,
        ...data
    }));

    // Filter managers based on search
    let filteredManagers = managersArray;

    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredManagers = filteredManagers.filter(m => 
            m.name.toLowerCase().includes(search) ||
            m.phone.includes(search) ||
            m.department.toLowerCase().includes(search)
        );
    }

    // Display filtered managers
    filteredManagers.forEach(manager => {
        // Count complaints for this manager
        const complaintCount = Object.values(complaintsData).filter(
            c => c.manager === manager.id
        ).length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitizeHTML(manager.name)}</td>
            <td>${sanitizeHTML(manager.phone)}</td>
            <td>${sanitizeHTML(manager.department)}</td>
            <td>${sanitizeHTML(manager.notes || '-')}</td>
            <td><span style="background: #667eea; color: white; padding: 5px 10px; border-radius: 5px; font-weight: 600;">${complaintCount}</span></td>
            <td>
                <button onclick="editManager('${manager.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.9em; margin-left: 5px;">تعديل</button>
                <button onclick="deleteManager('${manager.id}', ${complaintCount})" class="btn btn-secondary" style="padding: 5px 10px; background: #dc3545; color: white; font-size: 0.9em;">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (filteredManagers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">لا توجد نتائج</td></tr>';
    }
}

// Add manager form submission
const managerForm = document.getElementById('managerForm');
const phoneError = document.getElementById('phoneError');
const successMessage = document.getElementById('successMessage');

addTrackedListener(managerForm, 'submit', async (e) => {
    e.preventDefault();
    
    // Hide messages
    phoneError.style.display = 'none';
    successMessage.style.display = 'none';

    // Get form values
    const name = document.getElementById('managerName').value.trim();
    const phone = document.getElementById('managerPhone').value.trim();
    const department = document.getElementById('managerDepartment').value.trim();
    const notes = document.getElementById('managerNotes').value.trim();

    console.log('Phone value:', phone, 'Length:', phone.length);

    // Validate phone number only if provided (and not empty)
    if (phone && phone.length > 0) {
        const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
        if (!phoneRegex.test(phone)) {
            console.log('Phone validation failed');
            phoneError.textContent = 'الرجاء إدخال رقم هاتف صحيح';
            phoneError.style.display = 'block';
            return;
        }
    }

    console.log('Validation passed, saving...');

    // Create manager object
    const manager = {
        name,
        phone: phone || 'غير متوفر',
        department,
        notes,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid
    };

    try {
        // Save to Firebase
        const managersRef = ref(database, 'managers');
        const newManagerRef = push(managersRef);
        await set(newManagerRef, manager);

        // Show success message
        successMessage.style.display = 'block';
        
        // Reset form
        managerForm.reset();

        // Reload data
        await loadData();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Error saving manager:', error);
        alert('حدث خطأ أثناء حفظ المدير. الرجاء المحاولة مرة أخرى.');
    }
});

// Phone number validation on input
addTrackedListener(document.getElementById('managerPhone'), 'input', (e) => {
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
    displayManagers(managersData, e.target.value);
});

// Edit manager
window.editManager = function(managerId) {
    const manager = managersData[managerId];
    if (!manager) return;

    document.getElementById('editManagerId').value = managerId;
    document.getElementById('editManagerName').value = manager.name;
    document.getElementById('editManagerPhone').value = manager.phone;
    document.getElementById('editManagerDepartment').value = manager.department;
    document.getElementById('editManagerNotes').value = manager.notes || '';

    document.getElementById('editModal').style.display = 'block';
};

// Close edit modal
window.closeEditModal = function() {
    document.getElementById('editModal').style.display = 'none';
};

// Edit form submission
addTrackedListener(document.getElementById('editForm'), 'submit', async (e) => {
    e.preventDefault();

    const managerId = document.getElementById('editManagerId').value;
    const name = document.getElementById('editManagerName').value.trim();
    const phone = document.getElementById('editManagerPhone').value.trim();
    const department = document.getElementById('editManagerDepartment').value.trim();
    const notes = document.getElementById('editManagerNotes').value.trim();

    // Validate phone only if provided
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
            phone: phone || 'غير متوفر',
            department,
            notes,
            updatedAt: new Date().toISOString()
        });

        closeEditModal();
        await loadData();
        alert('تم تحديث بيانات المدير بنجاح');

    } catch (error) {
        console.error('Error updating manager:', error);
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
        
        await loadData();
        alert('تم حذف المدير بنجاح');

    } catch (error) {
        console.error('Error deleting manager:', error);
        alert('حدث خطأ أثناء حذف المدير');
    }
};

// Close modal on outside click
addTrackedListener(document.getElementById('editModal'), 'click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});
