// Import Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Initialize Firebase
const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const successMessage = document.getElementById('successMessage');
const loading = document.getElementById('loading');
const forgotPasswordLink = document.getElementById('forgotPassword');
const createAccountLink = document.getElementById('createAccount');

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = 'pages/complaints.html';
    }
});

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    emailError.style.display = 'none';
    passwordError.style.display = 'none';
    successMessage.style.display = 'none';
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validation
    if (!email) {
        emailError.textContent = 'الرجاء إدخال البريد الإلكتروني';
        emailError.style.display = 'block';
        return;
    }

    if (!password) {
        passwordError.textContent = 'الرجاء إدخال كلمة المرور';
        passwordError.style.display = 'block';
        return;
    }

    try {
        loading.style.display = 'block';
        loginForm.style.display = 'none';

        await signInWithEmailAndPassword(auth, email, password);
        
        successMessage.style.display = 'block';
        setTimeout(() => {
            window.location.href = 'pages/complaints.html';
        }, 1000);

    } catch (error) {
        loading.style.display = 'none';
        loginForm.style.display = 'block';

        console.error('Login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صحيح';
                emailError.textContent = errorMessage;
                emailError.style.display = 'block';
                break;
            case 'auth/user-disabled':
                errorMessage = 'هذا الحساب معطل';
                emailError.textContent = errorMessage;
                emailError.style.display = 'block';
                break;
            case 'auth/user-not-found':
                errorMessage = 'البريد الإلكتروني غير مسجل - جرب إنشاء حساب جديد';
                emailError.textContent = errorMessage;
                emailError.style.display = 'block';
                break;
            case 'auth/wrong-password':
                errorMessage = 'كلمة المرور غير صحيحة';
                passwordError.textContent = errorMessage;
                passwordError.style.display = 'block';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'بيانات الدخول غير صحيحة - تحقق من البريد وكلمة المرور';
                passwordError.textContent = errorMessage;
                passwordError.style.display = 'block';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'محاولات كثيرة جداً - حاول لاحقاً';
                passwordError.textContent = errorMessage;
                passwordError.style.display = 'block';
                break;
            default:
                errorMessage = `خطأ: ${error.message}`;
                passwordError.textContent = errorMessage;
                passwordError.style.display = 'block';
        }
    }
});

// Forgot password
forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    if (!email) {
        emailError.textContent = 'الرجاء إدخال البريد الإلكتروني أولاً';
        emailError.style.display = 'block';
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        alert('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
    } catch (error) {
        console.error('Password reset error:', error);
        alert('حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور');
    }
});

// Create new account
createAccountLink.addEventListener('click', async (e) => {
    e.preventDefault();
    
    emailError.style.display = 'none';
    passwordError.style.display = 'none';
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email) {
        emailError.textContent = 'الرجاء إدخال البريد الإلكتروني';
        emailError.style.display = 'block';
        return;
    }
    
    if (!password || password.length < 6) {
        passwordError.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        passwordError.style.display = 'block';
        return;
    }
    
    if (!confirm('هل تريد إنشاء حساب جديد بهذا البريد الإلكتروني؟\n' + email)) {
        return;
    }
    
    try {
        loading.style.display = 'block';
        loginForm.style.display = 'none';
        
        await createUserWithEmailAndPassword(auth, email, password);
        
        alert('تم إنشاء الحساب بنجاح! جاري تسجيل الدخول...');
        
        successMessage.style.display = 'block';
        setTimeout(() => {
            window.location.href = 'pages/complaints.html';
        }, 1000);
        
    } catch (error) {
        loading.style.display = 'none';
        loginForm.style.display = 'block';
        
        console.error('Account creation error:', error);
        
        let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'هذا البريد الإلكتروني مسجل بالفعل';
                emailError.textContent = errorMessage;
                emailError.style.display = 'block';
                break;
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صحيح';
                emailError.textContent = errorMessage;
                emailError.style.display = 'block';
                break;
            case 'auth/weak-password':
                errorMessage = 'كلمة المرور ضعيفة جداً';
                passwordError.textContent = errorMessage;
                passwordError.style.display = 'block';
                break;
            default:
                alert(errorMessage);
        }
    }
});
