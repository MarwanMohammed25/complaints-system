/**
 * ملف الأدوات المساعدة - منظومة الشكاوى
 * التعمير لإدارة المرافق
 */

/**
 * تنظيف النصوص من أكواد HTML خبيثة (حماية من XSS)
 * @param {string} str - النص المراد تنظيفه
 * @returns {string} - النص النظيف والآمن
 */
export function sanitizeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * تنظيف كائن كامل من البيانات
 * @param {object} obj - الكائن المراد تنظيفه
 * @returns {object} - الكائن بعد التنظيف
 */
export function sanitizeObject(obj) {
    const cleaned = {};
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            cleaned[key] = sanitizeHTML(obj[key]);
        } else {
            cleaned[key] = obj[key];
        }
    }
    return cleaned;
}

/**
 * التحقق من صحة رقم الهاتف المصري
 * @param {string} phone - رقم الهاتف
 * @returns {boolean}
 */
export function isValidEgyptianPhone(phone) {
    const phoneRegex = /^(\+?2)?01[0-2,5]{1}[0-9]{8}$/;
    return phoneRegex.test(phone);
}

/**
 * تنسيق التاريخ بالعربية
 * @param {string} dateString - التاريخ بصيغة ISO
 * @returns {string}
 */
export function formatArabicDate(dateString) {
    return new Date(dateString).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * تنسيق الوقت بالعربية
 * @param {string} dateString - التاريخ بصيغة ISO
 * @returns {string}
 */
export function formatArabicTime(dateString) {
    return new Date(dateString).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}
