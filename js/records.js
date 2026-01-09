import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, get, update, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
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

// Load complaints and supervisors data
async function loadData() {
    const loading = document.getElementById('loading');
    const complaintsTable = document.getElementById('complaintsTable');
    const noData = document.getElementById('noData');

    try {
        loading.style.display = 'block';
        complaintsTable.style.display = 'none';
        noData.style.display = 'none';

        // Load supervisors first
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
            displayComplaints(complaintsData);
            complaintsTable.style.display = 'block';
        } else {
            noData.style.display = 'block';
        }

    } catch (error) {
        console.error('Error loading data:', error);
        loading.style.display = 'none';
        alert('حدث خطأ أثناء تحميل البيانات');
    }
}

// Get linked documents count for a complaint
function getLinkedDocuments(complaintId, complaintRef = null) {
    const STORAGE_KEY = 'complaints_documents';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;
    
    let documents = JSON.parse(stored);
    
    // التأكد من أن documents هو array
    if (!Array.isArray(documents)) {
        if (documents && typeof documents === 'object') {
            documents = Object.values(documents);
        } else {
            return 0;
        }
    }
    
    // البحث باستخدام complaintId أو complaintRef
    return documents.filter(doc => 
        doc.complaintId === complaintId || 
        (complaintRef && doc.complaintRef === complaintRef)
    ).length;
}

// Get linked documents data for a complaint
function getLinkedDocumentsData(complaintId, complaintRef = null) {
    const STORAGE_KEY = 'complaints_documents';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    let documents = JSON.parse(stored);
    
    // التأكد من أن documents هو array
    if (!Array.isArray(documents)) {
        if (documents && typeof documents === 'object') {
            documents = Object.values(documents);
        } else {
            return [];
        }
    }
    
    // البحث باستخدام complaintId أو complaintRef
    return documents.filter(doc => 
        doc.complaintId === complaintId || 
        (complaintRef && doc.complaintRef === complaintRef)
    );
}

// View linked document
window.viewLinkedDocument = function(docId) {
    const STORAGE_KEY = 'complaints_documents';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        alert('لا توجد مستندات محفوظة');
        return;
    }
    
    let documents = JSON.parse(stored);
    
    // التأكد من أن documents هو array
    if (!Array.isArray(documents)) {
        if (documents && typeof documents === 'object') {
            documents = Object.values(documents);
        } else {
            alert('خطأ في بيانات المستندات');
            return;
        }
    }
    
    const doc = documents.find(d => d.id === docId);
    
    if (!doc) {
        alert('المستند غير موجود');
        return;
    }

    if (!doc.data) {
        alert('بيانات المستند غير متوفرة');
        return;
    }

    // Create new window and display document
    const newWindow = window.open('', '_blank');
    if (!newWindow) {
        alert('يرجى السماح بفتح النوافذ المنبثقة');
        return;
    }
    
    if (doc.category === 'image') {
        newWindow.document.write(`
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${doc.name}</title>
                    <style>
                        body { 
                            margin: 0; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh; 
                            background: #333; 
                        }
                        img { 
                            max-width: 100%; 
                            max-height: 100vh; 
                            object-fit: contain;
                        }
                    </style>
                </head>
                <body>
                    <img src="${doc.data}" alt="${doc.name}" onerror="document.body.innerHTML='<div style=color:white>خطأ في تحميل الصورة</div>'">
                </body>
            </html>
        `);
        newWindow.document.close();
    } else if (doc.type === 'application/pdf') {
        newWindow.document.write(`
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${doc.name}</title>
                </head>
                <body style="margin: 0;">
                    <embed src="${doc.data}" type="application/pdf" width="100%" height="100%" />
                </body>
            </html>
        `);
        newWindow.document.close();
    } else {
        newWindow.location.href = doc.data;
    }
};

// Download linked document
window.downloadLinkedDocument = function(docId) {
    const STORAGE_KEY = 'complaints_documents';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    let documents = JSON.parse(stored);
    
    // التأكد من أن documents هو array
    if (!Array.isArray(documents)) {
        if (documents && typeof documents === 'object') {
            documents = Object.values(documents);
        } else {
            return;
        }
    }
    
    const doc = documents.find(d => d.id === docId);
    
    if (!doc) return;

    const link = document.createElement('a');
    link.href = doc.data;
    link.download = doc.name;
    link.click();
};

// Display complaints in table
function displayComplaints(complaints, filter = 'all', searchTerm = '') {
    const tbody = document.getElementById('complaintsBody');
    tbody.innerHTML = '';

    const complaintsArray = Object.entries(complaints).map(([id, data]) => ({
        id,
        ...data
    }));

    // Sort by complaint number (oldest first)
    complaintsArray.sort((a, b) => {
        // Extract year and number from complaintId (e.g., "2025/001")
        const getYearAndNum = (complaint) => {
            if (complaint.complaintId) {
                const parts = complaint.complaintId.split('/');
                return {
                    year: parseInt(parts[0]) || 0,
                    num: parseInt(parts[1]) || 0
                };
            }
            return {
                year: complaint.complaintYear || 0,
                num: complaint.complaintNumber || 0
            };
        };
        
        const dataA = getYearAndNum(a);
        const dataB = getYearAndNum(b);
        
        // Sort by year first (ascending), then by number (ascending)
        if (dataA.year !== dataB.year) {
            return dataA.year - dataB.year;
        }
        return dataA.num - dataB.num;
    });

    // Filter complaints
    let filteredComplaints = complaintsArray;

    if (filter !== 'all') {
        filteredComplaints = filteredComplaints.filter(c => c.status === filter);
    }

    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredComplaints = filteredComplaints.filter(c => 
            c.customerName.toLowerCase().includes(search) ||
            c.phoneNumber.includes(search) ||
            c.area.toLowerCase().includes(search) ||
            (c.city && c.city.toLowerCase().includes(search)) ||
            (c.district && c.district.toLowerCase().includes(search))
        );
    }

    // Display filtered complaints
    filteredComplaints.forEach(complaint => {
        const row = document.createElement('tr');
        const supervisorName = supervisorsData[complaint.supervisor]?.name || 'غير محدد';
        const date = new Date(complaint.createdAt).toLocaleDateString('ar-EG');
        const complaintId = complaint.complaintId || '-';
        
        // Count linked documents - البحث باستخدام id و complaintId معاً
        const linkedDocs = getLinkedDocuments(complaint.id, complaint.complaintId);
        
        let statusText = '';
        let statusClass = '';
        switch (complaint.status) {
            case 'pending':
                statusText = 'قيد الانتظار';
                statusClass = 'status-pending';
                break;
            case 'processing':
                statusText = 'قيد المعالجة';
                statusClass = 'status-processing';
                break;
            case 'resolved':
                statusText = 'تم الحل';
                statusClass = 'status-resolved';
                break;
        }

        row.innerHTML = `
            <td><strong style="color: #667eea;">${complaintId}</strong>${linkedDocs > 0 ? ` <span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.75em;">📎 ${linkedDocs}</span>` : ''}</td>
            <td>${date}</td>
            <td>${complaint.customerName}</td>
            <td>${complaint.phoneNumber}</td>
            <td>${complaint.buildingNumber}</td>
            <td>${complaint.area}</td>
            <td>${complaint.city || '-'}</td>
            <td>${complaint.district || '-'}</td>
            <td>${supervisorName}</td>
            <td>${complaint.complaintType}</td>
            <td><button onclick="showDetails('${complaint.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.9em;">عرض</button></td>
            <td>${complaint.notes || '-'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <select onchange="updateStatus('${complaint.id}', this.value)" style="padding: 5px; border-radius: 5px;">
                    <option value="">تغيير الحالة</option>
                    <option value="pending" ${complaint.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                    <option value="processing" ${complaint.status === 'processing' ? 'selected' : ''}>قيد المعالجة</option>
                    <option value="resolved" ${complaint.status === 'resolved' ? 'selected' : ''}>تم الحل</option>
                </select>
                <button onclick="editComplaint('${complaint.id}')" class="btn btn-secondary" style="padding: 5px 10px; margin-top: 5px; background: #28a745; color: white; font-size: 0.9em;">تعديل</button>
                <button onclick="deleteComplaint('${complaint.id}')" class="btn btn-secondary" style="padding: 5px 10px; margin-top: 5px; background: #dc3545; color: white; font-size: 0.9em;">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (filteredComplaints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 20px;">لا توجد نتائج</td></tr>';
    }
}

// Show complaint details in modal
window.showDetails = function(complaintId) {
    const complaint = complaintsData[complaintId];
    if (!complaint) return;

    const supervisorName = supervisorsData[complaint.supervisor]?.name || 'غير محدد';
    const date = new Date(complaint.createdAt).toLocaleString('ar-EG');
    const complaintNumber = complaint.complaintId || 'غير محدد';
    
    // Get linked documents from localStorage - البحث باستخدام id و complaintId معاً
    const linkedDocs = getLinkedDocumentsData(complaintId, complaint.complaintId);

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h2 style="color: #667eea; margin-bottom: 20px;">تفاصيل الشكوى</h2>
        <div style="line-height: 2;">
            <p><strong>رقم الشكوى:</strong> <span style="color: #667eea; font-size: 1.2em; font-weight: bold;">${complaintNumber}</span></p>
            <p><strong>التاريخ:</strong> ${date}</p>
            <p><strong>اسم العميل:</strong> ${complaint.customerName}</p>
            <p><strong>رقم الهاتف:</strong> ${complaint.phoneNumber}</p>
            <p><strong>رقم العمارة:</strong> ${complaint.buildingNumber}</p>
            <p><strong>المنطقة:</strong> ${complaint.area}</p>
            <p><strong>المدينة:</strong> ${complaint.city || '-'}</p>
            <p><strong>الحي:</strong> ${complaint.district || '-'}</p>
            <p><strong>المشرف:</strong> ${supervisorName}</p>
            <p><strong>نوع الشكوى:</strong> ${complaint.complaintType}</p>
            <p><strong>محتوى الشكوى:</strong></p>
            <p style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 10px;">${complaint.complaintContent}</p>
            ${complaint.notes ? `
                <p><strong>ملاحظات:</strong></p>
                <p style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 10px;">${complaint.notes}</p>
            ` : ''}
            ${complaint.closureComment ? `
                <p><strong>تعليق الإغلاق:</strong></p>
                <p style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 10px; border-right: 4px solid #4caf50;">${complaint.closureComment}</p>
                ${complaint.closureDate ? `<p style="color: #666; font-size: 0.9em; margin-top: 5px;">تاريخ الإغلاق: ${new Date(complaint.closureDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(complaint.closureDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>` : ''}
            ` : ''}
            ${linkedDocs.length > 0 ? `
                <div style="margin-top: 20px;">
                    ${(() => {
                        const beforeDocs = linkedDocs.filter(doc => doc.documentType === 'before');
                        const afterDocs = linkedDocs.filter(doc => doc.documentType === 'after');
                        let html = '';
                        
                        // صور قبل
                        if (beforeDocs.length > 0) {
                            html += `
                                <div style="margin-bottom: 20px;">
                                    <p><strong>📷 صور قبل (${beforeDocs.length}):</strong></p>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                                        ${beforeDocs.map((doc) => {
                                            const isImage = doc.category === 'image';
                                            return `
                                                <div style="border: 2px solid #ff9800; border-radius: 8px; padding: 10px; text-align: center; background: #fff3e0;">
                                                    ${isImage ? `<img src="${doc.data}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 5px; margin-bottom: 5px; cursor: pointer;" onclick="viewLinkedDocument('${doc.id}')">` : 
                                                      `<div style="font-size: 40px; margin-bottom: 5px;">${doc.icon}</div>`}
                                                    <div style="font-size: 0.8em; color: #666; margin-bottom: 5px; word-break: break-all;">${doc.name}</div>
                                                    <button onclick="downloadLinkedDocument('${doc.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8em; width: 100%; background: #ff9800;">📥 تحميل</button>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        // صور بعد
                        if (afterDocs.length > 0) {
                            html += `
                                <div style="margin-bottom: 20px;">
                                    <p><strong>✅ صور بعد (${afterDocs.length}):</strong></p>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                                        ${afterDocs.map((doc) => {
                                            const isImage = doc.category === 'image';
                                            return `
                                                <div style="border: 2px solid #4caf50; border-radius: 8px; padding: 10px; text-align: center; background: #e8f5e9;">
                                                    ${isImage ? `<img src="${doc.data}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 5px; margin-bottom: 5px; cursor: pointer;" onclick="viewLinkedDocument('${doc.id}')">` : 
                                                      `<div style="font-size: 40px; margin-bottom: 5px;">${doc.icon}</div>`}
                                                    <div style="font-size: 0.8em; color: #666; margin-bottom: 5px; word-break: break-all;">${doc.name}</div>
                                                    <button onclick="downloadLinkedDocument('${doc.id}')" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.8em; width: 100%; background: #4caf50;">📥 تحميل</button>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        return html;
                    })()}
                </div>
            ` : ''}
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="printComplaint('${complaintId}')" class="btn btn-primary" style="flex: 1;">
                🖨️ طباعة الشكوى
            </button>
            <button onclick="printComplaintWithBackground('${complaintId}')" class="btn btn-primary" style="flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                🖨️ طباعة بخلفية رسمية
            </button>
            <button onclick="exportComplaintAsImage('${complaintId}')" class="btn btn-success" style="flex: 1;">
                📸 تصدير كصورة
            </button>
            <button onclick="sendToWhatsApp('${complaintId}')" class="btn btn-success" style="flex: 1; background: #25D366;">
                📱 إرسال واتساب
            </button>
            </button>
        </div>
    `;

    document.getElementById('detailsModal').style.display = 'block';
};

// Print complaint
window.printComplaint = function(complaintId) {
    const complaint = complaintsData[complaintId];
    if (!complaint) return;

    // Get supervisor info with title
    const supervisor = complaint.supervisor && supervisorsData[complaint.supervisor] 
        ? supervisorsData[complaint.supervisor]
        : null;
    
    let supervisorName = 'غير محدد';
    if (supervisor) {
        supervisorName = supervisor.title && supervisor.title !== '-' 
            ? `${supervisor.title} ${supervisor.name}` 
            : supervisor.name;
    }
    
    const createdDate = new Date(complaint.createdAt);
    const lastUpdateDate = complaint.lastStatusUpdate ? new Date(complaint.lastStatusUpdate) : createdDate;
    
    // Format date and time in English with space between them
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    
    const datePart = createdDate.toLocaleDateString('en-US', dateOptions);
    const timePart = createdDate.toLocaleTimeString('en-US', timeOptions);
    const submitDate = `${datePart} ${timePart}`;
    
    const lastUpdateDatePart = lastUpdateDate.toLocaleDateString('en-US', dateOptions);
    const lastUpdateTimePart = lastUpdateDate.toLocaleTimeString('en-US', timeOptions);
    const lastUpdate = `${lastUpdateDatePart} ${lastUpdateTimePart}`;
    
    const complaintNumber = complaint.complaintId || 'غير محدد';
    
    let statusText = '';
    switch (complaint.status) {
        case 'pending':
            statusText = 'قيد الانتظار';
            break;
        case 'processing':
            statusText = 'قيد المعالجة';
            break;
        case 'resolved':
            statusText = 'تم الحل';
            break;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>طباعة الشكوى - ${complaintNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            padding: 10px;
            background: white;
        }
        
        .print-container {
            max-width: 800px;
            margin: 0 auto;
            border: 2px solid #4a90e2;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .print-header {
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            padding: 15px;
            text-align: center;
        }
        
        .print-header h1 {
            font-size: 24px;
            margin-bottom: 3px;
            font-weight: bold;
        }
        
        .print-header p {
            font-size: 14px;
            opacity: 0.95;
        }
        
        .section-title {
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            padding: 8px 15px;
            font-size: 16px;
            font-weight: bold;
            margin-top: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .complaint-number {
            background: #e3f2fd;
            padding: 12px;
            text-align: center;
            border-bottom: 2px solid #4a90e2;
        }
        
        .complaint-number-label {
            color: #4a90e2;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        
        .complaint-number-value {
            color: #1565c0;
            font-size: 20px;
            font-weight: bold;
        }
        
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            background: #f8f9fa;
        }
        
        .detail-item {
            padding: 10px 15px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            align-items: center;
        }
        
        .detail-item:nth-child(odd) {
            background: white;
        }
        
        .detail-label {
            color: #555;
            font-weight: 600;
            min-width: 100px;
            margin-left: 8px;
            font-size: 14px;
        }
        
        .detail-value {
            color: #333;
            font-size: 14px;
        }
        
        .full-width {
            grid-column: 1 / -1;
        }
        
        .content-section {
            padding: 12px;
            background: white;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .content-box {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
            border-right: 3px solid #4a90e2;
            line-height: 1.6;
            color: #333;
            font-size: 14px;
        }
        
        .status-section {
            padding: 12px;
            background: #e8f5e9;
            text-align: center;
        }
        
        .status-badge {
            display: inline-block;
            background: #4caf50;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
        }
        
        .print-footer {
            background: #f8f9fa;
            padding: 12px;
            border-top: 2px solid #4a90e2;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        
        .timestamp {
            margin-top: 5px;
            font-size: 11px;
            color: #999;
        }
        
        .divider {
            height: 1px;
            background: linear-gradient(to left, transparent, #4a90e2, transparent);
            margin: 0;
        }
        
        @media print {
            body {
                padding: 0;
                margin: 0;
            }
            
            .print-container {
                border: none;
                max-width: 100%;
                margin: 0;
            }
            
            @page {
                margin: 10mm;
                size: A4;
            }
        }
    </style>
</head>
<body>
    <div class="print-container">
        <div class="print-header">
            <h1>🏢 التعمير لإدارة المرافق</h1>
            <p>منظومة الشكاوى والمتابعة الإلكترونية</p>
        </div>
        
        <div class="complaint-number">
            <div class="complaint-number-label">الرقم المرجعي:</div>
            <div class="complaint-number-value">${complaintNumber}</div>
        </div>
        
        <div class="section-title">📋 بيانات الشكوى</div>
        
        <div class="details-grid">
            <div class="detail-item">
                <span class="detail-label">اسم العميل</span>
                <span class="detail-value">${complaint.customerTitle && complaint.customerTitle !== '-' ? complaint.customerTitle + ' ' + complaint.customerName : complaint.customerName}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">رقم التليفون</span>
                <span class="detail-value">${complaint.phoneNumber}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">رقم العمارة</span>
                <span class="detail-value">${complaint.buildingNumber}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">المنطقة</span>
                <span class="detail-value">${complaint.area}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">المدينة</span>
                <span class="detail-value">${complaint.city || 'بدر'}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">الحي</span>
                <span class="detail-value">${complaint.district || 'الحجس'}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">اسم المشرف</span>
                <span class="detail-value">${supervisorName}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">نوع الشكوى</span>
                <span class="detail-value">${complaint.complaintType}</span>
            </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="content-section">
            <div class="section-title" style="margin-top: 0; margin-bottom: 15px;">حالة الشكوى</div>
            <div class="content-box">${statusText}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="content-section">
            <div class="section-title" style="margin-top: 0; margin-bottom: 15px;">محتوى الشكوى</div>
            <div class="content-box">${complaint.complaintContent}</div>
        </div>
        
        ${complaint.notes ? `
        <div class="divider"></div>
        <div class="content-section">
            <div class="section-title" style="margin-top: 0; margin-bottom: 15px;">ملاحظات</div>
            <div class="content-box">${complaint.notes}</div>
        </div>
        ` : ''}
        
        ${complaint.closureComment ? `
        <div class="divider"></div>
        <div class="content-section">
            <div class="section-title" style="margin-top: 0; margin-bottom: 15px; background: #4caf50;">✅ تعليق الإغلاق</div>
            <div class="content-box" style="border-right-color: #4caf50; background: #e8f5e9;">${complaint.closureComment}</div>
            ${complaint.closureDate ? `<div style="padding: 10px 20px; font-size: 0.9em; color: #666;">تاريخ الإغلاق: ${new Date(complaint.closureDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(complaint.closureDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>` : ''}
        </div>
        ` : ''}
        
        <div class="divider"></div>
        
        <div class="details-grid">
            <div class="detail-item">
                <span class="detail-label">تاريخ التقديم</span>
                <span class="detail-value">${submitDate}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">آخر تحديث للحالة</span>
                <span class="detail-value">${lastUpdate}</span>
            </div>
        </div>
        
        <div class="print-footer">
            <div style="display: flex; justify-content: flex-end; padding-left: 20px; margin-bottom: 20px;">
                <div style="text-align: center; min-width: 150px;">
                    <div style="margin-bottom: 5px;"><strong>يعتمد</strong></div>
                    <div style="border-bottom: 2px dotted #999; width: 100%; padding-bottom: 2px;">............................................</div>
                </div>
            </div>
            <div style="margin-top: 30px; font-size: 13px;">
                <strong>تم استلام الشكوى إلكترونياً – التعمير لإدارة المرافق © ${new Date().getFullYear()}</strong>
            </div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
    `);
    
    printWindow.document.close();
};

// Print complaint with background
window.printComplaintWithBackground = function(complaintId) {
    const complaint = complaintsData[complaintId];
    if (!complaint) return;

    // Get the correct path for background image
    const fs = require('fs');
    const path = require('path');
    
    // Try multiple possible paths
    let backgroundPath = path.join(__dirname, 'background.jpg');
    if (!fs.existsSync(backgroundPath)) {
        backgroundPath = path.join(process.resourcesPath, 'app', 'background.jpg');
    }
    if (!fs.existsSync(backgroundPath)) {
        backgroundPath = path.join(process.cwd(), 'background.jpg');
    }
    
    // Convert to base64 for embedding in HTML
    let backgroundImageUrl = '';
    try {
        if (fs.existsSync(backgroundPath)) {
            const imageBuffer = fs.readFileSync(backgroundPath);
            const base64Image = imageBuffer.toString('base64');
            backgroundImageUrl = `data:image/jpeg;base64,${base64Image}`;
        }
    } catch (error) {
        console.error('Error loading background image:', error);
    }
    
    printWithBackground(complaintId, complaint, backgroundImageUrl);
};

function printWithBackground(complaintId, complaint, backgroundImage) {
    // Get supervisor info with title
    const supervisor = complaint.supervisor && supervisorsData[complaint.supervisor] 
        ? supervisorsData[complaint.supervisor]
        : null;
    
    let supervisorName = 'غير محدد';
    if (supervisor) {
        supervisorName = supervisor.title && supervisor.title !== '-' 
            ? `${supervisor.title} ${supervisor.name}` 
            : supervisor.name;
    }
    
    const createdDate = new Date(complaint.createdAt);
    const lastUpdateDate = complaint.lastStatusUpdate ? new Date(complaint.lastStatusUpdate) : createdDate;
    
    // Format date and time in English with space between them
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    
    const datePart = createdDate.toLocaleDateString('en-US', dateOptions);
    const timePart = createdDate.toLocaleTimeString('en-US', timeOptions);
    const submitDate = `${datePart} ${timePart}`;
    
    const lastUpdateDatePart = lastUpdateDate.toLocaleDateString('en-US', dateOptions);
    const lastUpdateTimePart = lastUpdateDate.toLocaleTimeString('en-US', timeOptions);
    const lastUpdate = `${lastUpdateDatePart} ${lastUpdateTimePart}`;
    
    const complaintNumber = complaint.complaintId || 'غير محدد';
    
    let statusText = '';
    switch (complaint.status) {
        case 'pending':
            statusText = '⏳ قيد الانتظار - تم استلام الشكوى وجاري المراجعة';
            break;
        case 'in-progress':
            statusText = '🔄 قيد المعالجة - يتم العمل على حل الشكوى';
            break;
        case 'resolved':
            statusText = '✅ تم الحل - تم إغلاق الشكوى بنجاح';
            break;
        default:
            statusText = complaint.status;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>طباعة الشكوى - ${complaintNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            padding: 0;
            background: white;
        }
        
        .page-wrapper {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            position: relative;
        }
        
        .background-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: center;
            z-index: 0;
            opacity: 1;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
        }
        
        .content-overlay {
            padding: 12mm 20mm;
            min-height: 297mm;
            position: relative;
            z-index: 1;
        }
        
        .print-container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        .print-header {
            background: transparent;
            color: #1565c0;
            padding: 8px 15px;
            text-align: center;
            margin-bottom: 12px;
            border-radius: 10px;
        }
        
        .print-header h1 {
            font-size: 28px;
            margin-bottom: 5px;
            font-weight: bold;
            color: #1565c0;
        }
        
        .print-header p {
            font-size: 16px;
            color: #666;
        }
        
        .complaint-number {
            background: transparent;
            padding: 10px 15px;
            text-align: center;
            border: 2px solid #4a90e2;
            border-radius: 10px;
            margin-bottom: 12px;
        }
        
        .complaint-number-label {
            color: #4a90e2;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .complaint-number-value {
            color: #1565c0;
            font-size: 24px;
            font-weight: bold;
        }
        
        .section-title {
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            padding: 8px 15px;
            font-size: 18px;
            font-weight: bold;
            margin: 12px 0 10px 0;
            border-radius: 8px;
            text-align: center;
        }
        
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 12px;
        }
        
        .detail-item {
            padding: 10px 12px;
            background: transparent;
            border: 1px solid #4a90e2;
            border-radius: 6px;
            border-right: 3px solid #4a90e2;
        }
        
        .detail-label {
            color: #000;
            font-weight: 700;
            min-width: 100px;
            margin-left: 8px;
            font-size: 14px;
        }
        
        .detail-value {
            color: #000;
            font-size: 14px;
            font-weight: 600;
        }
        
        .content-section {
            margin-bottom: 12px;
        }
        
        .content-box {
            background: transparent;
            padding: 12px;
            border-radius: 8px;
            border: 2px solid #4a90e2;
            line-height: 1.6;
            color: #000;
            font-size: 14px;
            font-weight: 600;
        }
        
        .closure-box {
            background: transparent;
            padding: 12px;
            border-radius: 8px;
            border: 2px solid #4caf50;
            line-height: 1.6;
            color: #000;
            font-size: 14px;
            font-weight: 600;
        }
        
        .print-footer {
            background: transparent;
            padding: 12px;
            border-top: 2px solid #4a90e2;
            text-align: center;
            font-size: 12px;
            color: #000;
            font-weight: 600;
            margin-top: 15px;
            border-radius: 8px;
        }
        
        .signature-area {
            display: flex;
            justify-content: flex-end;
            padding-left: 20px;
            margin-bottom: 12px;
        }
        
        .signature-box {
            text-align: center;
            min-width: 150px;
        }
        
        .signature-line {
            border-bottom: 2px dotted #999;
            width: 100%;
            padding-bottom: 2px;
            margin-top: 5px;
        }
        
        @media print {
            body {
                padding: 0;
                margin: 0;
            }
            
            .page-wrapper {
                margin: 0;
                width: 100%;
            }
            
            .background-image {
                display: block !important;
                opacity: 1 !important;
                print-color-adjust: exact !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            * {
                print-color-adjust: exact !important;
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            @page {
                margin: 0;
                size: A4;
            }
        }
    </style>
</head>
<body>
    <div class="page-wrapper">
        <img src="${backgroundImage}" class="background-image" alt="Background" onerror="this.style.display='none'">
        <div class="content-overlay">
            <div class="print-container">
                <div class="print-header">
                    <h1>🏢 التعمير لإدارة المرافق</h1>
                    <p>منظومة الشكاوى والمتابعة الإلكترونية</p>
                </div>
                
                <div class="complaint-number">
                    <div class="complaint-number-label">الرقم المرجعي:</div>
                    <div class="complaint-number-value">${complaintNumber}</div>
                </div>
                
                <div class="section-title">📋 بيانات الشكوى</div>
                
                <div class="details-grid">
                    <div class="detail-item">
                        <span class="detail-label">اسم العميل</span>
                        <span class="detail-value">${complaint.customerTitle && complaint.customerTitle !== '-' ? complaint.customerTitle + ' ' + complaint.customerName : complaint.customerName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">رقم التليفون</span>
                        <span class="detail-value">${complaint.phoneNumber}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">رقم العمارة</span>
                        <span class="detail-value">${complaint.buildingNumber}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">المنطقة</span>
                        <span class="detail-value">${complaint.area}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">المدينة</span>
                        <span class="detail-value">${complaint.city || 'بدر'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">الحي</span>
                        <span class="detail-value">${complaint.district || 'الحجس'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">اسم المشرف</span>
                        <span class="detail-value">${supervisorName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">نوع الشكوى</span>
                        <span class="detail-value">${complaint.complaintType}</span>
                    </div>
                </div>
                
                <div class="content-section">
                    <div class="section-title">حالة الشكوى</div>
                    <div class="content-box">${statusText}</div>
                </div>
                
                <div class="content-section">
                    <div class="section-title">محتوى الشكوى</div>
                    <div class="content-box">${complaint.complaintContent}</div>
                </div>
                
                ${complaint.notes ? `
                <div class="content-section">
                    <div class="section-title">ملاحظات</div>
                    <div class="content-box">${complaint.notes}</div>
                </div>
                ` : ''}
                
                ${complaint.closureComment ? `
                <div class="content-section">
                    <div class="section-title" style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);">✅ تعليق الإغلاق</div>
                    <div class="closure-box">${complaint.closureComment}</div>
                    ${complaint.closureDate ? `<div style="padding: 10px 0; font-size: 0.9em; color: #666;">تاريخ الإغلاق: ${new Date(complaint.closureDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(complaint.closureDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>` : ''}
                </div>
                ` : ''}
                
                <div class="details-grid">
                    <div class="detail-item">
                        <span class="detail-label">تاريخ التقديم</span>
                        <span class="detail-value">${submitDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">آخر تحديث للحالة</span>
                        <span class="detail-value">${lastUpdate}</span>
                    </div>
                </div>
                
                <div class="print-footer">
                    <div class="signature-area">
                        <div class="signature-box">
                            <div style="margin-bottom: 5px;"><strong>يعتمد</strong></div>
                            <div class="signature-line">............................................</div>
                        </div>
                    </div>
                    <div style="margin-top: 20px; font-size: 13px;">
                        <strong>تم استلام الشكوى إلكترونياً – التعمير لإدارة المرافق © ${new Date().getFullYear()}</strong>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
    `);
    
    printWindow.document.close();
}

// Export complaint as image
// Export complaint as image
window.exportComplaintAsImage = async function(complaintId) {
    const complaint = complaintsData[complaintId];
    if (!complaint) return;

    // Get supervisor info with title
    const supervisor = complaint.supervisor && supervisorsData[complaint.supervisor] 
        ? supervisorsData[complaint.supervisor]
        : null;
    
    let supervisorName = 'غير محدد';
    if (supervisor) {
        supervisorName = supervisor.title && supervisor.title !== '-' 
            ? `${supervisor.title} ${supervisor.name}` 
            : supervisor.name;
    }
    
    const createdDate = new Date(complaint.createdAt);
    const lastUpdateDate = complaint.lastStatusUpdate ? new Date(complaint.lastStatusUpdate) : createdDate;
    
    // Format date and time in English with space between them
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    
    const datePart = createdDate.toLocaleDateString('en-US', dateOptions);
    const timePart = createdDate.toLocaleTimeString('en-US', timeOptions);
    const submitDate = `${datePart} ${timePart}`;
    
    const lastUpdateDatePart = lastUpdateDate.toLocaleDateString('en-US', dateOptions);
    const lastUpdateTimePart = lastUpdateDate.toLocaleTimeString('en-US', timeOptions);
    const lastUpdate = `${lastUpdateDatePart} ${lastUpdateTimePart}`;
    
    const complaintNumber = complaint.complaintId || 'غير محدد';
    
    let statusText = '';
    switch (complaint.status) {
        case 'pending':
            statusText = 'قيد الانتظار';
            break;
        case 'processing':
            statusText = 'قيد المعالجة';
            break;
        case 'resolved':
            statusText = 'تم الحل';
            break;
    }

    // Create temporary container
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '0';
    tempContainer.style.top = '0';
    tempContainer.style.width = '800px';
    tempContainer.style.background = 'white';
    tempContainer.style.zIndex = '-9999';
    tempContainer.style.opacity = '0';
    tempContainer.style.pointerEvents = 'none';
    
    tempContainer.innerHTML = `
        <div style="border: 2px solid #4a90e2; border-radius: 15px; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="background: #4a90e2; color: white; padding: 30px; text-align: center;">
                <h1 style="font-size: 28px; margin-bottom: 5px; font-weight: bold;">🏢 التعمير لإدارة المرافق</h1>
                <p style="font-size: 16px; opacity: 0.95;">منظومة الشكاوى والمتابعة الإلكترونية</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold;">رقم الشكوى: ${complaintNumber}</div>
            </div>
            
            <div style="background: #4a90e2; color: white; padding: 12px 20px; font-size: 18px; font-weight: bold; text-align: center;">
                📋 بيانات الشكوى
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: white;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">اسم العميل</span>
                    <span style="color: #333;">${complaint.customerTitle && complaint.customerTitle !== '-' ? complaint.customerTitle + ' ' + complaint.customerName : complaint.customerName}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">رقم التليفون</span>
                    <span style="color: #333;">${complaint.phoneNumber}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">رقم العمارة</span>
                    <span style="color: #333;">${complaint.buildingNumber}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">المنطقة</span>
                    <span style="color: #333;">${complaint.area}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">المدينة</span>
                    <span style="color: #333;">${complaint.city || 'بدر'}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">الحي</span>
                    <span style="color: #333;">${complaint.district || 'الحجس'}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">اسم المشرف</span>
                    <span style="color: #333;">${supervisorName}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">نوع الشكوى</span>
                    <span style="color: #333;">${complaint.complaintType}</span>
                </div>
            </div>
            
            <div style="height: 1px; background: #4a90e2;"></div>
            
            <div style="padding: 20px; background: white;">
                <div style="background: #4a90e2; color: white; padding: 12px 20px; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px; border-radius: 8px;">
                    حالة الشكوى
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-right: 4px solid #4a90e2; line-height: 1.8; color: #333;">
                    ${statusText}
                </div>
            </div>
            
            <div style="height: 1px; background: #4a90e2;"></div>
            
            <div style="padding: 20px; background: white;">
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 2px solid #ffc107; line-height: 1.8; color: #333;">
                    <strong style="color: #856404;">محتوى الشكوى:</strong><br>
                    ${complaint.complaintContent}
                </div>
            </div>
            
            ${complaint.notes ? `
            <div style="height: 1px; background: #4a90e2;"></div>
            <div style="padding: 20px; background: white;">
                <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; border: 2px solid #0c5460; line-height: 1.8; color: #333;">
                    <strong style="color: #0c5460;">ملاحظات:</strong><br>
                    ${complaint.notes}
                </div>
            </div>
            ` : ''}
            
            ${complaint.closureComment ? `
            <div style="height: 1px; background: #4a90e2;"></div>
            <div style="padding: 20px; background: white;">
                <div style="background: #4caf50; color: white; padding: 12px 20px; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px; border-radius: 8px;">
                    ✅ تعليق الإغلاق
                </div>
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-right: 4px solid #4caf50; line-height: 1.8; color: #333;">
                    ${complaint.closureComment}
                </div>
                ${complaint.closureDate ? `<div style="padding: 10px 20px; font-size: 0.9em; color: #666;">تاريخ الإغلاق: ${new Date(complaint.closureDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(complaint.closureDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>` : ''}
            </div>
            ` : ''}
            
            <div style="height: 1px; background: #4a90e2;"></div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: white;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">تاريخ التقديم</span>
                    <span style="color: #333;">${submitDate}</span>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                    <span style="color: #555; font-weight: 600; margin-left: 10px;">آخر تحديث للحالة</span>
                    <span style="color: #333;">${lastUpdate}</span>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-top: 2px solid #4a90e2; text-align: center; font-size: 14px; color: #666;">
                <div style="display: flex; justify-content: flex-start; padding-right: 50%; margin-bottom: 20px; transform: translateX(-100px);">
                    <div style="text-align: center; min-width: 200px;">
                        <div style="margin-bottom: 5px;"><strong>يعتمد</strong></div>
                        <div style="border-bottom: 2px dotted #333; width: 200px;"></div>
                    </div>
                </div>
                <div style="margin-top: 30px; font-size: 13px;">
                    <strong>تم استلام الشكوى إلكترونياً – التعمير لإدارة المرافق © ${new Date().getFullYear()}</strong>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(tempContainer);
    
    // Wait a moment for rendering
    setTimeout(async () => {
        try {
            if (typeof html2canvas === 'undefined') {
                alert('جاري تحميل المكتبة... الرجاء المحاولة مرة أخرى');
                document.body.removeChild(tempContainer);
                return;
            }
            
            // Convert to canvas
            const canvas = await html2canvas(tempContainer.firstElementChild, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
                foreignObjectRendering: false
            });
            
            // Convert to image and download
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `شكوى-${complaintNumber.replace('/', '-')}.png`;
                    link.href = url;
                    link.click();
                    
                    // Clean up the URL object after download
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                } else {
                    alert('حدث خطأ في إنشاء الصورة');
                }
            }, 'image/png', 1.0);
            
        } catch (error) {
            console.error('Error exporting image:', error);
            alert('حدث خطأ أثناء تصدير الصورة: ' + error.message);
        } finally {
            document.body.removeChild(tempContainer);
        }
    }, 100)
};

// Close modal
window.closeModal = function() {
    document.getElementById('detailsModal').style.display = 'none';
};

// Update complaint status
window.updateStatus = async function(complaintId, newStatus) {
    if (!newStatus) return;

    const complaint = complaintsData[complaintId];
    
    // If changing to resolved and no closure comment exists, ask for it
    if (newStatus === 'resolved' && !complaint.closureComment) {
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <h2 style="color: #667eea; margin-bottom: 20px;">إغلاق الشكوى</h2>
            <p style="margin-bottom: 15px; color: #555;">الرجاء إضافة تعليق الإغلاق:</p>
            <form id="closureForm">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">تعليق الإغلاق:</label>
                    <textarea id="closureComment" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; min-height: 100px;" placeholder="مثال: تم حل المشكلة بنجاح..."></textarea>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        ✅ إغلاق الشكوى
                    </button>
                    <button type="button" onclick="closeModal()" class="btn btn-secondary" style="flex: 1;">
                        إلغاء
                    </button>
                </div>
            </form>
        `;
        
        addTrackedListener(document.getElementById('closureForm'), 'submit', async (e) => {
            e.preventDefault();
            const closureComment = document.getElementById('closureComment').value.trim();
            
            if (closureComment) {
                try {
                    const complaintRef = ref(database, `complaints/${complaintId}`);
                    await update(complaintRef, { 
                        status: newStatus,
                        closureComment: closureComment,
                        closureDate: new Date().toISOString(),
                        lastStatusUpdate: new Date().toISOString()
                    });
                    
                    complaintsData[complaintId].status = newStatus;
                    complaintsData[complaintId].closureComment = closureComment;
                    complaintsData[complaintId].closureDate = new Date().toISOString();
                    complaintsData[complaintId].lastStatusUpdate = new Date().toISOString();
                    
                    const currentFilter = document.getElementById('filterStatus').value;
                    const searchTerm = document.getElementById('searchInput').value;
                    displayComplaints(complaintsData, currentFilter, searchTerm);
                    
                    closeModal();
                    alert('تم إغلاق الشكوى بنجاح');
                } catch (error) {
                    console.error('Error updating status:', error);
                    alert('حدث خطأ أثناء إغلاق الشكوى');
                }
            }
        });
        
        document.getElementById('detailsModal').style.display = 'block';
        return;
    }

    try {
        const complaintRef = ref(database, `complaints/${complaintId}`);
        await update(complaintRef, { 
            status: newStatus,
            lastStatusUpdate: new Date().toISOString()
        });
        
        complaintsData[complaintId].status = newStatus;
        complaintsData[complaintId].lastStatusUpdate = new Date().toISOString();
        const currentFilter = document.getElementById('filterStatus').value;
        const searchTerm = document.getElementById('searchInput').value;
        displayComplaints(complaintsData, currentFilter, searchTerm);
        
        alert('تم تحديث حالة الشكوى بنجاح');
    } catch (error) {
        console.error('Error updating status:', error);
        alert('حدث خطأ أثناء تحديث الحالة');
    }
};

// Edit complaint
window.editComplaint = function(complaintId) {
    const complaint = complaintsData[complaintId];
    if (!complaint) return;

    const supervisorName = supervisorsData[complaint.supervisor]?.name || 'غير محدد';
    
    // Build supervisors dropdown
    let supervisorsOptions = '<option value="">اختر المشرف</option>';
    for (const [id, supervisor] of Object.entries(supervisorsData)) {
        const selected = complaint.supervisor === id ? 'selected' : '';
        supervisorsOptions += `<option value="${id}" ${selected}>${supervisor.name}</option>`;
    }

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h2 style="color: #667eea; margin-bottom: 20px;">تعديل الشكوى</h2>
        <form id="editForm" style="line-height: 2;">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">اسم العميل:</label>
                <input type="text" id="editCustomerName" value="${complaint.customerName}" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">رقم الهاتف:</label>
                <input type="text" id="editPhoneNumber" value="${complaint.phoneNumber}" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">رقم العمارة:</label>
                <input type="text" id="editBuildingNumber" value="${complaint.buildingNumber}" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">المنطقة:</label>
                <input type="text" id="editArea" value="${complaint.area}" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">المدينة:</label>
                <input type="text" id="editCity" value="${complaint.city || ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">الحي:</label>
                <input type="text" id="editDistrict" value="${complaint.district || ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">المشرف:</label>
                <select id="editSupervisor" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    ${supervisorsOptions}
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">نوع الشكوى:</label>
                <input type="text" id="editComplaintType" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;" value="${complaint.complaintType}" placeholder="مثال: الصرف الصحي، الكهرباء، النظافة...">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">محتوى الشكوى:</label>
                <textarea id="editComplaintContent" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; min-height: 100px;">${complaint.complaintContent}</textarea>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">ملاحظات:</label>
                <textarea id="editNotes" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; min-height: 80px;">${complaint.notes || ''}</textarea>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">الحالة:</label>
                <select id="editStatus" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="pending" ${complaint.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                    <option value="processing" ${complaint.status === 'processing' ? 'selected' : ''}>قيد المعالجة</option>
                    <option value="resolved" ${complaint.status === 'resolved' ? 'selected' : ''}>تم الحل</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="submit" class="btn btn-primary" style="flex: 1;">
                    💾 حفظ التعديلات
                </button>
                <button type="button" onclick="closeModal()" class="btn btn-secondary" style="flex: 1;">
                    إلغاء
                </button>
            </div>
        </form>
    `;

    addTrackedListener(document.getElementById('editForm'), 'submit', async (e) => {
        e.preventDefault();
        await saveComplaintEdit(complaintId);
    });

    document.getElementById('detailsModal').style.display = 'block';
};

// Save complaint edit
async function saveComplaintEdit(complaintId) {
    try {
        const updatedData = {
            customerName: document.getElementById('editCustomerName').value.trim(),
            phoneNumber: document.getElementById('editPhoneNumber').value.trim(),
            buildingNumber: document.getElementById('editBuildingNumber').value.trim(),
            area: document.getElementById('editArea').value.trim(),
            city: document.getElementById('editCity').value.trim(),
            district: document.getElementById('editDistrict').value.trim(),
            supervisor: document.getElementById('editSupervisor').value,
            complaintType: document.getElementById('editComplaintType').value,
            complaintContent: document.getElementById('editComplaintContent').value.trim(),
            notes: document.getElementById('editNotes').value.trim(),
            status: document.getElementById('editStatus').value
        };

        const complaintRef = ref(database, `complaints/${complaintId}`);
        await update(complaintRef, updatedData);
        
        // Update local data
        Object.assign(complaintsData[complaintId], updatedData);
        
        const currentFilter = document.getElementById('filterStatus').value;
        const searchTerm = document.getElementById('searchInput').value;
        displayComplaints(complaintsData, currentFilter, searchTerm);
        
        closeModal();
        alert('تم تحديث الشكوى بنجاح');
    } catch (error) {
        console.error('Error updating complaint:', error);
        alert('حدث خطأ أثناء تحديث الشكوى');
    }
}

// Delete complaint
window.deleteComplaint = async function(complaintId) {
    if (!confirm('هل أنت متأكد من حذف هذه الشكوى؟')) return;

    try {
        const complaintRef = ref(database, `complaints/${complaintId}`);
        await remove(complaintRef);
        
        delete complaintsData[complaintId];
        const currentFilter = document.getElementById('filterStatus').value;
        const searchTerm = document.getElementById('searchInput').value;
        displayComplaints(complaintsData, currentFilter, searchTerm);
        
        alert('تم حذف الشكوى بنجاح');
    } catch (error) {
        console.error('Error deleting complaint:', error);
        alert('حدث خطأ أثناء حذف الشكوى');
    }
};

// Filter by status
addTrackedListener(document.getElementById('filterStatus'), 'change', (e) => {
    const searchTerm = document.getElementById('searchInput').value;
    displayComplaints(complaintsData, e.target.value, searchTerm);
});

// Search functionality
addTrackedListener(document.getElementById('searchInput'), 'input', (e) => {
    const filter = document.getElementById('filterStatus').value;
    displayComplaints(complaintsData, filter, e.target.value);
});

// Close modal on outside click
addTrackedListener(document.getElementById('detailsModal'), 'click', (e) => {
    if (e.target.id === 'detailsModal') {
        closeModal();
    }
});

// Upload documents for complaint
window.uploadDocumentsForComplaint = function(complaintId) {
    // Store the complaint ID in sessionStorage
    sessionStorage.setItem('selectedComplaintId', complaintId);
    // Navigate to documents page
    window.location.href = 'documents.html';
};

// Send complaint to WhatsApp Desktop as image
window.sendToWhatsApp = async function(complaintId) {
    const complaint = complaintsData[complaintId];
    if (!complaint) return;

    // Get supervisor and manager info
    const supervisor = complaint.supervisor && supervisorsData[complaint.supervisor] 
        ? supervisorsData[complaint.supervisor]
        : null;
    
    // Check if there's a manager field and managersData exists
    const manager = complaint.manager && typeof managersData !== 'undefined' && managersData && managersData[complaint.manager]
        ? managersData[complaint.manager]
        : null;

    // Get supervisor name with title
    let supervisorName = 'غير محدد';
    if (supervisor) {
        supervisorName = supervisor.title && supervisor.title !== '-' 
            ? `${supervisor.title} ${supervisor.name}` 
            : supervisor.name;
    }
    
    const createdDate = new Date(complaint.createdAt);
    const lastUpdateDate = complaint.lastStatusUpdate ? new Date(complaint.lastStatusUpdate) : createdDate;
    
    // Format date and time in English with space between them
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    
    const datePart = createdDate.toLocaleDateString('en-US', dateOptions);
    const timePart = createdDate.toLocaleTimeString('en-US', timeOptions);
    const submitDate = `${datePart} ${timePart}`;
    
    const lastUpdateDatePart = lastUpdateDate.toLocaleDateString('en-US', dateOptions);
    const lastUpdateTimePart = lastUpdateDate.toLocaleTimeString('en-US', timeOptions);
    const lastUpdate = `${lastUpdateDatePart} ${lastUpdateTimePart}`;
    
    const complaintNumber = complaint.complaintId || 'غير محدد';
    
    let statusText = '';
    switch (complaint.status) {
        case 'pending':
            statusText = 'قيد الانتظار';
            break;
        case 'processing':
            statusText = 'قيد المعالجة';
            break;
        case 'resolved':
            statusText = 'تم الحل';
            break;
    }

    try {
        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px 40px; border-radius: 15px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
        loadingMsg.innerHTML = '<div style="font-size: 20px; color: #4a90e2; margin-bottom: 10px; font-weight: 600;">⏳ جاري تجهيز الصورة...</div><div style="font-size: 14px; color: #666;">يرجى الانتظار</div>';
        document.body.appendChild(loadingMsg);

        // Create temporary container with same design as export
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '0';
        tempContainer.style.top = '0';
        tempContainer.style.width = '800px';
        tempContainer.style.background = 'white';
        tempContainer.style.zIndex = '-9999';
        tempContainer.style.opacity = '0';
        tempContainer.style.pointerEvents = 'none';
        
        tempContainer.innerHTML = `
            <div style="border: 2px solid #4a90e2; border-radius: 15px; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="background: #4a90e2; color: white; padding: 30px; text-align: center;">
                    <h1 style="font-size: 28px; margin-bottom: 5px; font-weight: bold;">🏢 التعمير لإدارة المرافق</h1>
                    <p style="font-size: 16px; opacity: 0.95;">منظومة الشكاوى والمتابعة الإلكترونية</p>
                </div>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold;">رقم الشكوى: ${complaintNumber}</div>
                </div>
                
                <div style="background: #4a90e2; color: white; padding: 12px 20px; font-size: 18px; font-weight: bold; text-align: center;">
                    📋 بيانات الشكوى
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: white;">
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">اسم العميل</span>
                        <span style="color: #333;">${complaint.customerTitle && complaint.customerTitle !== '-' ? complaint.customerTitle + ' ' + complaint.customerName : complaint.customerName}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">رقم التليفون</span>
                        <span style="color: #333;">${complaint.phoneNumber}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">رقم العمارة</span>
                        <span style="color: #333;">${complaint.buildingNumber}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">المنطقة</span>
                        <span style="color: #333;">${complaint.area}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">المدينة</span>
                        <span style="color: #333;">${complaint.city || 'بدر'}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">الحي</span>
                        <span style="color: #333;">${complaint.district || 'الحجس'}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">اسم المشرف</span>
                        <span style="color: #333;">${supervisorName}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">نوع الشكوى</span>
                        <span style="color: #333;">${complaint.complaintType}</span>
                    </div>
                </div>
                
                <div style="height: 1px; background: #4a90e2;"></div>
                
                <div style="padding: 20px; background: white;">
                    <div style="background: #4a90e2; color: white; padding: 12px 20px; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px; border-radius: 8px;">
                        حالة الشكوى
                    </div>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-right: 4px solid #4a90e2; line-height: 1.8; color: #333;">
                        ${statusText}
                    </div>
                </div>
                
                <div style="height: 1px; background: #4a90e2;"></div>
                
                <div style="padding: 20px; background: white;">
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 2px solid #ffc107; line-height: 1.8; color: #333;">
                        <strong style="color: #856404;">محتوى الشكوى:</strong><br>
                        ${complaint.complaintContent}
                    </div>
                </div>
                
                ${complaint.notes ? `
                <div style="height: 1px; background: #4a90e2;"></div>
                <div style="padding: 20px; background: white;">
                    <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; border: 2px solid #0c5460; line-height: 1.8; color: #333;">
                        <strong style="color: #0c5460;">ملاحظات:</strong><br>
                        ${complaint.notes}
                    </div>
                </div>
                ` : ''}
                
                ${complaint.closureComment ? `
                <div style="height: 1px; background: #4a90e2;"></div>
                <div style="padding: 20px; background: white;">
                    <div style="background: #4caf50; color: white; padding: 12px 20px; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px; border-radius: 8px;">
                        ✅ تعليق الإغلاق
                    </div>
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-right: 4px solid #4caf50; line-height: 1.8; color: #333;">
                        ${complaint.closureComment}
                    </div>
                    ${complaint.closureDate ? `<div style="padding: 10px 20px; font-size: 0.9em; color: #666;">تاريخ الإغلاق: ${new Date(complaint.closureDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(complaint.closureDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>` : ''}
                </div>
                ` : ''}
                
                <div style="height: 1px; background: #4a90e2;"></div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: white;">
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">تاريخ التقديم</span>
                        <span style="color: #333;">${submitDate}</span>
                    </div>
                    <div style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: white;">
                        <span style="color: #555; font-weight: 600; margin-left: 10px;">آخر تحديث للحالة</span>
                        <span style="color: #333;">${lastUpdate}</span>
                    </div>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-top: 2px solid #4a90e2; text-align: center; font-size: 14px; color: #666;">
                    <div style="display: flex; justify-content: flex-start; padding-right: 50%; margin-bottom: 20px; transform: translateX(-100px);">
                        <div style="text-align: center; min-width: 200px;">
                            <div style="margin-bottom: 5px;"><strong>يعتمد</strong></div>
                            <div style="border-bottom: 2px dotted #333; width: 200px;"></div>
                        </div>
                    </div>
                    <div style="margin-top: 30px; font-size: 13px;">
                        <strong>تم استلام الشكوى إلكترونياً – التعمير لإدارة المرافق © ${new Date().getFullYear()}</strong>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(tempContainer);

        // Wait a moment for rendering then convert to canvas
        setTimeout(async () => {
            try {
                if (typeof html2canvas === 'undefined') {
                    alert('جاري تحميل المكتبة... الرجاء المحاولة مرة أخرى');
                    document.body.removeChild(tempContainer);
                    document.body.removeChild(loadingMsg);
                    return;
                }

                const canvas = await html2canvas(tempContainer.firstElementChild, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    foreignObjectRendering: false
                });

                // Remove temp container
                document.body.removeChild(tempContainer);

                // Convert canvas to blob
                canvas.toBlob(async (blob) => {
                    try {
                        // Use Electron's clipboard API
                        const { clipboard, nativeImage, shell } = require('electron');
                        
                        // Convert blob to buffer
                        const arrayBuffer = await blob.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        
                        // Create native image from buffer
                        const image = nativeImage.createFromBuffer(buffer);
                        
                        // Write image to clipboard
                        clipboard.writeImage(image);

                        document.body.removeChild(loadingMsg);

                        // Get phone number from supervisor or manager
                        let phoneNumber = '';
                        let personName = '';
                        let personType = '';

                        // Try supervisor first
                        if (supervisor && supervisor.phone && supervisor.phone !== 'غير متوفر' && supervisor.phone !== '-') {
                            phoneNumber = supervisor.phone;
                            personName = supervisor.name;
                            personType = 'المشرف';
                        } 
                        // Try manager if supervisor has no phone
                        else if (manager && manager.phone && manager.phone !== 'غير متوفر' && manager.phone !== '-') {
                            phoneNumber = manager.phone;
                            personName = manager.name;
                            personType = 'المدير';
                        }

                        if (phoneNumber) {
                            // Clean phone number
                            phoneNumber = phoneNumber.replace(/\D/g, '');
                            // Add Egypt country code if not present
                            if (!phoneNumber.startsWith('20')) {
                                if (phoneNumber.startsWith('0')) {
                                    phoneNumber = '20' + phoneNumber.substring(1);
                                } else {
                                    phoneNumber = '20' + phoneNumber;
                                }
                            }

                            // Try to open WhatsApp Desktop application
                            const whatsappDesktopUrl = `whatsapp://send?phone=${phoneNumber}`;
                            
                            try {
                                await shell.openExternal(whatsappDesktopUrl);
                                
                                // Show success message with instructions
                                setTimeout(() => {
                                    alert(`✅ تم نسخ الصورة بنجاح!\n\n📱 تم فتح واتساب ${personType}: ${personName}\n\n📋 اضغط Ctrl+V للصق الصورة في واتساب وإرسالها`);
                                }, 1000);
                            } catch (err) {
                                console.error('Error opening WhatsApp Desktop:', err);
                                // Fallback to web
                                window.open(`https://web.whatsapp.com/send?phone=${phoneNumber}`, '_blank');
                                alert(`✅ تم نسخ الصورة بنجاح!\n\n📱 تم فتح واتساب ويب ${personType}: ${personName}\n\n📋 اضغط Ctrl+V للصق الصورة في واتساب وإرسالها`);
                            }
                        } else {
                            // No phone number available
                            alert(`✅ تم نسخ الصورة بنجاح!\n\n⚠️ لا يوجد رقم هاتف للمشرف أو المدير\n\n📋 افتح واتساب واضغط Ctrl+V للصق الصورة في أي محادثة`);
                        }

                    } catch (error) {
                        console.error('Error copying to clipboard:', error);
                        document.body.removeChild(loadingMsg);
                        
                        // Fallback: Download the image
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `شكوى_${complaintNumber.replace('/', '_')}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        alert('⚠️ تعذر نسخ الصورة تلقائياً\n\n✅ تم تنزيل الصورة بدلاً من ذلك\n\nيمكنك إرسالها عبر واتساب يدوياً');
                    }
                }, 'image/png');

            } catch (error) {
                console.error('Error creating canvas:', error);
                document.body.removeChild(tempContainer);
                document.body.removeChild(loadingMsg);
                alert('حدث خطأ أثناء تجهيز الصورة');
            }
        }, 100);

    } catch (error) {
        console.error('Error:', error);
        alert('حدث خطأ أثناء تجهيز الصورة');
    }
};
