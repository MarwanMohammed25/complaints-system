import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, push, set, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { sanitizeHTML } from './utils.js';
import { logger } from './logger.js';
import { addTrackedListener } from './cleanup.js';

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Check authentication
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '../index.html';
    } else {
        loadSupervisors();
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

// Load supervisors from database
async function loadSupervisors() {
    const supervisorSelect = document.getElementById('supervisor');
    
    try {
        const supervisorsRef = ref(database, 'supervisors');
        const snapshot = await get(supervisorsRef);
        
        // Clear existing options except the first one
        supervisorSelect.innerHTML = '<option value="">اختر المشرف</option>';
        
        if (snapshot.exists()) {
            const supervisors = snapshot.val();
            window.supervisorsData = supervisors; // حفظ للوصول لاحقاً
            Object.keys(supervisors).forEach(key => {
                const supervisor = supervisors[key];
                const option = document.createElement('option');
                option.value = JSON.stringify({ id: key, name: supervisor.name, area: supervisor.area || '', city: supervisor.city || '' });
                option.textContent = `${supervisor.name} - ${supervisor.area || 'بدون منطقة'} - ${supervisor.city || 'بدون مدينة'}`;
                supervisorSelect.appendChild(option);
            });
        }
    } catch (error) {
        logger.error('Error loading supervisors:', error);
    }
}

// Add supervisor button - redirect to supervisors page
addTrackedListener(document.getElementById('addSupervisorBtn'), 'click', () => {
    window.location.href = 'supervisors.html';
});

// Add manager button - redirect to managers page
addTrackedListener(document.getElementById('addManagerBtn'), 'click', () => {
    window.location.href = 'managers.html';
});

// Load managers
async function loadManagers() {
    try {
        const managersRef = ref(database, 'managers');
        const snapshot = await get(managersRef);
        
        const managerSelect = document.getElementById('manager');
        managerSelect.innerHTML = '<option value="">اختر المدير</option>';
        
        if (snapshot.exists()) {
            const managers = snapshot.val();
            window.managersData = managers; // حفظ للوصول لاحقاً
            Object.entries(managers).forEach(([id, manager]) => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ id: id, name: manager.name, area: manager.area || '', city: manager.city || '' });
                option.textContent = `${manager.name} - ${manager.area || 'بدون منطقة'} - ${manager.city || 'بدون مدينة'}`;
                managerSelect.appendChild(option);
            });
        }
    } catch (error) {
        logger.error('Error loading managers:', error);
    }
}

// Call loadManagers on page load
loadManagers();

// Auto-fill area and city when supervisor is selected
addTrackedListener(document.getElementById('supervisor'), 'change', (e) => {
    if (e.target.value) {
        try {
            const data = JSON.parse(e.target.value);
            if (data.area) document.getElementById('area').value = data.area;
            if (data.city) document.getElementById('city').value = data.city;
            // تغيير النص المعروض إلى الاسم فقط
            e.target.options[e.target.selectedIndex].textContent = data.name;
        } catch (error) {
            logger.error('Error parsing supervisor data:', error);
        }
    }
});

// Auto-fill area and city when manager is selected
addTrackedListener(document.getElementById('manager'), 'change', (e) => {
    if (e.target.value) {
        try {
            const data = JSON.parse(e.target.value);
            if (data.area) document.getElementById('area').value = data.area;
            if (data.city) document.getElementById('city').value = data.city;
            // تغيير النص المعروض إلى الاسم فقط
            e.target.options[e.target.selectedIndex].textContent = data.name;
        } catch (error) {
            logger.error('Error parsing manager data:', error);
        }
    }
});

// Form submission
const complaintForm = document.getElementById('complaintForm');
const phoneError = document.getElementById('phoneError');
const successMessage = document.getElementById('successMessage');

addTrackedListener(complaintForm, 'submit', async (e) => {
    e.preventDefault();
    
    // Hide messages
    phoneError.style.display = 'none';
    successMessage.style.display = 'none';

    // Get form values
    const customerName = document.getElementById('customerName').value.trim();
    const customerTitle = document.getElementById('customerTitle').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const buildingNumber = document.getElementById('buildingNumber').value.trim();
    const area = document.getElementById('area').value.trim();
    const city = document.getElementById('city').value.trim();
    const district = document.getElementById('district').value.trim();
    const supervisorValue = document.getElementById('supervisor').value;
    const managerValue = document.getElementById('manager').value;
    const complaintType = document.getElementById('complaintType').value.trim();
    const complaintContent = document.getElementById('complaintContent').value.trim();
    const notes = document.getElementById('notes').value.trim();
    
    // Parse supervisor and manager data
    let supervisorData = null;
    let managerData = null;
    
    if (supervisorValue) {
        try {
            supervisorData = JSON.parse(supervisorValue);
        } catch (e) {
            supervisorData = { id: supervisorValue, name: supervisorValue };
        }
    }
    
    if (managerValue) {
        try {
            managerData = JSON.parse(managerValue);
        } catch (e) {
            managerData = { id: managerValue, name: managerValue };
        }
    }

    // Validate phone number
    const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        phoneError.style.display = 'block';
        return;
    }

    try {
        // Get current year
        const currentYear = new Date().getFullYear();
        
        // Get all complaints to determine the next complaint number
        const complaintsRef = ref(database, 'complaints');
        const snapshot = await get(complaintsRef);
        
        let complaintNumber = 1;
        
        if (snapshot.exists()) {
            const complaints = snapshot.val();
            // Filter complaints from current year and get the highest number
            const currentYearComplaints = Object.values(complaints).filter(c => {
                if (c.complaintYear === currentYear) {
                    return true;
                }
                return false;
            });
            
            if (currentYearComplaints.length > 0) {
                const maxNumber = Math.max(...currentYearComplaints.map(c => c.complaintNumber || 0));
                complaintNumber = maxNumber + 1;
            }
        }
        
        // Format complaint ID (e.g., 2025/001)
        const complaintId = `${currentYear}/${String(complaintNumber).padStart(3, '0')}`;

        // Create complaint object
        const complaint = {
            complaintId,
            complaintNumber,
            complaintYear: currentYear,
            customerName,
            customerTitle: customerTitle || '-',
            phoneNumber,
            buildingNumber,
            area,
            city,
            district,
            supervisor: supervisorData ? supervisorData.name : null,
            supervisorId: supervisorData ? supervisorData.id : null,
            manager: managerData ? managerData.name : null,
            managerId: managerData ? managerData.id : null,
            complaintType,
            complaintContent,
            notes,
            status: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: auth.currentUser.uid
        };

        // Save to Firebase
        const newComplaintRef = push(complaintsRef);
        await set(newComplaintRef, complaint);

        // Show success message
        successMessage.textContent = 'تم حفظ الشكوى بنجاح!';
        successMessage.style.display = 'block';
        
        // Reset form
        complaintForm.reset();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);

    } catch (error) {
        logger.error('Error saving complaint:', error);
        
        // Hide upload progress
        document.getElementById('uploadProgress').style.display = 'none';
        
        // Show detailed error message
        let errorMessage = 'حدث خطأ أثناء حفظ الشكوى. الرجاء المحاولة مرة أخرى.';
        
        if (error.code === 'storage/unauthorized') {
            errorMessage = '⚠️ خطأ: Firebase Storage غير مفعّل!\n\nالرجاء:\n1. افتح Firebase Console\n2. فعّل Storage\n3. راجع ملف STORAGE_SETUP.md';
        } else if (error.code === 'storage/unauthenticated') {
            errorMessage = '⚠️ خطأ في المصادقة. الرجاء تسجيل الدخول مرة أخرى.';
        } else if (error.message) {
            errorMessage = `⚠️ خطأ: ${error.message}`;
        }
        
        alert(errorMessage);
    }
});

// Phone number validation on input
addTrackedListener(document.getElementById('phoneNumber'), 'input', (e) => {
    const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
    if (e.target.value && !phoneRegex.test(e.target.value)) {
        phoneError.style.display = 'block';
    } else {
        phoneError.style.display = 'none';
    }
});
