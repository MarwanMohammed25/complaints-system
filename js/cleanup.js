/**
 * نظام تنظيف Event Listeners - منظومة الشكاوى
 * التعمير لإدارة المرافق
 * 
 * يمنع memory leaks من خلال تتبع وإزالة Event Listeners
 */

/**
 * مجموعة لتخزين جميع Event Listeners المسجلة
 */
const eventListeners = [];

/**
 * إضافة Event Listener مع تتبع تلقائي
 * @param {HTMLElement} element - العنصر
 * @param {string} event - نوع الحدث (click, submit, etc.)
 * @param {Function} handler - الدالة المعالجة
 * @param {object} options - خيارات إضافية
 */
export function addTrackedListener(element, event, handler, options = {}) {
    if (!element) {
        console.error('Element is null or undefined');
        return;
    }
    
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
}

/**
 * إزالة جميع Event Listeners المسجلة
 */
export function cleanupAllListeners() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        try {
            element.removeEventListener(event, handler, options);
        } catch (error) {
            // تجاهل الأخطاء (العنصر قد يكون محذوف)
        }
    });
    eventListeners.length = 0;
}

/**
 * إضافة cleanup تلقائي عند مغادرة الصفحة
 */
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        cleanupAllListeners();
    });
}
