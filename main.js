// @ts-nocheck
const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');

let mainWindow;
let updateCheckInterval;

// ✅ حل جذري وشامل لجميع مشاكل GPU
app.disableHardwareAcceleration();

// إضافة جميع خيارات تعطيل GPU قبل بدء التطبيق
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

// ✅ حل مشاكل Cache و Database
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
app.commandLine.appendSwitch('disable-application-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// تحديد مجلد userData مخصص لتجنب مشاكل الصلاحيات
const userDataPath = path.join(app.getPath('appData'), 'ComplaintsSystem');
app.setPath('userData', userDataPath);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'منظومة شكاوى العملاء',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      nativeWindowOpen: true
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  // تحميل صفحة تسجيل الدخول
  mainWindow.loadFile('index.html');

  // حماية من فتح روابط خارجية غير آمنة
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // السماح بفتح النوافذ المحلية الفارغة (للصور والمستندات)
    if (!url || url === '' || url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
      return { action: 'allow' };
    }
    // السماح بفتح WhatsApp
    if (url.startsWith('https://web.whatsapp.com') || url.startsWith('https://wa.me')) {
      return { action: 'allow' };
    }
    // منع باقي الروابط الخارجية
    return { action: 'deny' };
  });

  // إظهار النافذة عند الاستعداد
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // إنشاء قائمة مخصصة باللغة العربية
  const menuTemplate = [
    {
      label: 'ملف',
      submenu: [
        {
          label: 'تسجيل الدخول',
          click: () => {
            mainWindow.loadFile('index.html');
          }
        },
        {
          label: 'عرض الشكاوى',
          click: () => {
            mainWindow.loadFile('pages/complaints.html');
          }
        },
        {
          label: 'السجلات',
          click: () => {
            mainWindow.loadFile('pages/records.html');
          }
        },
        {
          label: 'المشرفين',
          click: () => {
            mainWindow.loadFile('pages/supervisors.html');
          }
        },
        {
          label: 'المستندات',
          click: () => {
            mainWindow.loadFile('pages/documents.html');
          }
        },
        { type: 'separator' },
        {
          label: 'تحديث',
          role: 'reload'
        },
        { type: 'separator' },
        {
          label: 'خروج',
          role: 'quit'
        }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        {
          label: 'ملء الشاشة',
          role: 'togglefullscreen'
        },
        {
          label: 'تكبير',
          role: 'zoomin'
        },
        {
          label: 'تصغير',
          role: 'zoomout'
        },
        {
          label: 'إعادة تعيين التكبير',
          role: 'resetzoom'
        },
        { type: 'separator' },
        {
          label: 'أدوات المطور',
          role: 'toggleDevTools'
        }
      ]
    },
    {
      label: 'مساعدة',
      submenu: [
        {
          label: 'التحقق من التحديثات',
          click: () => {
            checkForUpdates();
          }
        },
        { type: 'separator' },
        {
          label: 'حول البرنامج',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'حول منظومة الشكاوى',
              message: 'منظومة شكاوى العملاء',
              detail: ` التعمير لإدارة المرافق\nالإصدار: ${app.getVersion()}\n\nنظام متكامل لإدارة ومتابعة شكاوى العملاء`,
              buttons: ['موافق']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// التحقق من التحديثات من Firebase
function checkForUpdates() {
  const url = 'https://complaints-program-default-rtdb.firebaseio.com/appVersion.json';
  
  https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const updateInfo = JSON.parse(data);
        if (!updateInfo || !updateInfo.version) {
          console.log('معلومات التحديث غير صالحة');
          return;
        }
        
        const currentVersion = app.getVersion();
        const latestVersion = updateInfo.version;
        
        // مقارنة الإصدارات
        if (compareVersions(latestVersion, currentVersion) > 0) {
          showUpdateDialog(updateInfo);
        }
      } catch (error) {
        console.error('خطأ في التحقق من التحديثات:', error);
      }
    });
  }).on('error', (error) => {
    console.error('خطأ في الاتصال بالخادم:', error);
  });
}

// مقارنة الإصدارات (1.0.1 > 1.0.0)
function compareVersions(v1, v2) {
  // التحقق من أن الإصدارات موجودة
  if (!v1 || !v2) {
    console.log('إصدار غير صالح:', { v1, v2 });
    return 0;
  }
  
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
}

// عرض نافذة التحديث
function showUpdateDialog(updateInfo) {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'تحديث متوفر',
    message: `🎉 إصدار جديد متوفر!`,
    detail: `الإصدار الحالي: ${app.getVersion()}\nالإصدار الجديد: ${updateInfo.version}\n\n${updateInfo.notes || 'تحديثات وتحسينات جديدة'}\n\nهل تريد تنزيل التحديث الآن؟`,
    buttons: ['نعم', 'لاحقاً'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      downloadUpdate(updateInfo);
    }
  });
}

// تنزيل التحديث
function downloadUpdate(updateInfo) {
  const { shell } = require('electron');
  
  // إذا كان هناك رابط تنزيل مباشر
  if (updateInfo.downloadUrl) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'تنزيل التحديث',
      message: 'سيتم فتح صفحة التنزيل في المتصفح',
      detail: 'قم بتنزيل الإصدار الجديد وتثبيته.',
      buttons: ['فتح صفحة التنزيل', 'إلغاء']
    }).then((result) => {
      if (result.response === 0) {
        shell.openExternal(updateInfo.downloadUrl);
      }
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  
  // التحقق من التحديثات عند بدء التطبيق
  setTimeout(() => {
    checkForUpdates();
  }, 3000);
  
  // التحقق من التحديثات كل 6 ساعات
  updateCheckInterval = setInterval(() => {
    checkForUpdates();
  }, 6 * 60 * 60 * 1000); // 6 ساعات
});

app.on('window-all-closed', () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
