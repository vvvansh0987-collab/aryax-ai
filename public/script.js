// ── HELPERS ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const chatArea = $('chat'), inputEl = $('input'), sendBtn = $('send');
const authOverlay = $('authOverlay'), mainApp = $('mainApp');
const recentList = $('recentList'), creditDisp = $('creditDisplay');

let currentUser = null, currentChatId = null;
let isSignUpMode = false, isWebSearch = false, isCodeSandbox = false;

// ── INTRO SEQUENCE ────────────────────────────────────
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
    $('authSubtitle').textContent = isSignUpMode ? 'Join AryaX for free' : 'Sign in to continue to AryaX';
    $('authBtnText').textContent = isSignUpMode ? 'Create Account' : 'Sign In';
    $('toggleText').textContent = isSignUpMode ? 'Already have an account?' : "Don't have an account?";
    $('toggleAuth').textContent = isSignUpMode ? 'Sign in' : 'Sign up free';
    $('signupFields').style.display = isSignUpMode ? 'block' : 'none';
}

$('toggleAuth').onclick = () => {
    isSignUpMode = !isSignUpMode;
    updateAuthMode();
};

$('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const u = $('authUser').value.trim();
    const p = $('authPass').value;
    const email = $('authEmail') ? $('authEmail').value : '';
    const mobile = $('authMobile') ? $('authMobile').value : '';
    $('authError').textContent = isSignUpMode ? 'Creating account...' : 'Signing in...';
    const endpoint = isSignUpMode ? '/api/signup' : '/api/login';
    const payload = isSignUpMode ? { username: u, password: p, email, mobile } : { username: u, password: p };
    try {
        const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (r.ok) {
            loginSuccess(d.username || u, d.credits);
        } else {
            $('authError').textContent = d.error || 'Authentication failed';
        }
    } catch {
        $('authError').textContent = 'Server connection error';
    }
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
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
                <path d="M50 10L10 80H35L50 50L65 80H90L50 10Z" fill="#7c6df0" opacity=".9"/>
                <path d="M25 60H75" stroke="#00d4aa" stroke-width="6" stroke-linecap="round"/>
            </svg>
        </div>
        <h1>${greet}, ${currentUser}!</h1>
        <p>I am AryaX, your Artificial Super Intelligence. What shall we work on today?</p>
        <div class="quick-actions">
            <button class="quick-btn" onclick="quickAsk('Write a Python web scraper for me')">⚡ Write Python code</button>
            <button class="quick-btn" onclick="quickAsk('Create a business plan for my startup')">💼 Business plan</button>
            <button class="quick-btn" onclick="quickAsk('Generate an image of a futuristic city')">🎨 Generate image</button>
            <button class="quick-btn" onclick="quickAsk('Explain quantum computing simply')">🔬 Explain a concept</button>
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
    modeLabel.textContent = `AryaX · ${modeEl.options[modeEl.selectedIndex].text.replace(/^[^\s]+\s/, '')}`;
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
    if (isWebSearch) userDisplay += '\n*[🌐 Web Search ON]*';
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
                                    out.style.cssText = 'display:none;margin-top:8px;padding:12px;background:rgba(0,0,0,.8);color:#00d4aa;border-radius:10px;font-family:monospace;font-size:13px;';
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
