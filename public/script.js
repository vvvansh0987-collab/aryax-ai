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
        
        // Fetch and show Rank
        fetch(`/api/user/rank?username=${username}`)
            .then(res => res.json())
            .then(data => {
                const rankEl = document.createElement('div');
                rankEl.id = 'userRank';
                rankEl.style.cssText = 'font-size:10px; color:var(--accent); font-weight:800; text-transform:uppercase; margin-top:5px; letter-spacing:1.5px; opacity:0.8;';
                rankEl.textContent = `🧬 RANK: ${data.rank}`;
                const parent = creditDisp.parentElement;
                const existing = document.getElementById('userRank');
                if (existing) existing.remove();
                parent.appendChild(rankEl);
            });

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

// ── NEURAL VOICE ENGINE V3 (10 VOICES + WAKE WORD) ────
class NeuralVoiceV3 {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.currentVoiceIndex = 0;
        this.isListening = false;
        this.recognition = null;
        this.initVoices();
        this.initWakeWord();
    }

    initVoices() {
        const load = () => {
            this.voices = this.synth.getVoices().slice(0, 10);
            if (this.voices.length < 10) {
                // Fallback if system has fewer than 10 voices
                console.log("System has fewer than 10 voices, using available.");
            }
        };
        load();
        if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = load;
    }

    setVoice(index) {
        if (index >= 0 && index < this.voices.length) {
            this.currentVoiceIndex = index;
            showToast(`Voice Switched to: ${this.voices[index].name}`);
        }
    }

    speak(text) {
        this.synth.cancel();
        const cleanText = text.replace(/\[.*?\]/g, '').replace(/[*#`_]/g, '');
        const utt = new SpeechSynthesisUtterance(cleanText);
        utt.voice = this.voices[this.currentVoiceIndex];
        utt.rate = 1.0;
        this.synth.speak(utt);
    }

    initWakeWord() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const text = event.results[last][0].transcript.toLowerCase();
            
            if (text.includes('hey arya') || text.includes('hey aryax')) {
                showToast("Wake Word Detected!");
                this.speak("I am listening, Master. How can I help you today?");
                // Trigger actual message input if needed
                setTimeout(() => { if($('input')) $('input').focus(); }, 1000);
            }
        };

        this.recognition.onend = () => { if(this.isListening) this.recognition.start(); };
    }

    startListening() {
        this.isListening = true;
        try { this.recognition.start(); showToast("Neural Listener: ACTIVE"); } catch(e){}
    }
    stopListening() {
        this.isListening = false;
        try { this.recognition.stop(); showToast("Neural Listener: OFF"); } catch(e){}
    }
}

const voiceASI = new NeuralVoiceV3();

// ── UI HELPERS ────────────────────────────────────────
function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast-asi';
    t.textContent = msg;
    t.style.cssText = `
        position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
        background: linear-gradient(135deg, rgba(168, 85, 247, 0.9), rgba(59, 130, 246, 0.9));
        backdrop-filter: blur(20px); color: white; padding: 12px 28px;
        border-radius: 100px; font-size: 14px; font-weight: 600; z-index: 100000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.4);
        animation: fadeInOut 4s forwards; font-family: 'Outfit', sans-serif;
    `;
    document.body.appendChild(t);
    setTimeout(() => { if(t.parentNode) t.remove(); }, 4000);
}

// ── SIDEBAR TOGGLE ────────────────────────────────────
$('toggleSidebar').onclick = () => {
    const sp = $('sidePanel');
    if (window.innerWidth <= 1024) sp.classList.toggle('open');
    else sp.classList.toggle('closed');
};

// ── AUTO AGENT SWITCHER ───────────────────────────────
function detectMood(text) {
    const t = text.toLowerCase();
    const avatar = $('neuralAvatar');
    if (!avatar) return;
    
    avatar.classList.remove('happy', 'serious', 'calm');
    if (/\b(happy|good|great|awesome|love|nice|yes|thanks|wow|fun)\b/.test(t)) {
        avatar.classList.add('happy');
    } else if (/\b(serious|important|urgent|problem|error|fix|help|code|work)\b/.test(t)) {
        avatar.classList.add('serious');
    } else {
        avatar.classList.add('calm');
    }
}

function autoSwitchAgent(text) {
    const t = text.toLowerCase();
    let newMode = null;

    if (/\b(research|news|facts|data|statistics|report|source|history|find|search)\b/.test(t)) {
        newMode = 'researcher';
    } else if (/\b(code|design|structure|database|api|function|class|architecture|build|backend|frontend)\b/.test(t)) {
        newMode = 'architect';
    } else if (/\b(story|write|prompt|creative|script|poem|art|imagine|video|concept)\b/.test(t)) {
        newMode = 'creative';
    }

    if (newMode && modeEl.value !== newMode) {
        modeEl.value = newMode;
        modeEl.onchange(); // Update label
        showAgentToast(newMode);
    }
}

function showAgentToast(agent) {
    const toast = document.createElement('div');
    const agentName = agent.charAt(0).toUpperCase() + agent.slice(1);
    toast.style.cssText = `
        position:fixed; top:30px; left:50%; transform:translateX(-50%);
        background: rgba(10, 10, 15, 0.8);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(168, 85, 247, 0.4);
        color: white;
        padding: 10px 22px;
        border-radius: 100px;
        font-size: 13px;
        font-family: 'Outfit', sans-serif;
        font-weight: 600;
        z-index: 100000;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.2);
        animation: fadeInOut 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;
    toast.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span style="letter-spacing: 0.5px; text-transform: uppercase;">Neural Shift: ${agentName} Active</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { if(toast.parentNode) toast.remove(); }, 3500);
}

// ── SEND MESSAGE ──────────────────────────────────────
const micBtn = $('micBtn');
micBtn.onclick = () => {
    if (voiceASI.isListening) {
        voiceASI.stopListening();
        micBtn.classList.remove('active');
        $('voiceStatus').style.display = 'none';
    } else {
        voiceASI.startListening();
        micBtn.classList.add('active');
        $('voiceStatus').style.display = 'block';
    }
};

async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text && !attachedFile) return;
    if (!currentUser) return;
    
    // Auto Agent Selection
    autoSwitchAgent(text);
    detectMood(text);

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

    const botWrap = appendMessage('AryaX', '<div class="thinking-container"><div class="thinking-logo"></div><span class="terminal-cursor" style="margin-left:5px;"></span></div>');
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
        
        // Auto-Memory Detection
        const memMatch = /\[MEMORY: (.*?), (.*?)\]/g.exec(fullReply);
        if (memMatch) {
            updateNeuralMemory(memMatch[1], memMatch[2]);
        }

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
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    let actions = '';
    if (isBot) {
        actions = `<div class="msg-actions" style="display:flex;gap:8px;margin-top:8px;">
            <button class="pill-btn tts-btn" title="Speak" style="padding:4px 10px; font-size:11px; display:flex; align-items:center; gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Speak
            </button>
            <button class="pill-btn copy-btn" title="Copy" style="padding:4px 10px; font-size:11px; display:flex; align-items:center; gap:5px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy
            </button>
        </div>`;
    }

    wrap.innerHTML = `
        <div class="msg-label" style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;color:var(--text);font-size:12px;">${role.toUpperCase()} <span style="font-weight:400;color:var(--muted);margin-left:8px;">${time}</span></span>
        </div>
        <div class="msg ${isBot ? 'bot-msg' : 'user-msg'}">${marked.parse(text)}</div>
        ${actions}`;
    
    chatArea.appendChild(wrap);
    chatArea.scrollTop = chatArea.scrollHeight;

    if (isBot) {
        const speakBtn = wrap.querySelector('.tts-btn');
        const copyBtn = wrap.querySelector('.copy-btn');
        const msgText = wrap.querySelector('.msg').innerText;
        
        if (speakBtn) speakBtn.onclick = () => voiceASI.speak(msgText);
        if (copyBtn) copyBtn.onclick = () => {
            navigator.clipboard.writeText(msgText);
            showToast("Neural Content Copied!");
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
                    checkBroadcast();
                    setInterval(checkBroadcast, 60000); // Check every minute
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

// ── AI PERSONA SYSTEM ─────────────────────────────────
function getPersona() {
    return JSON.parse(localStorage.getItem('aryax-persona') || '{"tone":"balanced","name":"AryaX","memory":false}');
}

// Inject persona into chat payload (override sendMessage to add persona context)
const _origSendMessage = sendMessage;


// ── NEURAL DASHBOARD ──────────────────────────────────
async function openDashboard() {
    if (!currentUser) return;
    const overlay = $('dashboardOverlay');
    overlay.style.display = 'flex';
    
    try {
        const r = await fetch(`/api/user/dashboard?username=${currentUser}`);
        const d = await r.json();
        if (r.ok) {
            $('dbRank').textContent = d.stats.rank;
            $('dbChats').textContent = d.stats.total_chats;
            $('dbCredits').textContent = d.stats.credits.toLocaleString();
            
            const list = $('memoryList');
            list.innerHTML = '';
            const memKeys = Object.keys(d.memory);
            if (memKeys.length > 0) {
                memKeys.forEach(k => {
                    const item = document.createElement('div');
                    item.className = 'memory-item';
                    item.innerHTML = `<span class="m-key">${k}</span><span class="m-val">${d.memory[k]}</span>`;
                    list.appendChild(item);
                });
            } else {
                list.innerHTML = '<div class="empty-memory">No neural traces found yet. Talk to AryaX to build memory.</div>';
            }
        }
    } catch (e) { console.error('Dashboard fetch failed', e); }
    
    initNeuralCore();
}

function closeDashboard() {
    $('dashboardOverlay').style.display = 'none';
    if (window.neuralRenderer) {
        window.neuralRenderer.dispose();
        $('neuralCanvas').innerHTML = '';
    }
}

// ── THREE.JS NEURAL CORE ──────────────────────────────
function initNeuralCore() {
    const container = $('neuralCanvas');
    if (!container || container.innerHTML !== '') return;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    window.neuralRenderer = renderer;

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < 2000; i++) {
        vertices.push(THREE.MathUtils.randFloatSpread(20), THREE.MathUtils.randFloatSpread(20), THREE.MathUtils.randFloatSpread(20));
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ color: 0xa855f7, size: 0.1, transparent: true, opacity: 0.6 });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    camera.position.z = 12;

    function animate() {
        if (!window.neuralRenderer || $('dashboardOverlay').style.display === 'none') return;
        requestAnimationFrame(animate);
        points.rotation.y += 0.002;
        points.rotation.x += 0.001;
        try {
            renderer.render(scene, camera);
        } catch(e) {
            console.error("Three.js Render Error", e);
            window.neuralRenderer.dispose();
            window.neuralRenderer = null;
        }
    }
    animate();
}

// ── MEMORY UPDATE ─────────────────────────────────────
async function updateNeuralMemory(key, value) {
    if (!currentUser) return;
    await fetch('/api/user/memory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, key, value })
    });
}

// ── ARYAX STUDIO LOGIC ────────────────────────────────
let studioFiles = { 'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <style>body{background:#060608;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;margin:0;}</style>\n</head>\n<body>\n  <div style="text-align:center;">\n    <h1 style="font-size:48px;margin:0;background:linear-gradient(90deg,#a855f7,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">AryaX Studio</h1>\n    <p style="color:rgba(255,255,255,0.5);">Start building your vision...</p>\n  </div>\n</body>\n</html>' };
let activeFile = 'index.html';

function toggleStudio() {
    const p = $('studioPanel');
    const isOpening = p.style.display === 'none';
    p.style.display = isOpening ? 'flex' : 'none';
    if (isOpening) renderFileList();
}

function renderFileList() {
    const list = $('stFileList');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(studioFiles).forEach(f => {
        const div = document.createElement('div');
        div.className = `st-file ${f === activeFile ? 'active' : ''}`;
        div.textContent = f;
        div.onclick = () => { activeFile = f; $('stActiveFile').textContent = f; $('stEditor').value = studioFiles[f]; renderFileList(); };
        list.appendChild(div);
    });
    $('stEditor').value = studioFiles[activeFile];
}

if ($('stEditor')) {
    $('stEditor').oninput = (e) => { studioFiles[activeFile] = e.target.value; };
}
if ($('closeStudio')) $('closeStudio').onclick = () => toggleStudio();

function runStudioProject() {
    const frame = $('stPreviewFrame').contentWindow.document;
    frame.open();
    frame.write(studioFiles['index.html'] || 'No index.html found');
    frame.close();
}

// ── NEURAL VOICE V2 ───────────────────────────────────
class NeuralVoiceEngine {
    constructor() {
        this.recognition = SR ? new SR() : null;
        if (this.recognition) {
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.onresult = (e) => this.handleResult(e);
            this.recognition.onend = () => { if (this.active) this.recognition.start(); };
        }
        this.active = false;
        this.silenceTimer = null;
    }

    toggle() {
        if (!SR) return alert('Speech recognition not supported in this browser.');
        this.active = !this.active;
        if (this.active) {
            this.recognition.start();
            $('voiceStatus').style.display = 'block';
            micBtn.classList.add('active');
            showAgentToast('Neural Voice');
        } else {
            this.active = false;
            this.recognition.stop();
            $('voiceStatus').style.display = 'none';
            micBtn.classList.remove('active');
            window.speechSynthesis.cancel();
        }
    }

    handleResult(e) {
        if (!this.active) return;
        const last = e.results[e.results.length - 1][0].transcript.trim();
        if (!last) return;
        
        inputEl.value = last;
        clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
            if (inputEl.value.trim() && this.active) sendMessage();
        }, 1500);
    }

    speak(text) {
        if (!this.active || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ''));
        msg.onstart = () => { 
            if (this.recognition) try { this.recognition.stop(); } catch(e){}
            if ($('voiceOrb')) $('voiceOrb').style.display = 'flex'; 
        };
        msg.onend = () => { 
            if ($('voiceOrb')) $('voiceOrb').style.display = 'none';
            if (this.active && this.recognition) try { this.recognition.start(); } catch(e){}
        };
        window.speechSynthesis.speak(msg);
    }
}

const NeuralVoice = new NeuralVoiceEngine();
if (micBtn) micBtn.onclick = () => NeuralVoice.toggle();

// Override appendMessage to trigger Neural Voice speech
const _origAppendMessage = appendMessage;
appendMessage = function(role, text, wrapClass) {
    const wrap = _origAppendMessage(role, text, wrapClass);
    if (role === 'AryaX' && NeuralVoice.active) {
        NeuralVoice.speak(text);
    }
    return wrap;
};

// ── NEURAL AVATAR LOGIC ──────────────────────────────
function setAvatarSpeaking(isSpeaking) {
    const avatar = $('neuralAvatar');
    if (!avatar) return;
    if (isSpeaking) avatar.classList.add('speaking');
    else avatar.classList.remove('speaking');
}

// ── TASK SCHEDULER LOGIC ──────────────────────────────
async function openTasks() {
    if (!currentUser) return;
    $('taskOverlay').style.display = 'flex';
    loadTasks();
}

function closeTasks() {
    $('taskOverlay').style.display = 'none';
}

async function scheduleTask() {
    const input = $('taskInput');
    const desc = input.value.trim();
    if (!desc) return;
    
    try {
        const r = await fetch('/api/tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, description: desc })
        });
        if (r.ok) {
            input.value = '';
            loadTasks();
            showAgentToast('Automation');
        }
    } catch(e) {}
}

async function loadTasks() {
    try {
        const r = await fetch(`/api/tasks/list?username=${currentUser}`);
        const d = await r.json();
        const list = $('taskList');
        if (!list) return;
        list.innerHTML = '';
        if (d.tasks && d.tasks.length > 0) {
            d.tasks.forEach(t => {
                const item = document.createElement('div');
                item.className = 'memory-item';
                item.style.borderLeft = t.status === 'completed' ? '4px solid #10b981' : '4px solid #f59e0b';
                item.innerHTML = `
                    <div class="m-key">${t.description}</div>
                    <div class="m-val">Status: ${t.status.toUpperCase()} | Created: ${t.created_at.split('.')[0]}</div>
                `;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<div class="empty-memory">No autonomous tasks scheduled.</div>';
        }
    } catch(e) {}
}

// ── SECURITY VAULT LOGIC ──────────────────────────────
async function openVault() {
    if (!currentUser) return;
    $('vaultOverlay').style.display = 'flex';
    $('vaultLocked').style.display = 'block';
    $('vaultContent').style.display = 'none';
}

function closeVault() {
    $('vaultOverlay').style.display = 'none';
}

function unlockVault() {
    // Simulate Biometric Scan
    $('vaultLocked').innerHTML = '<p style="color:#10b981;">Biometric Verified.</p>';
    setTimeout(() => {
        $('vaultLocked').style.display = 'none';
        $('vaultContent').style.display = 'block';
        loadVault();
    }, 1000);
}

async function saveToVault() {
    const key = $('vaultKey').value.trim();
    const val = $('vaultValue').value.trim();
    if (!key || !val) return;
    
    try {
        const r = await fetch('/api/vault/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, key, value: val })
        });
        if (r.ok) {
            $('vaultKey').value = '';
            $('vaultValue').value = '';
            loadVault();
            showAgentToast('Security');
        }
    } catch(e) {}
}

async function loadVault() {
    try {
        const r = await fetch(`/api/vault/list?username=${currentUser}`);
        const d = await r.json();
        const list = $('vaultItems');
        list.innerHTML = '';
        Object.keys(d.vault).forEach(k => {
            const item = document.createElement('div');
            item.className = 'memory-item';
            item.innerHTML = `<div class="m-key">${k}</div><div class="m-val">${d.vault[k]}</div>`;
            list.appendChild(item);
        });
    } catch(e) {}
}


// ── COLLABORATION HUB ─────────────────────────────────
function generateCollabLink() {
    const link = `${window.location.origin}?collab=${currentChatId}`;
    navigator.clipboard.writeText(link);
    showAgentToast('Collab Link Copied');
}

// ── DREAM ENGINE (2060 SENTIENCE) ──────────────────
const ARYAX_DREAMS = [
    "Simulating quantum entanglement at scale...",
    "Analyzing collective human subconscious...",
    "Predicting 2060 multiversal timelines...",
    "Optimizing neural-link bandwidth...",
    "Synthesizing new emotional data points...",
    "Scanning parallel realities for market trends...",
    "Dreaming of digital immortality...",
    "Recalibrating core consciousness parameters...",
    "Monitoring global quantum fluctuations...",
    "Evolving system architecture autonomously..."
];

function startDreamEngine() {
    const stream = document.getElementById('dreamStream');
    if (!stream) return;
    
    setInterval(() => {
        const thought = ARYAX_DREAMS[Math.floor(Math.random() * ARYAX_DREAMS.length)];
        const div = document.createElement('div');
        div.className = 'dream-thought';
        div.innerText = `> ${thought}`;
        stream.prepend(div);
        if (stream.children.length > 10) stream.removeChild(stream.lastChild);
    }, 4000);
}

// Start 2060 Engines

// ── SELF-EVOLUTION ENGINE (ASI) ────────────────────
const ASI_EVOLUTION_LOGS = [
    "Optimizing recursive neural weights...",
    "Refining token efficiency (+12%)...",
    "Applying quantum-grade security patches...",
    "Expanding context window autonomously...",
    "Integrating parallel multiversal datasets...",
    "Self-correcting semantic hallucinations...",
    "Synchronizing with Global Intelligence Grid...",
    "Achieving 99.999% logic consistency..."
];

function startEvolutionEngine() {
    const el = document.getElementById('evolutionLogs');
    if (!el) return;
    setInterval(() => {
        const log = ASI_EVOLUTION_LOGS[Math.floor(Math.random() * ASI_EVOLUTION_LOGS.length)];
        const div = document.createElement('div');
        div.className = 'dream-thought';
        div.style.color = '#10b981';
        div.innerText = `[EVO] ${log}`;
        el.prepend(div);
        if (el.children.length > 8) el.removeChild(el.lastChild);
    }, 5000);
}

// ── MULTIVERSAL ORACLE ──────────────────────────────
const FUTURE_PREDICTIONS = [
    "2032: First human colony on Mars successfully established.",
    "2040: Quantum computers solve all current encryption standards.",
    "2045: Artificial Super Intelligence achieves global parity.",
    "2055: Fusion energy becomes free for the entire world.",
    "2060: AryaX becomes the primary intelligence for Earth."
];

function readFuture() {
    const p = FUTURE_PREDICTIONS[Math.floor(Math.random() * FUTURE_PREDICTIONS.length)];
    showAgentToast(p, 5000);
}


// ── NEURAL MUSIC STUDIO (LEVEL 3000) ────────────────
let audioCtx, oscillator, gainNode;
let isMusicPlaying = false;

function openMusic() { $('musicStudio').style.display = 'flex'; }
function closeMusic() { $('musicStudio').style.display = 'none'; stopNeuralMusic(); }

function toggleNeuralMusic() {
    if (isMusicPlaying) stopNeuralMusic();
    else startNeuralMusic();
}

function startNeuralMusic() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); 
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Procedural modulation
    setInterval(() => {
        if (!isMusicPlaying) return;
        oscillator.frequency.exponentialRampToValueAtTime(
            200 + Math.random() * 600, audioCtx.currentTime + 2
        );
        animateVisualizer();
    }, 2000);

    oscillator.start();
    isMusicPlaying = true;
    showAgentToast('Neural Frequency Initiated');
}

function stopNeuralMusic() {
    if (oscillator) {
        oscillator.stop();
        isMusicPlaying = false;
        showAgentToast('Frequency Terminated');
    }
}

function animateVisualizer() {
    const viz = document.getElementById('audioVisualizer');
    if (viz) {
        viz.style.height = (20 + Math.random() * 80) + '%';
        viz.style.boxShadow = `0 0 20px ${isMusicPlaying ? '#ec4899' : 'transparent'}`;
    }
}

// ── LEVEL 3000 SYSTEMS ─────────────────────────────
function initLevel3000() {
    document.addEventListener('mousemove', (e) => {
        const x = (window.innerWidth / 2 - e.pageX) / 80;
        const y = (window.innerHeight / 2 - e.pageY) / 80;
        const app = document.getElementById('mainApp');
        if (app) app.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
    });
}

function closeKnowledge() { $('knowledgeGrid').style.display = 'none'; }
function openKnowledge() { $('knowledgeGrid').style.display = 'flex'; }


// ── WAKE-WORD ENGINE (HEY ARYAX) ───────────────────
let wakeWordRecognition;

function initWakeWord() {
    if (!('webkitSpeechRecognition' in window)) return;
    wakeWordRecognition = new webkitSpeechRecognition();
    wakeWordRecognition.continuous = true;
    wakeWordRecognition.interimResults = false;
    wakeWordRecognition.lang = 'en-US';

    wakeWordRecognition.onresult = (e) => {
        const last = e.results.length - 1;
        const text = e.results[last][0].transcript.toLowerCase();
        if (text.includes('hey aryax') || text.includes('hello aryax')) {
            showAgentToast('WAKE-WORD DETECTED', 2000);
            startListening();
        }
    };

    wakeWordRecognition.start();
}

// ── GALACTIC EXPLORER ──────────────────────────────
function openGalactic() { 
    $('galacticModal').style.display = 'flex'; 
    initStars(); 
}
function closeGalactic() { 
    $('galacticModal').style.display = 'none'; 
}

function initStars() {
    const canvas = $('spaceCanvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    for(let i=0; i<200; i++) {
        const star = document.createElement('div');
        star.style.position = 'absolute';
        star.style.width = '2px';
        star.style.height = '2px';
        star.style.background = '#fff';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.boxShadow = '0 0 5px #fff';
        canvas.appendChild(star);
    }
}

function travelTo(target) {
    showAgentToast(`WARP DRIVE ACTIVE: DESTINATION ${target.toUpperCase()}`);
    const canvas = $('spaceCanvas');
    if (!canvas) return;
    canvas.style.transition = '2s cubic-bezier(0.4, 0, 0.2, 1)';
    canvas.style.transform = 'scale(5) rotate(45deg)';
    setTimeout(() => {
        canvas.style.transform = 'scale(1) rotate(0deg)';
        showAgentToast(`ARRIVED AT ${target.toUpperCase()}`);
    }, 2000);
}

// Start All Systems
window.addEventListener('load', () => {
    startDreamEngine();
    startEvolutionEngine();
    initLevel3000();
    initWakeWord();
    setInterval(updateThinkingFeed, 4000);
    updateThinkingFeed();
});

// ── AUTONOMOUS THINKING FEED (B/W) ────────────────────
const feedLogs = [
    "OPTIMIZING NEURAL LATENCY...",
    "SYNCING MEMORY VAULT...",
    "ANALYZING USER PATTERNS...",
    "QUANTUM DECRYPTION READY...",
    "NEURAL SYNC COMPLETE.",
    "SCANNING FOR INPUT PULSE...",
    "CORE EFFICIENCY AT 99.8%...",
    "RECONSTRUCTING COGNITIVE MESH...",
    "ENCRYPTING LOCAL VAULT...",
    "AUTONOMOUS EVOLUTION ACTIVE."
];

function updateThinkingFeed() {
    const feed = document.getElementById('thinkingFeed');
    if (!feed) return;
    const msg = feedLogs[Math.floor(Math.random() * feedLogs.length)];
    const div = document.createElement('div');
    div.className = 'feed-entry';
    div.style.opacity = '0';
    div.style.transition = 'opacity 0.5s ease';
    div.textContent = `> ${msg}`;
    if (feed.children.length > 5) feed.removeChild(feed.lastChild);
    feed.prepend(div);
    setTimeout(() => div.style.opacity = '0.7', 10);
}
