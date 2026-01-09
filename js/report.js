import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { addTrackedListener } from './cleanup.js';

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let complaintsData = {};
let supervisorsData = {};

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
        console.error('Logout error:', error);
        alert('حدث خطأ أثناء تسجيل الخروج');
    }
});

// Load data and generate report
async function loadData() {
    const loading = document.getElementById('loading');
    const reportContent = document.getElementById('reportContent');
    const noData = document.getElementById('noData');

    try {
        loading.style.display = 'block';
        reportContent.style.display = 'none';
        noData.style.display = 'none';

        // Load supervisors
        const supervisorsRef = ref(database, 'supervisors');
        const supervisorsSnapshot = await get(supervisorsRef);
        if (supervisorsSnapshot.exists()) {
            supervisorsData = supervisorsSnapshot.val();
        }

        // Load complaints
        const complaintsRef = ref(database, 'complaints');
        const complaintsSnapshot = await get(complaintsRef);

        loading.style.display = 'none';

        if (complaintsSnapshot.exists()) {
            complaintsData = complaintsSnapshot.val();
            generateReport();
            reportContent.style.display = 'block';
        } else {
            noData.style.display = 'block';
        }

    } catch (error) {
        console.error('Error loading data:', error);
        loading.style.display = 'none';
        alert('حدث خطأ أثناء تحميل البيانات');
    }
}

// Generate report
function generateReport() {
    // 1. Get unresolved complaints by supervisor
    const unresolvedBySupervisor = getUnresolvedBySupervisor();
    
    // 2. Get repeated complaints
    const repeatedComplaints = getRepeatedComplaints();
    
    // 3. Update statistics
    updateStatistics(unresolvedBySupervisor, repeatedComplaints);
    
    // 4. Display unresolved complaints
    displayUnresolvedBySupervisor(unresolvedBySupervisor);
    
    // 5. Display repeated complaints
    displayRepeatedComplaints(repeatedComplaints);
}

// Get unresolved complaints grouped by supervisor
function getUnresolvedBySupervisor() {
    const result = {};
    
    Object.entries(complaintsData).forEach(([id, complaint]) => {
        // Only non-resolved complaints (pending or processing)
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
    
    // Sort by number of complaints (most to least)
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
    
    // Group complaints by phone number and building
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
    
    // Filter only customers with multiple complaints
    const repeated = Object.values(customerMap).filter(customer => customer.complaints.length > 1);
    
    // Sort by number of complaints (most to least)
    return repeated.sort((a, b) => b.complaints.length - a.complaints.length);
}

// Update statistics
function updateStatistics(unresolvedBySupervisor, repeatedComplaints) {
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
            const date = new Date(complaint.createdAt).toLocaleDateString('ar-EG');
            
            html += `
                <div class="complaint-item ${statusClass}">
                    <strong>🔔 ${complaint.complaintId || '-'}</strong> - ${complaint.customerName}
                    <br>
                    <small>📞 ${complaint.phoneNumber} | 🏢 ${complaint.buildingNumber} | 📍 ${complaint.area}</small>
                    <br>
                    <small>📋 ${complaint.complaintType} | 📅 ${date} | 🔄 ${statusText}</small>
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
                    👥 ${customer.customerName} - ${customer.complaints.length} شكوى
                    <br>
                    <small>📞 ${customer.phoneNumber} | 🏢 ${customer.buildingNumber} | 📍 ${customer.area}</small>
                </div>
        `;
        
        // Sort complaints by date (newest first)
        const sortedComplaints = customer.complaints.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        sortedComplaints.forEach((complaint, index) => {
            const date = new Date(complaint.createdAt).toLocaleDateString('ar-EG');
            const statusText = complaint.status === 'pending' ? '⏳ قيد الانتظار' : 
                              complaint.status === 'processing' ? '🔄 قيد المعالجة' : 
                              '✅ تم الحل';
            
            html += `
                <div class="repeated-complaint">
                    <strong>${index + 1}. ${complaint.complaintId || '-'}</strong> - ${statusText}
                    <br>
                    <small>📋 ${complaint.complaintType}</small>
                    <br>
                    <small>📅 ${date}</small>
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}
