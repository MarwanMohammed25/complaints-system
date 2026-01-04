/**
 * نظام التسجيل (Logger) - منظومة الشكاوى
 * التعمير لإدارة المرافق
 * 
 * يخفي console.log في Production ويحتفظ بـ console.error
 */

// تحديد وضع التطوير
// ⚠️ تغيير هذا لـ false قبل بناء الإصدار النهائي
const isDevelopment = true;

/**
 * نظام التسجيل الآمن
 */
export const logger = {
    /**
     * طباعة رسالة عادية (فقط في التطوير)
     */
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },
    
    /**
     * طباعة رسالة خطأ (دائماً)
     */
    error: (...args) => {
        console.error(...args);
    },
    
    /**
     * طباعة تحذير (فقط في التطوير)
     */
    warn: (...args) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },
    
    /**
     * معلومات مفصلة (فقط في التطوير)
     */
    info: (...args) => {
        if (isDevelopment) {
            console.info(...args);
        }
    }
};
