import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, get, set, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { addTrackedListener } from './cleanup.js';

console.log('📄 documents.js loaded successfully');

// Wait for firebaseConfig to be loaded
if (!window.firebaseConfig) {
    console.error('❌ Firebase config not loaded!');
    alert('خطأ في تحميل إعدادات Firebase');
} else {
    console.log('✅ Firebase config loaded');
}

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
console.log('✅ Firebase initialized');

// LocalStorage key for documents
const STORAGE_KEY = 'complaints_documents';
const COMPLAINTS_CACHE_KEY = 'complaints_cache';
const SUPERVISORS_CACHE_KEY = 'supervisors_cache';

let complaintsData = {};
let supervisorsData = {};

// تحميل البيانات من cache فوراً
function loadFromCache() {
    try {
        const complaintsCache = localStorage.getItem(COMPLAINTS_CACHE_KEY);
        const supervisorsCache = localStorage.getItem(SUPERVISORS_CACHE_KEY);
        
        if (complaintsCache) {
            complaintsData = JSON.parse(complaintsCache);
            console.log('📦 Loaded complaints from cache:', Object.keys(complaintsData).length);
        }
        
        if (supervisorsCache) {
            supervisorsData = JSON.parse(supervisorsCache);
            console.log('📦 Loaded supervisors from cache:', Object.keys(supervisorsData).length);
        }
        
        // Populate immediately with cached data
        if (Object.keys(complaintsData).length > 0) {
            populateComplaintSelect();
        }
    } catch (error) {
        console.error('Error loading cache:', error);
    }
}

// Check authentication
onAuthStateChanged(auth, (user) => {
    console.log('🔐 Auth state changed:', user ? user.email : 'No user');
    if (!user) {
        window.location.href = '../index.html';
    } else {
        console.log('👤 User authenticated, loading data...');
        // Load from cache first for instant display
        loadFromCache();
        // Then load from Firebase for fresh data
        loadComplaints();
        // syncDocumentsWithFirebase will handle both loading and syncing
        syncDocumentsWithFirebase();
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

// Load complaints from Firebase with real-time updates
function loadComplaints() {
    try {
        // Load supervisors with real-time listener
        const supervisorsRef = ref(database, 'supervisors');
        onValue(supervisorsRef, (snapshot) => {
            if (snapshot.exists()) {
                supervisorsData = snapshot.val();
                // Save to cache
                localStorage.setItem(SUPERVISORS_CACHE_KEY, JSON.stringify(supervisorsData));
                console.log('🔄 Updated supervisors from Firebase:', Object.keys(supervisorsData).length);
            }
        });
        
        // Load complaints with real-time listener
        const complaintsRef = ref(database, 'complaints');
        onValue(complaintsRef, (snapshot) => {
            if (snapshot.exists()) {
                complaintsData = snapshot.val() || {};
                // Save to cache
                localStorage.setItem(COMPLAINTS_CACHE_KEY, JSON.stringify(complaintsData));
                console.log('🔄 Updated complaints from Firebase:', Object.keys(complaintsData).length);
            } else {
                complaintsData = {};
                console.log('No complaints found in Firebase');
            }
            
            // Update dropdown with fresh data
            populateComplaintSelect();
        });
    } catch (error) {
        console.error('Error loading complaints:', error);
        complaintsData = {};
        populateComplaintSelect();
    }
}

// Populate complaint select dropdown
function populateComplaintSelect() {
    const select = document.getElementById('complaintRef');
    
    if (!select) {
        console.error('Complaint select element not found');
        return;
    }
    
    // عرض رسالة تحميل
    select.innerHTML = '<option value="">جاري التحميل...</option>';
    select.disabled = true;
    
    // استخدام setTimeout لجعل الواجهة responsive
    setTimeout(() => {
        // Check if complaintsData is valid
        if (!complaintsData || typeof complaintsData !== 'object' || Object.keys(complaintsData).length === 0) {
            select.innerHTML = '<option value="">لا توجد شكاوى</option>';
            select.disabled = false;
            console.log('⚠️ No complaints available');
            return;
        }
        
        console.log('📋 Populating complaints select with', Object.keys(complaintsData).length, 'complaints');
        
        select.innerHTML = '<option value="">لا يوجد - اختر شكوى</option>';
    
    const complaintsArray = Object.entries(complaintsData).map(([id, data]) => ({
        id,
        ...data
    }));
    
    // Sort by complaint number (oldest to newest)
    complaintsArray.sort((a, b) => {
        const getYearAndNum = (complaint) => {
            if (complaint.complaintId) {
                const parts = complaint.complaintId.split('/');
                return {
                    year: parseInt(parts[0]) || 0,
                    num: parseInt(parts[1]) || 0
                };
            }
            return { year: 0, num: 0 };
        };
        
        const dataA = getYearAndNum(a);
        const dataB = getYearAndNum(b);
        
        // Normal order: oldest year first, then oldest number first
        if (dataA.year !== dataB.year) {
            return dataA.year - dataB.year;
        }
        return dataA.num - dataB.num;
    });
    
    // Add complaint number prefix to each option
    let counter = 1;
    complaintsArray.forEach(complaint => {
        const option = document.createElement('option');
        option.value = complaint.id;
        option.textContent = `${counter}. ${complaint.complaintId || 'بدون رقم'} - ${complaint.customerName} - ${complaint.complaintType}`;
        select.appendChild(option);
        counter++;
    });
    
    // إعادة تفعيل القائمة بعد التحميل
    select.disabled = false;
    
    // Check if there's a selected complaint from sessionStorage
    const selectedComplaintId = sessionStorage.getItem('selectedComplaintId');
    if (selectedComplaintId) {
        select.value = selectedComplaintId;
        // Clear the sessionStorage after using it
        sessionStorage.removeItem('selectedComplaintId');
        // Highlight the upload area
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.style.borderColor = '#28a745';
        uploadArea.style.background = '#e8f5e9';
        setTimeout(() => {
            uploadArea.style.borderColor = '#667eea';
            uploadArea.style.background = '#f8f9ff';
        }, 2000);
    }
    }, 100); // تأخير 100ms فقط لجعل الواجهة responsive
}

// Get documents from localStorage
function getDocuments() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        // التأكد من أن النتيجة array
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error parsing documents:', error);
        return [];
    }
}

// Save documents to localStorage and Firebase
async function saveDocuments(documents) {
    // تأكد أن documents هو array
    if (!Array.isArray(documents)) {
        console.error('❌ saveDocuments: documents is not an array!', documents);
        return;
    }
    
    // تنظيف array - إزالة null وundefined
    documents = documents.filter(doc => doc && doc.id);
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    console.log('💾 Saved to localStorage:', documents.length, 'documents');
    
    // Save to Firebase as object with IDs as keys to prevent array issues
    try {
        const documentsRef = ref(database, 'documents');
        
        // Convert array to object with IDs as keys
        const documentsObject = {};
        documents.forEach(doc => {
            if (doc && doc.id) {
                documentsObject[doc.id] = doc;
            }
        });
        
        await set(documentsRef, documentsObject);
        console.log('☁️ Synced to Firebase:', Object.keys(documentsObject).length, 'documents');
    } catch (error) {
        console.error('❌ Error syncing to Firebase:', error);
    }
}

// Sync documents with Firebase (real-time)
function syncDocumentsWithFirebase() {
    console.log('🔄 Starting syncDocumentsWithFirebase...');
    const documentsRef = ref(database, 'documents');
    console.log('📍 Documents ref created');
    
    // First, load existing documents from Firebase
    console.log('📥 Fetching documents from Firebase...');
    get(documentsRef).then((snapshot) => {
        console.log('📦 Firebase snapshot received, exists:', snapshot.exists());
        if (snapshot.exists()) {
            let firebaseDocuments = snapshot.val();
            
            console.log('🔍 Raw Firebase data type:', typeof firebaseDocuments);
            console.log('🔍 Raw Firebase data:', firebaseDocuments);
            
            if (Array.isArray(firebaseDocuments)) {
                console.log('✅ Data is array with length:', firebaseDocuments.length);
            } else if (typeof firebaseDocuments === 'object') {
                console.log('⚠️ Data is object with keys:', Object.keys(firebaseDocuments));
                console.log('⚠️ Object values count:', Object.values(firebaseDocuments).length);
            }
            
            // Convert to array if it's an object
            if (!Array.isArray(firebaseDocuments)) {
                if (typeof firebaseDocuments === 'object' && firebaseDocuments !== null) {
                    // Convert object to array
                    firebaseDocuments = Object.values(firebaseDocuments);
                    console.log('🔄 Converted object to array:', firebaseDocuments.length, 'items');
                } else {
                    firebaseDocuments = [];
                    console.log('❌ Invalid data type, initializing empty array');
                }
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseDocuments));
            // ✅ عرض رسالة "اختر شكوى" بدلاً من عرض جميع الصور
            displayDocumentsForComplaint(null);
            console.log('✅ Initial documents loaded from Firebase:', firebaseDocuments.length);
        } else {
            console.log('⚠️ No documents in Firebase, initializing empty');
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
            displayDocumentsForComplaint(null);
        }
    }).catch((error) => {
        console.error('❌ Error loading initial documents:', error);
        displayDocumentsForComplaint(null);
    });
    
    // Then listen for real-time changes
    console.log('👂 Setting up real-time listener...');
    onValue(documentsRef, (snapshot) => {
        console.log('🔔 Real-time update received');
        if (snapshot.exists()) {
            let firebaseDocuments = snapshot.val();
            
            // Convert to array if it's an object
            if (!Array.isArray(firebaseDocuments)) {
                if (typeof firebaseDocuments === 'object' && firebaseDocuments !== null) {
                    firebaseDocuments = Object.values(firebaseDocuments);
                } else {
                    firebaseDocuments = [];
                }
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseDocuments));
            // ✅ إعادة عرض الصور للشكوى المختارة حالياً (إن وجدت)
            const selectedComplaintId = document.getElementById('complaintRef')?.value;
            displayDocumentsForComplaint(selectedComplaintId || null);
            console.log('🔄 Documents synced from Firebase:', firebaseDocuments.length);
        }
    }, (error) => {
        console.error('❌ Error syncing from Firebase:', error);
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Get file icon based on type
function getFileIcon(type) {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    return '📎';
}

// Get file category
function getFileCategory(type) {
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('word')) return 'word';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'excel';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'powerpoint';
    return 'other';
}

// Update statistics
function updateStats(complaintId = null) {
    let documents = getDocuments();
    
    // التأكد من أن documents هو array
    if (!Array.isArray(documents)) {
        if (documents && typeof documents === 'object') {
            documents = Object.values(documents);
        } else {
            documents = [];
        }
    }
    
    // ✅ فلترة حسب الشكوى المختارة فقط
    if (complaintId) {
        const complaint = complaintsData[complaintId];
        const complaintRefNumber = complaint?.complaintId || '';
        documents = documents.filter(doc => doc.complaintId === complaintId || doc.complaintRef === complaintRefNumber);
    }
    
    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
    const beforeCount = documents.filter(doc => doc.documentType === 'before').length;
    const afterCount = documents.filter(doc => doc.documentType === 'after').length;
    const imageCount = documents.filter(doc => doc.category === 'image' && doc.documentType === 'document').length;
    const docCount = documents.filter(doc => doc.category !== 'image' || doc.documentType === 'document').length;

    document.getElementById('totalFiles').textContent = documents.length;
    document.getElementById('totalSize').textContent = formatFileSize(totalSize);
    document.getElementById('beforeCount').textContent = beforeCount;
    document.getElementById('afterCount').textContent = afterCount;
    document.getElementById('imageCount').textContent = imageCount;
    document.getElementById('docCount').textContent = docCount;
}

// Display documents for specific complaint
function displayDocumentsForComplaint(complaintId, filter = 'all', searchTerm = '') {
    const documentsGrid = document.getElementById('documentsGrid');
    
    if (!documentsGrid) {
        console.error('❌ documentsGrid element not found!');
        return;
    }
    
    let documents = getDocuments();
    
    // التأكد من أن documents هو array
    if (!Array.isArray(documents)) {
        if (documents && typeof documents === 'object') {
            documents = Object.values(documents);
        } else {
            documents = [];
        }
    }
    
    // ✅ إذا لم يتم اختيار شكوى، لا تعرض أي صور
    if (!complaintId) {
        documentsGrid.innerHTML = `
            <div class="no-documents">
                <div class="no-documents-icon">📋</div>
                <h3>اختر شكوى لعرض الصور المرتبطة</h3>
                <p>قم باختيار شكوى من القائمة أعلاه</p>
            </div>
        `;
        // ✅ عرض إحصائيات فارغة
        updateStats(null);
        return;
    }
    
    // ✅ فلترة الصور حسب الشكوى المختارة
    const complaint = complaintsData[complaintId];
    const complaintRefNumber = complaint?.complaintId || '';
    
    documents = documents.filter(doc => doc.complaintId === complaintId || doc.complaintRef === complaintRefNumber);
    
    // ✅ تطبيق الفلتر (الكل، صور قبل، صور بعد)
    if (filter === 'before') {
        documents = documents.filter(doc => doc.documentType === 'before');
    } else if (filter === 'after') {
        documents = documents.filter(doc => doc.documentType === 'after');
    }
    // 'all' لا يحتاج فلتر إضافي
    
    // ✅ تطبيق البحث
    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        documents = documents.filter(doc => 
            doc.name.toLowerCase().includes(search)
        );
    }
    
    if (documents.length === 0) {
        const filterText = filter === 'before' ? ' (صور قبل)' : filter === 'after' ? ' (صور بعد)' : '';
        documentsGrid.innerHTML = `
            <div class="no-documents">
                <div class="no-documents-icon">📭</div>
                <h3>لا توجد صور${filterText}${searchTerm ? ' مطابقة للبحث' : ''}</h3>
                <p>${searchTerm ? 'جرب كلمات بحث أخرى' : 'قم برفع صور للشكوى: ' + complaintRefNumber}</p>
            </div>
        `;
        // ✅ عرض إحصائيات الشكوى المختارة فقط
        updateStats(complaintId);
        return;
    }
    
    // عرض الصور
    documentsGrid.innerHTML = documents.map(doc => {
        let typeBadge = '';
        
        if (doc.documentType === 'before') {
            typeBadge = '<div style="background: #ff9800; color: white; padding: 5px 10px; border-radius: 5px; margin: 10px 0; font-size: 0.85em; font-weight: bold;">📷 صور قبل</div>';
        } else if (doc.documentType === 'after') {
            typeBadge = '<div style="background: #4caf50; color: white; padding: 5px 10px; border-radius: 5px; margin: 10px 0; font-size: 0.85em; font-weight: bold;">✅ صور بعد</div>';
        }
        
        return `
        <div class="document-card" data-id="${doc.id}">
            <div class="document-icon">${doc.icon}</div>
            <div class="document-name">${doc.name}</div>
            ${typeBadge}
            <div style="background: #e3f2fd; color: #1565c0; padding: 5px 10px; border-radius: 5px; margin: 5px 0; font-size: 0.85em; font-weight: bold;">🔗 ${complaintRefNumber}</div>
            <div class="document-size">${formatFileSize(doc.size)}</div>
            <div class="document-date">${new Date(doc.uploadDate).toLocaleDateString('ar-EG')}</div>
            <div class="document-actions">
                <button class="btn btn-primary" onclick="viewDocument('${doc.id}')">عرض</button>
                <button class="btn btn-secondary" onclick="downloadDocument('${doc.id}')" style="background: #28a745;">تحميل</button>
                <button class="btn btn-secondary" onclick="deleteDocument('${doc.id}')" style="background: #dc3545;">حذف</button>
            </div>
        </div>
    `;
    }).join('');
    
    updateStats(complaintId);
}

// Display documents
function displayDocuments(filter = 'all', searchTerm = '') {
    console.log('🎨 displayDocuments called, filter:', filter, 'search:', searchTerm);
    const documentsGrid = document.getElementById('documentsGrid');
    
    if (!documentsGrid) {
        console.error('❌ documentsGrid element not found!');
        return;
    }
    
    let documents = getDocuments();
    console.log('📊 Raw documents from getDocuments:', documents);
    
    // التأكد من أن documents هو array
    if (!Array.isArray(documents)) {
        if (documents && typeof documents === 'object') {
            // تحويل object إلى array
            documents = Object.values(documents);
            console.log('🔄 Converted to array:', documents.length);
        } else {
            documents = [];
            console.log('⚠️ No valid documents, initialized empty array');
        }
    }
    
    console.log('📋 Total documents before filter:', documents.length);
    console.log('📋 Total documents before filter:', documents.length);

    // Apply filter
    if (filter === 'linked') {
        documents = documents.filter(doc => doc.complaintId);
    } else if (filter === 'unlinked') {
        documents = documents.filter(doc => !doc.complaintId);
    } else if (filter === 'before') {
        documents = documents.filter(doc => doc.documentType === 'before');
    } else if (filter === 'after') {
        documents = documents.filter(doc => doc.documentType === 'after');
    } else if (filter === 'document') {
        documents = documents.filter(doc => doc.documentType === 'document');
    } else if (filter !== 'all') {
        documents = documents.filter(doc => doc.category === filter);
    }

    console.log('📋 Documents after filter:', documents.length);

    // Apply search
    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        documents = documents.filter(doc => 
            doc.name.toLowerCase().includes(search) ||
            (doc.complaintRef && doc.complaintRef.toLowerCase().includes(search))
        );
        console.log('🔍 Documents after search:', documents.length);
    }

    if (documents.length === 0) {
        console.log('📭 No documents to display');
        documentsGrid.innerHTML = `
            <div class="no-documents">
                <div class="no-documents-icon">📭</div>
                <h3>لا توجد مستندات</h3>
                <p>${searchTerm ? 'لم يتم العثور على نتائج' : 'قم برفع ملفات لتبدأ'}</p>
            </div>
        `;
        return;
    }

    console.log('✅ Rendering', documents.length, 'documents to grid');
    documentsGrid.innerHTML = documents.map(doc => {
        let typeLabel = '';
        let typeBadge = '';
        
        if (doc.documentType === 'before') {
            typeLabel = 'صور قبل';
            typeBadge = '<div style="background: #ff9800; color: white; padding: 5px 10px; border-radius: 5px; margin: 10px 0; font-size: 0.85em; font-weight: bold;">📷 صور قبل</div>';
        } else if (doc.documentType === 'after') {
            typeLabel = 'صور بعد';
            typeBadge = '<div style="background: #4caf50; color: white; padding: 5px 10px; border-radius: 5px; margin: 10px 0; font-size: 0.85em; font-weight: bold;">✅ صور بعد</div>';
        } else {
            typeLabel = 'مستند عام';
        }
        
        return `
        <div class="document-card" data-id="${doc.id}">
            <div class="document-icon">${doc.icon}</div>
            <div class="document-name">${doc.name}</div>
            ${typeBadge}
            ${doc.complaintRef ? `<div style="background: #e3f2fd; color: #1565c0; padding: 5px 10px; border-radius: 5px; margin: 5px 0; font-size: 0.85em; font-weight: bold;">🔗 ${doc.complaintRef}</div>` : ''}
            <div class="document-size">${formatFileSize(doc.size)}</div>
            <div class="document-date">${new Date(doc.uploadDate).toLocaleDateString('ar-EG')}</div>
            <div class="document-actions">
                <button class="btn btn-primary" onclick="viewDocument('${doc.id}')">عرض</button>
                <button class="btn btn-secondary" onclick="downloadDocument('${doc.id}')" style="background: #28a745;">تحميل</button>
                <button class="btn btn-secondary" onclick="deleteDocument('${doc.id}')" style="background: #dc3545;">حذف</button>
            </div>
        </div>
    `;
    }).join('');

    updateStats();
}

// Load documents
function loadDocuments() {
    // Load from localStorage first for quick display
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const selectedComplaintId = document.getElementById('complaintRef')?.value;
                displayDocumentsForComplaint(selectedComplaintId || null);
                console.log('Documents loaded from localStorage:', parsed.length);
            }
        } catch (error) {
            console.error('Error parsing localStorage documents:', error);
        }
    }
    
    // Then sync with Firebase (this will update display if there are changes)
    // syncDocumentsWithFirebase() is already called in onAuthStateChanged
}

// Upload area functionality
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');

addTrackedListener(uploadArea, 'click', () => {
    fileInput.click();
});

addTrackedListener(uploadArea, 'dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

addTrackedListener(uploadArea, 'dragleave', () => {
    uploadArea.classList.remove('dragover');
});

addTrackedListener(uploadArea, 'drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
});

addTrackedListener(fileInput, 'change', (e) => {
    const files = e.target.files;
    handleFiles(files);
});

// Handle uploaded files
async function handleFiles(files) {
    const documents = getDocuments();
    const complaintId = document.getElementById('complaintRef').value;
    const complaintRef = complaintId ? (complaintsData[complaintId]?.complaintId || '') : '';
    const documentType = document.getElementById('documentType').value;
    
    for (let file of files) {
        // ✅ قبول الصور فقط
        if (!file.type.startsWith('image/')) {
            alert(`الملف ${file.name} غير مدعوم. يرجى رفع صور فقط.`);
            continue;
        }
        
        // Check file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert(`الملف ${file.name} كبير جداً (الحد الأقصى 50 ميجابايت)`);
            continue;
        }

        // Read file as base64
        const reader = new FileReader();
        reader.onload = (e) => {
            const document = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: file.type,
                size: file.size,
                category: getFileCategory(file.type),
                icon: getFileIcon(file.type),
                data: e.target.result,
                uploadDate: new Date().toISOString(),
                complaintId: complaintId || null,
                complaintRef: complaintRef || null,
                documentType: documentType || 'document'
            };

            documents.push(document);
            saveDocuments(documents);
            displayDocumentsForComplaint(complaintId || null);
        };
        reader.readAsDataURL(file);
    }

    // Reset input
    fileInput.value = '';
    
    // Show success message
    let typeText = documentType === 'before' ? '📷 صور قبل' : documentType === 'after' ? '✅ صور بعد' : '📄 مستندات عامة';
    if (complaintRef) {
        alert(`✅ تم رفع ${typeText} وربطها بالشكوى: ${complaintRef}`);
    } else {
        alert(`✅ تم رفع ${typeText} بنجاح`);
    }
}

// View document
window.viewDocument = function(id) {
    const documents = getDocuments();
    const doc = documents.find(d => d.id === id);
    
    if (!doc) return;

    // Create temporary link to view file
    const newWindow = window.open();
    if (doc.category === 'image') {
        newWindow.document.write(`
            <html>
                <head>
                    <title>${doc.name}</title>
                    <style>
                        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #333; }
                        img { max-width: 100%; max-height: 100vh; }
                    </style>
                </head>
                <body>
                    <img src="${doc.data}" alt="${doc.name}">
                </body>
            </html>
        `);
    } else if (doc.type === 'application/pdf') {
        newWindow.document.write(`
            <html>
                <head>
                    <title>${doc.name}</title>
                    <style>
                        body { margin: 0; }
                        iframe { width: 100vw; height: 100vh; border: none; }
                    </style>
                </head>
                <body>
                    <iframe src="${doc.data}"></iframe>
                </body>
            </html>
        `);
    } else {
        alert('لا يمكن عرض هذا النوع من الملفات. استخدم زر التحميل.');
        newWindow.close();
    }
};

// Download document
window.downloadDocument = function(id) {
    const documents = getDocuments();
    const doc = documents.find(d => d.id === id);
    
    if (!doc) return;

    const link = document.createElement('a');
    link.href = doc.data;
    link.download = doc.name;
    link.click();
};

// Delete document
window.deleteDocument = function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المستند؟')) return;

    try {
        let documents = getDocuments();
        
        // التأكد التام من أن documents هو array صالح
        if (!documents || !Array.isArray(documents)) {
            console.error('Invalid documents data, resetting:', documents);
            documents = [];
            saveDocuments(documents);
        }
        
        // تصفية المستند المحذوف
        const filtered = documents.filter(d => d.id !== id);
        saveDocuments(filtered);
        const selectedComplaintId = document.getElementById('complaintRef')?.value;
        displayDocumentsForComplaint(selectedComplaintId || null);
    } catch (error) {
        console.error('Error deleting document:', error);
        alert('حدث خطأ أثناء حذف المستند');
    }
};

// Copy document to clipboard
window.copyDocument = function(id) {
    const documents = getDocuments();
    const doc = documents.find(d => d.id === id);
    
    if (!doc) return;

    try {
        // Create a complete copy of the document with all details
        const documentCopy = JSON.stringify(doc);
        
        // Copy to clipboard using a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = documentCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        // Show success message
        alert('✅ تم نسخ المستند بنجاح!\n\nيمكنك الآن لصقه في أي برنامج آخر باستخدام زر "لصق المستندات المنسوخة"');
    } catch (error) {
        console.error('Copy error:', error);
        alert('❌ حدث خطأ أثناء النسخ');
    }
};

// Copy all documents to clipboard
window.copyAllDocuments = function() {
    const documents = getDocuments();
    
    if (documents.length === 0) {
        alert('⚠️ لا توجد مستندات لنسخها!');
        return;
    }
    
    if (!confirm(`هل تريد نسخ كل المستندات؟\n\nالعدد: ${documents.length} مستند\n\nسيتم نسخها جميعاً لتتمكن من لصقها في برنامج آخر.`)) {
        return;
    }
    
    try {
        // Create package with all documents
        const documentsPackage = {
            type: 'complaints_documents_package',
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalDocuments: documents.length,
            documents: documents
        };
        
        const packageString = JSON.stringify(documentsPackage);
        
        // Copy to clipboard using textarea method (more compatible)
        const textarea = document.createElement('textarea');
        textarea.value = packageString;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (err) {
            console.error('Copy command failed:', err);
        }
        
        document.body.removeChild(textarea);
        
        if (success) {
            // Show success message with details
            const beforeCount = documents.filter(d => d.documentType === 'before').length;
            const afterCount = documents.filter(d => d.documentType === 'after').length;
            const linkedCount = documents.filter(d => d.complaintRef).length;
            
            let message = '✅ تم نسخ كل المستندات بنجاح!\n\n';
            message += `📊 الإحصائيات:\n`;
            message += `• إجمالي المستندات: ${documents.length}\n`;
            message += `• صور قبل: ${beforeCount}\n`;
            message += `• صور بعد: ${afterCount}\n`;
            message += `• مرتبط بشكاوى: ${linkedCount}\n\n`;
            message += `يمكنك الآن لصقها في أي برنامج آخر!`;
            
            alert(message);
        } else {
            throw new Error('Copy command returned false');
        }
        
    } catch (error) {
        console.error('Copy all error:', error);
        alert('❌ حدث خطأ أثناء نسخ المستندات\n\nجرب مرة أخرى أو أعد تشغيل البرنامج.');
    }
};

// Paste document from clipboard
window.pasteDocument = async function() {
    try {
        // Try to read from clipboard
        const clipboardText = await navigator.clipboard.readText();
        
        if (!clipboardText) {
            alert('⚠️ الحافظة فارغة!\n\nقم بنسخ مستند أولاً من أي برنامج.');
            return;
        }
        
        // Try to parse the document
        const doc = JSON.parse(clipboardText);
        
        // Validate document structure
        if (!doc.name || !doc.data || !doc.type) {
            alert('⚠️ البيانات المنسوخة ليست مستند صحيح!');
            return;
        }
        
        // Get current documents
        const documents = getDocuments();
        
        // Create new document with new ID and current date
        const newDoc = {
            ...doc,
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            uploadDate: new Date().toISOString()
        };
        
        // Add to documents
        documents.push(newDoc);
        saveDocuments(documents);
        const selectedComplaintId = document.getElementById('complaintRef')?.value;
        displayDocumentsForComplaint(selectedComplaintId || null);
        
        // Show success message
        let message = '✅ تم لصق المستند بنجاح!\n\n';
        message += `📄 الملف: ${newDoc.name}\n`;
        if (newDoc.complaintRef) {
            message += `🔗 الشكوى: ${newDoc.complaintRef}\n`;
        }
        if (newDoc.documentType === 'before') {
            message += `📷 النوع: صور قبل`;
        } else if (newDoc.documentType === 'after') {
            message += `✅ النوع: صور بعد`;
        }
        
        alert(message);
        
    } catch (error) {
        console.error('Paste error:', error);
        alert('❌ حدث خطأ أثناء اللصق!\n\nتأكد من نسخ مستند صحيح.');
    }
};

// Paste all documents from clipboard
window.pasteDocuments = function() {
    // Create a textarea to paste into
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    
    // Show instruction
    alert('بعد الضغط على "موافق"، اضغط Ctrl+V للصق المستندات');
    
    addTrackedListener(textarea, 'paste', function(e) {
        e.preventDefault();
        const clipboardText = e.clipboardData.getData('text');
        document.body.removeChild(textarea);
        
        try {
            if (!clipboardText) {
                alert('⚠️ الحافظة فارغة!\n\nقم بنسخ المستندات أولاً باستخدام زر "نسخ رابط ادارة المستندات".');
                return;
            }
            
            // Try to parse the package
            const packageData = JSON.parse(clipboardText);
            
            // Validate package structure
            if (packageData.type !== 'complaints_documents_package' || !packageData.documents || !Array.isArray(packageData.documents)) {
                alert('⚠️ البيانات المنسوخة ليست حزمة مستندات صحيحة!\n\nاستخدم زر "نسخ رابط ادارة المستندات" من البرنامج الآخر.');
                return;
            }
            
            const incomingDocs = packageData.documents;
            
            if (incomingDocs.length === 0) {
                alert('⚠️ الحزمة المنسوخة فارغة!');
                return;
            }
            
            // Ask for confirmation
            const beforeCount = incomingDocs.filter(d => d.documentType === 'before').length;
            const afterCount = incomingDocs.filter(d => d.documentType === 'after').length;
            const linkedCount = incomingDocs.filter(d => d.complaintRef).length;
            
            let confirmMsg = `هل تريد لصق المستندات المنسوخة؟\n\n`;
            confirmMsg += `📊 ستتم إضافة:\n`;
            confirmMsg += `• إجمالي المستندات: ${incomingDocs.length}\n`;
            confirmMsg += `• صور قبل: ${beforeCount}\n`;
            confirmMsg += `• صور بعد: ${afterCount}\n`;
            confirmMsg += `• مرتبط بشكاوى: ${linkedCount}\n\n`;
            confirmMsg += `سيتم إضافتها للمستندات الموجودة حالياً.`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // Get current documents
            const currentDocuments = getDocuments();
            
            // Add new documents with new IDs and current date
            let addedCount = 0;
            incomingDocs.forEach(doc => {
                const newDoc = {
                    ...doc,
                    id: Date.now() + addedCount + Math.random().toString(36).substr(2, 9),
                    uploadDate: new Date().toISOString()
                };
                currentDocuments.push(newDoc);
                addedCount++;
            });
            
            // Save all documents
            saveDocuments(currentDocuments);
            const selectedComplaintId = document.getElementById('complaintRef')?.value;
            displayDocumentsForComplaint(selectedComplaintId || null);
            
            // Show success message
            let message = '✅ تم لصق كل المستندات بنجاح!\n\n';
            message += `📊 تم إضافة ${addedCount} مستند\n`;
            message += `📁 إجمالي المستندات الآن: ${currentDocuments.length}`;
            
            alert(message);
            
        } catch (error) {
            console.error('Paste all error:', error);
            alert('❌ حدث خطأ أثناء اللصق!\n\nتأكد من نسخ حزمة المستندات بشكل صحيح.');
        }
    });
    
    // Trigger paste programmatically after a short delay
    setTimeout(() => {
        document.execCommand('paste');
    }, 100);
};

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    addTrackedListener(btn, 'click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        
        // ✅ إعادة عرض صور الشكوى المختارة مع الفلتر
        const selectedComplaintId = document.getElementById('complaintRef')?.value;
        displayDocumentsForComplaint(selectedComplaintId || null, filter);
    });
});

// Search functionality
addTrackedListener(document.getElementById('searchInput'), 'input', (e) => {
    const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
    
    // ✅ إعادة عرض صور الشكوى المختارة مع البحث والفلتر
    const selectedComplaintId = document.getElementById('complaintRef')?.value;
    displayDocumentsForComplaint(selectedComplaintId || null, activeFilter, e.target.value);
});

// Show print dialog
window.showPrintDialog = function() {
    // ✅ الحصول على الشكوى المختارة حالياً
    const selectedComplaintId = document.getElementById('complaintRef')?.value;
    
    if (!selectedComplaintId) {
        alert('⚠️ يرجى اختيار شكوى أولاً من القائمة أعلاه!');
        return;
    }
    
    const documents = getDocuments();
    const complaintDocs = documents.filter(d => d.complaintId === selectedComplaintId);
    
    if (complaintDocs.length === 0) {
        alert('⚠️ لا توجد صور لهذه الشكوى!');
        return;
    }
    
    const beforeDocs = complaintDocs.filter(d => d.documentType === 'before');
    const afterDocs = complaintDocs.filter(d => d.documentType === 'after');
    const complaint = complaintsData[selectedComplaintId];
    
    // Show image type selection dialog
    let selectionHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; justify-content: center; align-items: center;" id="imageTypeDialog">
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
                <h2 style="text-align: center; color: #667eea; margin-bottom: 10px;">📸 اختر نوع الصور</h2>
                <div style="text-align: center; color: #28a745; font-weight: bold; margin-bottom: 20px;">🔗 ${complaint.complaintId}</div>
                <div style="display: flex; flex-direction: column; gap: 15px;">
    `;
    
    if (beforeDocs.length > 0) {
        selectionHTML += `
            <button onclick="printImages('${selectedComplaintId}', 'before')" style="padding: 15px; background: #ff9800; color: white; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#f57c00'" onmouseout="this.style.background='#ff9800'">
                📷 صور قبل (${beforeDocs.length})
            </button>
        `;
    }
    
    if (afterDocs.length > 0) {
        selectionHTML += `
            <button onclick="printImages('${selectedComplaintId}', 'after')" style="padding: 15px; background: #4caf50; color: white; border: none; border-radius: 8px; font-size: 1.1em; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#388e3c'" onmouseout="this.style.background='#4caf50'">
                ✅ صور بعد (${afterDocs.length})
            </button>
        `;
    }
    
    selectionHTML += `
                    <button onclick="closeImageTypeDialog()" style="padding: 12px; background: #dc3545; color: white; border: none; border-radius: 8px; font-size: 1em; cursor: pointer;">إلغاء</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', selectionHTML);
};

window.closeImageTypeDialog = function() {
    const dialog = document.getElementById('imageTypeDialog');
    if (dialog) {
        dialog.remove();
    }
};

window.printImages = function(complaintId, imageType) {
    // استدعاء الدالة الأصلية بنفس المعاملات
    window.printComplaintWithImages(complaintId, imageType);
};

window.printComplaintWithImages = async function(complaintId, imageType) {
    closeImageTypeDialog();
    
    const complaint = complaintsData[complaintId];
    if (!complaint) {
        alert('❌ لم يتم العثور على بيانات الشكوى!');
        return;
    }
    
    const documents = getDocuments();
    let selectedDocs = [];
    
    if (imageType === 'before') {
        selectedDocs = documents.filter(d => d.complaintId === complaintId && d.documentType === 'before');
    } else if (imageType === 'after') {
        selectedDocs = documents.filter(d => d.complaintId === complaintId && d.documentType === 'after');
    } else if (imageType === 'both') {
        selectedDocs = documents.filter(d => d.complaintId === complaintId && (d.documentType === 'before' || d.documentType === 'after'));
    }
    
    if (selectedDocs.length === 0) {
        alert('❌ لا توجد صور للطباعة!');
        return;
    }
    
    // Get background image
    const fs = require('fs');
    const path = require('path');
    
    let backgroundPath = path.join(__dirname, '../background.jpg');
    if (!fs.existsSync(backgroundPath)) {
        backgroundPath = path.join(process.resourcesPath, 'app', 'background.jpg');
    }
    if (!fs.existsSync(backgroundPath)) {
        backgroundPath = path.join(process.cwd(), 'background.jpg');
    }
    
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
    
    // Generate print document
    generatePrintDocument(complaint, selectedDocs, backgroundImageUrl, imageType);
};

function generatePrintDocument(complaint, images, backgroundImage, imageType) {
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
    
    let imageTypeTitle = '';
    if (imageType === 'before') {
        imageTypeTitle = '📷 صور قبل';
    } else if (imageType === 'after') {
        imageTypeTitle = '✅ صور بعد';
    } else {
        imageTypeTitle = '📷✅ صور قبل وبعد';
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
            page-break-after: always;
        }
        
        .page-wrapper:last-child {
            page-break-after: auto;
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
        
        /* Images page styles */
        .images-page {
            padding: 15mm 15mm;
        }
        
        .images-header {
            text-align: center;
            margin-bottom: 20px;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
        }
        
        .images-header h2 {
            font-size: 24px;
            margin-bottom: 5px;
        }
        
        .images-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .image-item {
            border: 2px solid #667eea;
            border-radius: 10px;
            overflow: hidden;
            background: white;
        }
        
        .image-item img {
            width: 100%;
            height: 250px;
            object-fit: cover;
        }
        
        .image-label {
            padding: 10px;
            text-align: center;
            font-weight: bold;
            color: white;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
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
    <!-- First Page: Complaint Details with Background -->
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
    
    <!-- Images Pages -->
    ${generateImagesPages(images, complaintNumber, imageTypeTitle)}
    
    <script>
        window.onload = function() {
            setTimeout(() => window.print(), 500);
        };
    </script>
</body>
</html>
    `);
    
    printWindow.document.close();
}

function generateImagesPages(images, complaintNumber, imageTypeTitle) {
    let pagesHTML = '';
    const imagesPerPage = 4; // 2x2 grid
    
    for (let i = 0; i < images.length; i += imagesPerPage) {
        const pageImages = images.slice(i, i + imagesPerPage);
        
        pagesHTML += `
        <div class="page-wrapper">
            <div class="images-page">
                <div class="images-header">
                    <h2>${imageTypeTitle}</h2>
                </div>
                
                <div class="images-grid">
        `;
        
        pageImages.forEach((img, index) => {
            pagesHTML += `
                <div class="image-item">
                    <img src="${img.data}" alt="${img.name}">
                </div>
            `;
        });
        
        pagesHTML += `
                </div>
            </div>
        </div>
        `;
    }
    
    return pagesHTML;
}

// Complaint select change handler
addTrackedListener(document.getElementById('complaintRef'), 'change', (e) => {
    const uploadArea = document.getElementById('uploadArea');
    const selectedComplaintId = e.target.value;
    
    if (selectedComplaintId) {
        // Complaint selected
        const complaint = complaintsData[selectedComplaintId];
        uploadArea.style.borderColor = '#28a745';
        uploadArea.style.background = '#e8f5e9';
        
        // ✅ عرض صور الشكوى المختارة فقط
        displayDocumentsForComplaint(selectedComplaintId);
        
        // Show selected complaint info
        const selectedInfo = document.getElementById('selectedComplaintInfo');
        if (selectedInfo) {
            selectedInfo.remove();
        }
        
        const infoDiv = document.createElement('div');
        infoDiv.id = 'selectedComplaintInfo';
        infoDiv.style.cssText = 'background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;';
        infoDiv.innerHTML = `
            <strong style="color: #155724; font-size: 1.1em;">✅ تم اختيار الشكوى:</strong><br>
            <span style="color: #28a745; font-size: 1.2em; font-weight: bold;">${complaint.complaintId}</span> - ${complaint.customerName}
        `;
        uploadArea.parentNode.insertBefore(infoDiv, uploadArea);
    } else {
        // No complaint selected - لا تعرض أي صور
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.background = '#f8f9ff';
        
        const selectedInfo = document.getElementById('selectedComplaintInfo');
        if (selectedInfo) {
            selectedInfo.remove();
        }
        
        // ✅ إخفاء جميع الصور عند إلغاء الاختيار
        displayDocumentsForComplaint(null);
    }
});
