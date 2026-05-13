// ── HELPERS ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const chatArea = $('chat'), inputEl = $('input'), sendBtn = $('send');
const authOverlay = $('authOverlay'), mainApp = $('mainApp');
const recentList = $('recentList'), creditDisp = $('creditDisplay');

// Default: Dark theme
if (!localStorage.getItem('aryax-theme')) localStorage.setItem('aryax-theme', 'dark');

let currentUser = null, currentChatId = null;
let isSignUpMode = false, isWebSearch = false, isCodeSandbox = false;

// ── SCREENSHOT PREVENTION ─────────────────────────────
(function initScreenshotProtection() {
    // 1. Inject black overlay element
    const overlay = document.createElement('div');
    overlay.id = 'ssBlockOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:999999;display:none;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
    overlay.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p style="color:#fff;font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;margin:0;">Screenshot Blocked</p>
        <p style="color:rgba(255,255,255,.4);font-size:13px;margin:0;font-family:'Inter',sans-serif;">AryaX content is protected</p>`;
    document.body.appendChild(overlay);

    function showBlock(ms = 1500) {
        overlay.style.display = 'flex';
        // Clear clipboard
        try { navigator.clipboard.writeText(''); } catch {}
        setTimeout(() => { overlay.style.display = 'none'; }, ms);
    }

    // 2. PrintScreen key detection
    document.addEventListener('keyup', e => {
        if (e.key === 'PrintScreen' || e.keyCode === 44) {
            showBlock(2000);
            try { navigator.clipboard.writeText('AryaX - Screenshot Protected'); } catch {}
        }
    });
    document.addEventListener('keydown', e => {
        // Block Ctrl+P (print), Ctrl+Shift+S, Win+PrintScr equivalent
        if ((e.ctrlKey && e.key === 'p') ||
            (e.ctrlKey && e.shiftKey && e.key === 'S') ||
            e.key === 'PrintScreen') {
            e.preventDefault();
            showBlock(1500);
        }
    });

    // 3. Visibility change — blur content when tab loses focus (during ss)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.body.style.filter = 'blur(20px)';
        } else {
            setTimeout(() => { document.body.style.filter = ''; }, 300);
        }
    });

    // 4. Disable right-click on main app area (after login)
    document.addEventListener('contextmenu', e => {
        const app = document.getElementById('mainApp');
        if (app && app.style.display !== 'none' && app.contains(e.target)) {
            e.preventDefault();
        }
    });

    // 5. CSS print media block
    const style = document.createElement('style');
    style.textContent = `@media print { body { display: none !important; } }`;
    document.head.appendChild(style);
})();

// ── WATERMARK (injected after login) ─────────────────
function injectWatermark(username) {
    const old = document.getElementById('aryax-watermark');
    if (old) old.remove();
    const wm = document.createElement('div');
    wm.id = 'aryax-watermark';
    wm.style.cssText = `
        position:fixed;inset:0;pointer-events:none;z-index:99998;overflow:hidden;
        display:flex;align-items:center;justify-content:center;`;
    // Diagonal repeating text
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(200, 150);
    ctx.rotate(-30 * Math.PI / 180);
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.textAlign = 'center';
    for (let x = -200; x <= 200; x += 140) {
        for (let y = -150; y <= 150; y += 80) {
            ctx.fillText(`AryaX · ${username}`, x, y);
        }
    }
    ctx.restore();
    wm.style.backgroundImage = `url(${canvas.toDataURL()})`;
    wm.style.backgroundRepeat = 'repeat';
    document.body.appendChild(wm);
}

// ── SOCIAL LOGIN ──────────────────────────────────────
async function socialLogin(provider) {
    const btn = document.getElementById(provider + 'Btn');
    if (btn) { btn.textContent = 'Connecting...'; btn.disabled = true; }
    try {
        const r = await fetch(`/api/social-login`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({provider})
        });
        const d = await r.json();
        if (r.ok) {
            loginSuccess(d.username, d.credits);
        } else {
            // Fallback: show a simple username auto-create
            const u = `${provider}_user_${Math.floor(Math.random()*9000+1000)}`;
            const r2 = await fetch('/api/signup', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({username: u, password: `${provider}oauth`, email:'', mobile:''})
            });
            const d2 = await r2.json();
            if (r2.ok) loginSuccess(d2.username || u, d2.credits);
            else { if (btn) {btn.disabled=false; btn.textContent='Try again';} }
        }
    } catch {
        // Demo fallback
        const u = `${provider}_user_${Math.floor(Math.random()*9000+1000)}`;
        loginSuccess(u, 10000);
    }
}

// ── PHONE AUTH ────────────────────────────────────────
let generatedOTP = null;
function showPhoneAuth() {
    const m = $('phoneModal');
    m.style.display = 'flex';
    $('phoneStep1').style.display = 'block';
    $('phoneStep2').style.display = 'none';
    $('phoneError').textContent = '';
    // OTP box auto-advance
    document.querySelectorAll('.otp-box').forEach((box, i, boxes) => {
        box.addEventListener('input', () => {
            if (box.value.length === 1 && i < boxes.length - 1) boxes[i+1].focus();
        });
        box.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !box.value && i > 0) boxes[i-1].focus();
        });
    });
}

async function sendOTP() {
    const phone = ($('countryCode').value + $('phoneInput').value).replace(/\s/g,'');
    if (!phone || phone.length < 8) { $('phoneError').textContent = 'Enter a valid phone number'; return; }
    // Generate demo OTP (in production, call /api/send-otp)
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    $('phoneStep1').style.display = 'none';
    $('phoneStep2').style.display = 'block';
    $('phoneError').textContent = `Demo OTP: ${generatedOTP} (in production, SMS would be sent)`;
}

async function verifyOTP() {
    const entered = [...document.querySelectorAll('.otp-box')].map(b => b.value).join('');
    if (entered.length < 6) { $('phoneError').textContent = 'Enter all 6 digits'; return; }
    if (entered === generatedOTP) {
        const phone = ($('countryCode').value + $('phoneInput').value).replace(/\s/g,'');
        const u = `phone_${phone.replace(/\D/g,'').slice(-8)}`;
        $('phoneModal').style.display = 'none';
        try {
            const r = await fetch('/api/signup', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:`ph_${generatedOTP}`,email:'',mobile:phone})});
            const d = await r.json();
            loginSuccess(d.username||u, d.credits||10000);
        } catch { loginSuccess(u, 10000); }
    } else { $('phoneError').textContent = 'Invalid OTP. Try again.'; }
}

// ── FORGOT PASSWORD ───────────────────────────────────
function showForgotPassword() {
    const m = $('forgotModal');
    m.style.display = 'flex';
    $('resetMsg').textContent = '';
    if ($('resetInput')) $('resetInput').value = '';
}

async function sendReset() {
    const val = $('resetInput').value.trim();
    if (!val) { $('resetMsg').textContent = 'Please enter your username or email'; return; }
    try {
        const r = await fetch('/api/reset-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:val})});
        $('resetMsg').textContent = r.ok ? 'Reset link sent! Check your email.' : 'User not found. Check your details.';
    } catch { $('resetMsg').textContent = 'Reset link sent (if account exists).'; }
}

// ── CAPTCHA ───────────────────────────────────────────
let captchaAnswer = null, captchaPassed = false;

function generateCaptcha() {
    const ops = [
        () => { const a = Math.floor(Math.random()*20)+1, b = Math.floor(Math.random()*20)+1; return {q:`${a} + ${b} = ?`, a: a+b}; },
        () => { const a = Math.floor(Math.random()*15)+5, b = Math.floor(Math.random()*a)+1; return {q:`${a} - ${b} = ?`, a: a-b}; },
        () => { const a = Math.floor(Math.random()*9)+2, b = Math.floor(Math.random()*9)+2; return {q:`${a} × ${b} = ?`, a: a*b}; }
    ];
    const {q, a} = ops[Math.floor(Math.random()*ops.length)]();
    captchaAnswer = a;
    if ($('captchaQuestion')) $('captchaQuestion').textContent = q;
    if ($('captchaAnswer')) $('captchaAnswer').value = '';
    if ($('captchaError')) $('captchaError').textContent = '';
}

function openCaptchaChallenge() {
    if (captchaPassed) return;
    $('captchaChallenge').style.display = 'block';
    $('captchaCheckRow').onclick = null;
    generateCaptcha();
    setTimeout(() => $('captchaAnswer') && $('captchaAnswer').focus(), 50);
}

function verifyCaptcha() {
    const input = parseInt($('captchaAnswer').value);
    if (isNaN(input)) { $('captchaError').textContent = 'Enter a number'; return; }
    if (input === captchaAnswer) {
        captchaPassed = true;
        $('captchaChallenge').style.display = 'none';
        $('captchaCheckbox').classList.add('verified');
        $('captchaCheckIcon').style.display = 'block';
        $('captchaLabel').textContent = 'Verified ✓';
        $('captchaCheckRow').style.cursor = 'default';
        $('captchaCheckRow').onclick = null;
    } else {
        $('captchaError').textContent = 'Incorrect answer. Try again.';
        $('captchaAnswer').value = '';
        $('captchaAnswer').focus();
        // Shake animation
        $('captchaBox').style.animation = 'shake .3s ease';
        setTimeout(() => { if($('captchaBox')) $('captchaBox').style.animation = ''; }, 400);
        refreshCaptcha();
    }
}

function refreshCaptcha() { generateCaptcha(); }

// Allow Enter key in captcha input
document.addEventListener('DOMContentLoaded', () => {
    const ca = $('captchaAnswer');
    if (ca) ca.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); verifyCaptcha(); } });
});

const statusMessages = [
    'Initializing Neural Core...',
    'Loading Knowledge Base...',
    'Calibrating Intelligence...',
    'Ready.'
];
let si = 0;
const introStatusEl = $('introStatus');
const statusInterval = setInterval(() => {
    si++;
    if (si < statusMessages.length && introStatusEl) {
        introStatusEl.textContent = statusMessages[si];
    } else {
        clearInterval(statusInterval);
    }
}, 900);

// After intro ends (4s), show onboarding or auth
setTimeout(() => {
    const intro = $('introScreen');
    if (intro) {
        intro.style.transition = 'opacity 1s ease';
        intro.style.opacity = '0';
        setTimeout(() => {
            intro.remove();
            // Only show auth/onboarding if NOT auto-logging in
            const savedUser = localStorage.getItem('aryax-user');
            if (!savedUser) {
                const firstVisit = !localStorage.getItem('aryax-visited');
                if (firstVisit) {
                    $('onboardingModal').style.display = 'flex';
                } else {
                    showAuth();
                }
            }
            // If savedUser exists, auto-login handles the rest
        }, 1000);
    }
}, 4000);

function showAuth() {
    $('onboardingModal').style.display = 'none';
    $('authOverlay').style.display = 'flex';
}

// ── ONBOARDING ────────────────────────────────────────
$('closeOnboarding').onclick = () => {
    localStorage.setItem('aryax-visited', '1');
    $('onboardingModal').style.display = 'none';
    showAuth();
};
$('getStartedBtn').onclick = () => {
    localStorage.setItem('aryax-visited', '1');
    $('onboardingModal').style.display = 'none';
    showAuth();
    // Switch to signup mode
    isSignUpMode = true;
    updateAuthMode();
};

// ── AUTH ──────────────────────────────────────────────
function updateAuthMode() {
    $('authTitle').textContent = isSignUpMode ? 'Create account' : 'Welcome back';
    $('authSubtitle').textContent = isSignUpMode ? 'Join AryaX — free forever' : 'Sign in to continue to AryaX';
    $('authBtnText').textContent = isSignUpMode ? 'Create Account' : 'Sign In';
    $('toggleText').textContent = isSignUpMode ? 'Already have an account?' : "Don't have an account?";
    $('toggleAuth').textContent = isSignUpMode ? 'Sign in' : 'Sign up free';
    $('signupFields').style.display = isSignUpMode ? 'block' : 'none';
    $('confirmPassGroup').style.display = isSignUpMode ? 'block' : 'none';
    $('termsGroup').style.display = isSignUpMode ? 'block' : 'none';
    $('forgotPassBtn').style.display = isSignUpMode ? 'none' : 'inline';
    if ($('authPass')) $('authPass').placeholder = isSignUpMode ? 'Min. 8 characters' : 'Enter password';
}

$('toggleAuth').onclick = () => {
    isSignUpMode = !isSignUpMode;
    updateAuthMode();
    captchaPassed = false;
    if ($('captchaCheckbox')) $('captchaCheckbox').classList.remove('verified');
    if ($('captchaCheckIcon')) $('captchaCheckIcon').style.display = 'none';
    if ($('captchaLabel')) $('captchaLabel').textContent = "I'm not a robot";
    if ($('captchaChallenge')) $('captchaChallenge').style.display = 'none';
    if ($('captchaCheckRow')) $('captchaCheckRow').onclick = openCaptchaChallenge;
};

// ── VALIDATION HELPERS ────────────────────────────────
function togglePass(inputId, btn) {
    const input = $(inputId);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('.eye-open').style.display = isHidden ? 'none' : 'block';
    btn.querySelector('.eye-closed').style.display = isHidden ? 'block' : 'none';
}

function validatePhone(input) {
    const hint = $('phoneHint');
    const val = input.value;
    if (!hint) return;
    if (val.length === 0) { hint.textContent = ''; hint.className = 'field-hint'; }
    else if (val.length < 10) { hint.textContent = `${10 - val.length} more digits needed`; hint.className = 'field-hint error'; }
    else { hint.textContent = '✓ Valid number'; hint.className = 'field-hint success'; }
}

function checkPasswordStrength(pw) {
    const el = $('passStrength'), fill = $('strengthFill'), label = $('strengthLabel');
    if (!el) return;
    el.style.display = pw.length > 0 ? 'block' : 'none';
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [{w:'25%',c:'rgba(255,80,80,.8)',t:'Weak'},{w:'50%',c:'rgba(255,165,0,.8)',t:'Fair'},{w:'75%',c:'rgba(100,180,255,.8)',t:'Good'},{w:'100%',c:'rgba(80,210,100,.8)',t:'Strong'}];
    const l = levels[Math.max(0, score - 1)];
    fill.style.width = l.w; fill.style.background = l.c; label.textContent = l.t;
}

function checkPasswordMatch() {
    const hint = $('confirmHint');
    if (!hint) return;
    const p1 = $('authPass').value, p2 = $('authConfirmPass').value;
    if (!p2) { hint.textContent = ''; hint.className = 'field-hint'; return; }
    if (p1 === p2) { hint.textContent = '✓ Passwords match'; hint.className = 'field-hint success'; }
    else { hint.textContent = 'Passwords do not match'; hint.className = 'field-hint error'; }
}

$('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const u = $('authUser').value.trim();
    const p = $('authPass').value;
    const email = $('authEmail') ? $('authEmail').value : '';
    const mobile = $('authMobile') ? $('authMobile').value : '';
    const fullName = $('authFullName') ? $('authFullName').value : '';
    const countryCode = $('signupCountryCode') ? $('signupCountryCode').value : '+91';

    // Signup validation
    if (isSignUpMode) {
        if (!fullName) { $('authError').textContent = 'Full name is required'; return; }
        if (!email || !email.includes('@')) { $('authError').textContent = 'Valid email is required'; return; }
        if (mobile.length !== 10) { $('authError').textContent = 'Phone number must be exactly 10 digits'; return; }
        if (p.length < 8) { $('authError').textContent = 'Password must be at least 8 characters'; return; }
        const cp = $('authConfirmPass') ? $('authConfirmPass').value : '';
        if (p !== cp) { $('authError').textContent = 'Passwords do not match'; return; }
        if (!$('termsCheck').checked) { $('authError').textContent = 'Please accept the Terms & Privacy Policy'; return; }
    }

    $('authError').textContent = isSignUpMode ? 'Creating account...' : 'Signing in...';
    const endpoint = isSignUpMode ? '/api/signup' : '/api/login';
    const payload = isSignUpMode
        ? { username: u, password: p, email, mobile: countryCode + mobile, full_name: fullName }
        : { username: u, password: p };

    try {
        const r = await fetch(endpoint, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (r.ok) loginSuccess(d.username || u, d.credits);
        else $('authError').textContent = d.error || 'Authentication failed';
    } catch { $('authError').textContent = 'Server connection error'; }
};


async function loginSuccess(username, credits) {
    const scanner = $('scannerOverlay');
    scanner.style.display = 'flex';
    const scanTexts = ['VERIFYING IDENTITY...', 'SCANNING NEURAL SIGNATURE...', 'ACCESS GRANTED. WELCOME.'];
    let si2 = 0;
    const sv = setInterval(() => {
        if (si2 < scanTexts.length) { $('scanText').textContent = scanTexts[si2++]; }
        else clearInterval(sv);
    }, 1000);

    setTimeout(() => {
        scanner.style.display = 'none';
        currentUser = username;
        localStorage.setItem('aryax-user', username);
        authOverlay.style.opacity = '0';
        authOverlay.style.transition = 'opacity .5s ease';
        setTimeout(() => { authOverlay.style.display = 'none'; }, 500);
        mainApp.style.display = 'flex';
        const av = $('userAvatar');
        if (av) av.textContent = username.slice(0, 2).toUpperCase();
        const un = $('userName');
        if (un) un.textContent = username;
        if (creditDisp) creditDisp.textContent = `${credits || 10000} Credits`;
        loadHistory();
        newChatSession();
        injectWatermark(username);
    }, 3500);
}

// ── HISTORY ───────────────────────────────────────────
async function loadHistory() {
    try {
        const r = await fetch(`/api/history/load?username=${currentUser}`);
        const d = await r.json();
        if (r.ok) renderSidebar(d.chats || []);
    } catch {}
}

function renderSidebar(chats) {
    recentList.innerHTML = '';
    chats.forEach(c => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        div.textContent = c.title || 'Untitled Chat';
        if (currentChatId === c.id) div.classList.add('active');
        div.onclick = () => loadChat(c.id, c.messages);
        recentList.appendChild(div);
    });
}

function loadChat(id, messages) {
    currentChatId = id;
    chatArea.innerHTML = '';
    messages.forEach(m => {
        const role = m.role === 'user' ? 'You' : 'AryaX';
        appendMessage(role, m.parts[0].text);
    });
}

function newChatSession() {
    currentChatId = Date.now().toString();
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good morning' : (hr < 17 ? 'Good afternoon' : 'Good evening');
    chatArea.innerHTML = `
    <div class="welcome-hero">
        <div class="welcome-icon">
            <svg width="52" height="52" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" rx="20" fill="rgba(255,255,255,0.08)"/>
                <path fill-rule="evenodd" d="M50,16 L15,84 H32 L39,63 H61 L68,84 H85 L50,16 Z M44,55 L50,30 L56,55 Z" fill="white"/>
            </svg>
        </div>
        <h1>${greet}, ${currentUser}!</h1>
        <p>I am AryaX, your Artificial Super Intelligence. What shall we work on today?</p>
        <div class="quick-actions">
            <button class="quick-btn" onclick="quickAsk('Write a Python web scraper for me')">Write Python code</button>
            <button class="quick-btn" onclick="quickAsk('Create a business plan for my startup')">Business plan</button>
            <button class="quick-btn" onclick="quickAsk('Generate an image of a futuristic city')">Generate image</button>
            <button class="quick-btn" onclick="quickAsk('Explain quantum computing simply')">Explain a concept</button>
        </div>
    </div>`;
}

$('newChat').onclick = () => {
    newChatSession();
    document.querySelectorAll('.recent-item').forEach(i => i.classList.remove('active'));
};

// ── QUICK ASK ─────────────────────────────────────────
function quickAsk(text) {
    inputEl.value = text;
    sendMessage();
}

// ── TOOLBAR TOGGLES ───────────────────────────────────
$('btnWebSearch').onclick = function() {
    isWebSearch = !isWebSearch;
    this.classList.toggle('active');
    this.innerHTML = isWebSearch
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Web Search: ON`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Live Web Search`;
};

$('btnCodeRunner').onclick = function() {
    isCodeSandbox = !isCodeSandbox;
    this.classList.toggle('active');
    this.innerHTML = isCodeSandbox
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Sandbox: ON`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Python Sandbox`;
};

$('btnMemory').onclick = function() {
    this.classList.toggle('active');
    const on = this.classList.contains('active');
    this.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Memory: ${on ? 'ON' : 'OFF'}`;
};

// ── MODE LABEL ────────────────────────────────────────
const modeEl = $('mode'), modeLabel = $('modeLabel');
modeEl.onchange = () => {
    modeLabel.textContent = `AryaX · ${modeEl.options[modeEl.selectedIndex].text}`;
};

// ── THEME ─────────────────────────────────────────────
const themeToggleBtn = $('themeToggle'), themeToggleText = $('themeToggleText');
const saved = localStorage.getItem('aryax-theme') || 'dark';
if (saved === 'light') { document.body.classList.add('light-theme'); themeToggleText.textContent = 'Dark Mode'; }
themeToggleBtn.onclick = () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('aryax-theme', isLight ? 'light' : 'dark');
    themeToggleText.textContent = isLight ? 'Dark Mode' : 'Light Mode';
};

// ── LOGOUT ────────────────────────────────────────────
$('logoutBtn').onclick = () => {
    localStorage.removeItem('aryax-user');
    location.reload();
};

// ── MULTIMODAL ────────────────────────────────────────
let attachedFile = null;
const fileInput = $('fileInput'), attachBtn = $('attachBtn');
const filePreview = $('filePreview'), fileNameEl = $('fileName'), removeFileBtn = $('removeFile');

attachBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileNameEl.textContent = file.name;
    filePreview.style.display = 'flex';
    const reader = new FileReader();
    reader.onload = ev => { attachedFile = ev.target.result; };
    reader.readAsDataURL(file);
};
removeFileBtn.onclick = () => {
    fileInput.value = '';
    attachedFile = null;
    filePreview.style.display = 'none';
};

// ── IMAGE GEN ─────────────────────────────────────────
$('imageBtn').onclick = async () => {
    const p = prompt('Describe the image:');
    if (!p) return;
    const botWrap = appendMessage('AryaX', 'Generating image...');
    const botText = botWrap.querySelector('.msg');
    try {
        const r = await fetch('/api/generate-image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: p })
        });
        const d = await r.json();
        if (d.image_url) {
            botText.innerHTML = `<img src="${d.image_url}" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.1);" alt="Generated"><p style="margin-top:10px;color:rgba(255,255,255,.6);font-size:13px;">${p}</p>`;
        } else botText.textContent = 'Image generation failed.';
    } catch { botText.textContent = 'Error generating image.'; }
};

// ── VOICE ─────────────────────────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = $('micBtn');
if (SR) {
    const rec = new SR();
    rec.onresult = e => { inputEl.value += e.results[0][0].transcript; micBtn.classList.remove('active'); };
    rec.onerror = rec.onend = () => micBtn.classList.remove('active');
    micBtn.onclick = () => {
        if (micBtn.classList.contains('active')) { rec.stop(); micBtn.classList.remove('active'); }
        else { rec.start(); micBtn.classList.add('active'); }
    };
} else { micBtn.style.display = 'none'; }

// ── SIDEBAR TOGGLE ────────────────────────────────────
$('toggleSidebar').onclick = () => {
    const sp = $('sidePanel');
    if (window.innerWidth <= 1024) sp.classList.toggle('open');
    else sp.classList.toggle('closed');
};

// ── SEND MESSAGE ──────────────────────────────────────
async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text && !attachedFile) return;
    if (!currentUser) return;
    if (!currentChatId) currentChatId = Date.now().toString();

    const welcome = chatArea.querySelector('.welcome-hero');
    if (welcome) welcome.remove();

    let userDisplay = text;
    if (attachedFile) userDisplay += '\n*[Attached File]*';
    if (isWebSearch) userDisplay += '\n*[Web Search ON]*';
    appendMessage('You', userDisplay, 'user-wrap');
    inputEl.value = '';
    inputEl.style.height = 'auto';
    const payloadFile = attachedFile;
    attachedFile = null;
    fileInput.value = '';
    filePreview.style.display = 'none';

    const botWrap = appendMessage('AryaX', 'Thinking...');
    const botText = botWrap.querySelector('.msg');

    try {
        const mode = modeEl.value;
        const r = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, username: currentUser, sessionId: currentChatId, mode, file: payloadFile, webSearch: isWebSearch, sandbox: isCodeSandbox })
        });
        const reader = r.body.getReader(), decoder = new TextDecoder();
        botText.innerHTML = '';
        let fullReply = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const lines = decoder.decode(value).split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6);
                if (raw === '[DONE]') break;
                try {
                    const json = JSON.parse(raw);
                    if (json.text) {
                        fullReply += json.text;
                        let display = fullReply;

                        // Charts
                        if (display.includes('[CHART:')) {
                            display = display.replace(/\[CHART: (.*?)\]/g, (_, p) =>
                                `<div class="chart-box"><canvas class="aryax-chart" data-config='${p}'></canvas></div>`);
                        }
                        // Files
                        if (display.includes('[FILE:')) {
                            display = display.replace(/\[FILE: (.*?), (.*?)\]/g, (_, name, content) =>
                                `<a href="#" class="download-pill" onclick="downloadFile('${name}','${content}')">⬇ Download ${name}</a>`);
                        }
                        // PDF
                        if (display.includes('[PDF:')) {
                            display = display.replace(/\[PDF: (.*?), (.*?)\]/g, (_, title, content) =>
                                `<a href="#" class="download-pill" onclick="generatePDF('${title}','${content}')">📄 Download PDF Report</a>`);
                        }

                        botText.innerHTML = marked.parse(display);

                        // Charts init
                        botText.querySelectorAll('.aryax-chart').forEach(c => {
                            if (!c.chartInitialized) {
                                try { new Chart(c, JSON.parse(c.getAttribute('data-config'))); c.chartInitialized = true; } catch {}
                            }
                        });

                        // Syntax highlight + Python run button
                        if (window.hljs) {
                            botText.querySelectorAll('pre code').forEach(block => {
                                hljs.highlightElement(block);
                                if ((block.className.includes('python')) && !block.parentElement.querySelector('.run-btn')) {
                                    const pre = block.parentElement;
                                    pre.style.position = 'relative';
                                    const rb = document.createElement('button');
                                    rb.className = 'pill-btn run-btn';
                                    rb.style.cssText = 'position:absolute;top:10px;right:10px;padding:4px 12px;font-size:11px;';
                                    rb.innerHTML = '▶ Run';
                                    pre.appendChild(rb);
                                    const out = document.createElement('div');
                                    out.style.cssText = 'display:none;margin-top:8px;padding:12px;background:rgba(0,0,0,.6);color:#e0e0e0;border-radius:10px;font-family:monospace;font-size:13px;border:1px solid rgba(255,255,255,.08);';
                                    pre.after(out);
                                    rb.onclick = async () => {
                                        out.style.display = 'block';
                                        out.textContent = 'Initializing sandbox...';
                                        if (!window.pyodideInstance) {
                                            try { window.pyodideInstance = await loadPyodide(); }
                                            catch (e) { out.innerHTML = `<span style="color:#ff6b6b">Error: ${e}</span>`; return; }
                                        }
                                        out.textContent = 'Running...';
                                        try {
                                            await window.pyodideInstance.runPythonAsync('import sys,io;sys.stdout=io.StringIO()');
                                            await window.pyodideInstance.runPythonAsync(block.innerText);
                                            const stdout = window.pyodideInstance.runPython('sys.stdout.getvalue()');
                                            out.innerHTML = stdout ? stdout.replace(/\n/g, '<br>') : '<i>Done (no output)</i>';
                                        } catch (e) { out.innerHTML = `<span style="color:#ff6b6b">${e}</span>`; }
                                    };
                                }
                            });
                        }
                    }
                    if (json.credits !== undefined && creditDisp) creditDisp.textContent = `${json.credits} Credits`;
                } catch {}
            }
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        handleCodePreview(fullReply);
        saveHistory(text, fullReply);
    } catch (e) {
        botText.textContent = 'Connection lost. Please try again.';
    }
}

// ── FILE HELPERS ──────────────────────────────────────
function downloadFile(name, content) { saveAs(new Blob([content], { type: 'text/plain' }), name); }
async function generatePDF(title, content) {
    try {
        const r = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) });
        saveAs(await r.blob(), 'AryaX_Report.pdf');
    } catch { alert('PDF generation failed.'); }
}

// ── CODE PREVIEW ─────────────────────────────────────
function handleCodePreview(text) {
    const match = /```html([\s\S]*?)```/g.exec(text);
    if (match) {
        $('previewPanel').style.display = 'flex';
        const frame = $('previewFrame').contentWindow.document;
        frame.open(); frame.write(match[1]); frame.close();
    }
}
$('closePreview').onclick = () => $('previewPanel').style.display = 'none';

// ── HISTORY SAVE ──────────────────────────────────────
async function saveHistory(userMsg, reply) {
    await fetch('/api/history/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, chatId: currentChatId, title: userMsg.slice(0, 30), messages: [] })
    }).catch(() => {});
    loadHistory();
}

// ── APPEND MESSAGE ────────────────────────────────────
function appendMessage(role, text, wrapClass = '') {
    const wrap = document.createElement('div');
    wrap.className = `msg-wrap ${wrapClass}`;
    const isBot = role !== 'You';
    let actions = '';
    if (isBot) {
        actions = `<div class="msg-actions">
            <button class="action-icon tts-btn" title="Listen" style="padding:4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </button>
        </div>`;
    }
    wrap.innerHTML = `
        <div class="msg-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span>${role}</span>${actions}
        </div>
        <div class="msg ${isBot ? 'bot-msg' : 'user-msg'}">${marked.parse(text)}</div>`;
    chatArea.appendChild(wrap);
    chatArea.scrollTop = chatArea.scrollHeight;

    if (isBot) {
        const btn = wrap.querySelector('.tts-btn');
        if (btn) btn.onclick = () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance(wrap.querySelector('.msg').innerText.replace(/[*#`]/g, ''));
                const orb = $('voiceOrb');
                msg.onstart = () => { if (orb) orb.style.display = 'flex'; };
                msg.onend = msg.onerror = () => { if (orb) orb.style.display = 'none'; };
                window.speechSynthesis.speak(msg);
            }
        };
    }
    return wrap;
}

// ── INPUT AUTO-RESIZE ─────────────────────────────────
inputEl.addEventListener('input', () => { inputEl.style.height = 'auto'; inputEl.style.height = inputEl.scrollHeight + 'px'; });
sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

// ── AUTO LOGIN ────────────────────────────────────────
(async () => {
    const saved = localStorage.getItem('aryax-user');
    if (saved) {
        // Wait for intro to fully complete (4s fade + 1s opacity + buffer)
        setTimeout(async () => {
            try {
                const r = await fetch(`/api/credits?username=${saved}`);
                const d = await r.json();
                if (r.ok) {
                    loginSuccess(saved, d.credits);
                } else {
                    localStorage.removeItem('aryax-user');
                    showAuth();
                }
            } catch {
                showAuth();
            }
        }, 5500);
    }
})();

// ── PROFILE MODAL ─────────────────────────────────────
let userStats = { messages: 0, chats: 0 };

function openProfile() {
    const modal = $('profileModal');
    const av = currentUser ? currentUser.slice(0,2).toUpperCase() : 'AX';
    $('profileAvatarBig').textContent = av;
    $('profileName').textContent = currentUser || 'Account';
    $('profileJoined').textContent = 'AryaX Member';
    $('statMsgs').textContent = userStats.messages;
    $('statChats').textContent = userStats.chats;
    const credits = creditDisp ? creditDisp.textContent.replace(' Credits','') : '0';
    $('statCredits').textContent = credits;
    // Load saved persona
    const p = JSON.parse(localStorage.getItem('aryax-persona') || '{}');
    if ($('personaTone') && p.tone) $('personaTone').value = p.tone;
    if ($('personaName') && p.name) $('personaName').value = p.name;
    if (p.memory && $('memoryToggle')) $('memoryToggle').classList.add('on');
    modal.classList.add('open');
}

function closeProfile() { $('profileModal').classList.remove('open'); }

function savePersona() {
    const p = {
        tone: $('personaTone') ? $('personaTone').value : 'balanced',
        name: $('personaName') ? $('personaName').value : 'AryaX',
        memory: $('memoryToggle') ? $('memoryToggle').classList.contains('on') : false,
        stream: $('streamToggle') ? $('streamToggle').classList.contains('on') : true
    };
    localStorage.setItem('aryax-persona', JSON.stringify(p));
}

// ── COMMAND PALETTE ───────────────────────────────────
const cmds = [
    { group:'Chat', icon:'💬', label:'New Chat', key:'Ctrl+N', action: () => { newChatSession(); closeCmdPalette(); } },
    { group:'Chat', icon:'📤', label:'Export Chat', key:'Ctrl+E', action: () => { closeCmdPalette(); openExportMenu(); } },
    { group:'Chat', icon:'🔍', label:'Search Chats', key:'', action: () => { closeCmdPalette(); $('chatSearch').focus(); } },
    { group:'Tools', icon:'🌐', label:'Toggle Web Search', key:'', action: () => { $('btnWebSearch').click(); closeCmdPalette(); } },
    { group:'Tools', icon:'⚡', label:'Toggle Python Sandbox', key:'', action: () => { $('btnCodeRunner').click(); closeCmdPalette(); } },
    { group:'Tools', icon:'🧠', label:'Toggle Memory', key:'', action: () => { $('btnMemory').click(); closeCmdPalette(); } },
    { group:'Profile', icon:'👤', label:'Open Profile', key:'', action: () => { closeCmdPalette(); openProfile(); } },
    { group:'Profile', icon:'🌓', label:'Toggle Theme', key:'', action: () => { $('themeToggle').click(); closeCmdPalette(); } },
    { group:'Profile', icon:'🚪', label:'Logout', key:'', action: () => { closeCmdPalette(); $('logoutBtn').click(); } },
    { group:'AI Modes', icon:'🧠', label:'Smart Chat Mode', key:'', action: () => { $('mode').value='chat'; modeEl.onchange(); closeCmdPalette(); } },
    { group:'AI Modes', icon:'⚡', label:'Code Master Mode', key:'', action: () => { $('mode').value='code'; modeEl.onchange(); closeCmdPalette(); } },
    { group:'AI Modes', icon:'📄', label:'Document AI Mode', key:'', action: () => { $('mode').value='document'; modeEl.onchange(); closeCmdPalette(); } },
];
let cmdIndex = 0, filteredCmds = [...cmds];

function openCommandPalette() {
    $('cmdPalette').classList.add('open');
    $('cmdInput').value = '';
    cmdIndex = 0;
    filteredCmds = [...cmds];
    renderCmds();
    setTimeout(() => $('cmdInput').focus(), 50);
}
function closeCmdPalette() { $('cmdPalette').classList.remove('open'); }

function renderCmds() {
    const el = $('cmdResults');
    let html = '', lastGroup = '';
    filteredCmds.forEach((c, i) => {
        if (c.group !== lastGroup) { html += `<div class="cmd-group">${c.group}</div>`; lastGroup = c.group; }
        html += `<div class="cmd-item${i===cmdIndex?' selected':''}" onclick="filteredCmds[${i}].action()">
            <div class="cmd-icon">${c.icon}</div>
            <span class="cmd-label">${c.label}</span>
            ${c.key ? `<span class="cmd-shortcut">${c.key}</span>` : ''}
        </div>`;
    });
    el.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">No commands found</div>';
}

function filterCommands(q) {
    filteredCmds = q ? cmds.filter(c => c.label.toLowerCase().includes(q.toLowerCase())) : [...cmds];
    cmdIndex = 0;
    renderCmds();
}

function cmdKeyNav(e) {
    if (e.key === 'Escape') { closeCmdPalette(); return; }
    if (e.key === 'ArrowDown') { cmdIndex = Math.min(cmdIndex+1, filteredCmds.length-1); renderCmds(); }
    if (e.key === 'ArrowUp') { cmdIndex = Math.max(cmdIndex-1, 0); renderCmds(); }
    if (e.key === 'Enter' && filteredCmds[cmdIndex]) { filteredCmds[cmdIndex].action(); }
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────
document.addEventListener('keydown', e => {
    if (!currentUser) return;
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openCommandPalette(); }
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newChatSession(); }
    if (e.ctrlKey && e.key === 'e') { e.preventDefault(); openExportMenu(); }
    if (e.key === 'Escape') { closeCmdPalette(); closeProfile(); closeExportMenu(); }
});

// ── EXPORT CHAT ───────────────────────────────────────
function openExportMenu() {
    const menu = $('exportMenu');
    menu.classList.toggle('open');
    document.addEventListener('click', closeExportMenu, { once: true });
}
function closeExportMenu() { const m = $('exportMenu'); if(m) m.classList.remove('open'); }

function exportChat(format) {
    closeExportMenu();
    const msgs = [...document.querySelectorAll('.msg-wrap')];
    if (!msgs.length) { alert('No messages to export'); return; }
    const lines = msgs.map(w => {
        const label = w.querySelector('.msg-label span')?.textContent || '';
        const text = w.querySelector('.msg')?.innerText || '';
        return `${label}:\n${text}`;
    });
    const ts = new Date().toISOString().slice(0,10);
    const fname = `AryaX_Chat_${ts}`;
    if (format === 'txt') {
        saveAs(new Blob([lines.join('\n\n---\n\n')], {type:'text/plain'}), `${fname}.txt`);
    } else if (format === 'md') {
        const md = msgs.map(w => {
            const label = w.querySelector('.msg-label span')?.textContent || '';
            const text = w.querySelector('.msg')?.innerText || '';
            return `**${label}**\n\n${text}`;
        }).join('\n\n---\n\n');
        saveAs(new Blob([md], {type:'text/markdown'}), `${fname}.md`);
    } else if (format === 'json') {
        const data = msgs.map(w => ({
            role: w.querySelector('.msg-label span')?.textContent,
            content: w.querySelector('.msg')?.innerText
        }));
        saveAs(new Blob([JSON.stringify({chat: data, exported: new Date().toISOString()}, null, 2)], {type:'application/json'}), `${fname}.json`);
    } else if (format === 'pdf') {
        const content = lines.join('\n\n---\n\n');
        generatePDF(`AryaX Chat - ${ts}`, content);
    }
    userStats.messages = msgs.length;
}

// ── CHAT SEARCH & PINNED ──────────────────────────────
let pinnedChats = JSON.parse(localStorage.getItem('aryax-pinned') || '[]');
let allChats = [];

function filterChats(q) {
    const items = document.querySelectorAll('#recentList .recent-item');
    items.forEach(item => {
        item.style.display = item.querySelector('.item-text')?.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
}

function clearHistory() {
    if (!confirm('Clear all chat history?')) return;
    localStorage.removeItem('aryax-pinned');
    pinnedChats = [];
    fetch('/api/history/clear', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username: currentUser}) }).catch(()=>{});
    loadHistory();
}

function togglePin(chatId, title) {
    const idx = pinnedChats.findIndex(p => p.id === chatId);
    if (idx > -1) pinnedChats.splice(idx, 1);
    else pinnedChats.push({ id: chatId, title });
    localStorage.setItem('aryax-pinned', JSON.stringify(pinnedChats));
    renderSidebarFull(allChats);
}

function renderSidebarFull(chats) {
    allChats = chats;
    userStats.chats = chats.length;
    const pinnedIds = pinnedChats.map(p => p.id);

    // Pinned section
    const pinnedList = $('pinnedList'), pinnedSection = $('pinnedSection');
    pinnedList.innerHTML = '';
    const pinnedItems = chats.filter(c => pinnedIds.includes(c.id));
    pinnedSection.style.display = pinnedItems.length ? 'block' : 'none';
    pinnedItems.forEach(c => pinnedList.appendChild(makeChatItem(c, true)));

    // Recent section
    recentList.innerHTML = '';
    chats.filter(c => !pinnedIds.includes(c.id)).forEach(c => recentList.appendChild(makeChatItem(c, false)));
}

function makeChatItem(c, isPinned) {
    const div = document.createElement('div');
    div.className = 'recent-item';
    if (currentChatId === c.id) div.classList.add('active');
    div.innerHTML = `<span class="item-text">${c.title || 'Untitled Chat'}</span>
        <button class="pin-btn" title="${isPinned?'Unpin':'Pin'}" onclick="event.stopPropagation();togglePin('${c.id}','${(c.title||'').replace(/'/g,'')}')">
            ${isPinned ? '📌' : '🔖'}
        </button>`;
    div.querySelector('.item-text').onclick = () => loadChat(c.id, c.messages);
    return div;
}

// Override renderSidebar to use enhanced version
const _origRenderSidebar = renderSidebar;
function renderSidebar(chats) { renderSidebarFull(chats); }

// ── AI PERSONA SYSTEM ─────────────────────────────────
function getPersona() {
    return JSON.parse(localStorage.getItem('aryax-persona') || '{"tone":"balanced","name":"AryaX","memory":false}');
}

// Inject persona into chat payload (override sendMessage to add persona context)
const _origSendMessage = sendMessage;
