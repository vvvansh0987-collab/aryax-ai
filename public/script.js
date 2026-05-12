const $ = id => document.getElementById(id);
const chatArea = $("chat"), input = $("input"), sendBtn = $("send");
const authOverlay = $("authOverlay"), mainApp = $("mainApp");
const recentList = $("recentList"), userNameDisp = $("userName"), creditDisp = $("creditCount");

let currentUser = null;
let currentChatId = null;

// AUTH
$("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const u = $("loginUser").value.trim();
    const p = $("loginPass").value;
    $("loginError").textContent = "Establishing Neural Link...";
    
    try {
        const r = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u, password: p })
        });
        const d = await r.json();
        if (r.ok) {
            loginSuccess(d.username, d.credits);
        } else {
            $("loginError").textContent = d.error;
        }
    } catch {
        $("loginError").textContent = "Neural bridge failed. (Server Error)";
    }
});

async function loginSuccess(username, credits) {
    currentUser = username;
    localStorage.setItem("aryax-user", username);
    authOverlay.style.opacity = "0";
    authOverlay.style.transform = "scale(1.1)";
    setTimeout(() => authOverlay.style.display = "none", 500);
    mainApp.style.display = "flex";
    if (userNameDisp) userNameDisp.textContent = username.slice(0, 2).toUpperCase();
    if (creditDisp) creditDisp.textContent = `${credits} Credits`;
    loadHistory();
}

$("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("aryax-user");
    location.reload();
});

// HISTORY
async function loadHistory() {
    try {
        const r = await fetch(`/api/history/load?username=${currentUser}`);
        const d = await r.json();
        if (r.ok) {
            renderSidebar(d.chats || []);
        }
    } catch (e) { console.error("History failed", e); }
}

function renderSidebar(chats) {
    recentList.innerHTML = "";
    chats.forEach(c => {
        const div = document.createElement("div");
        div.className = "recent-item";
        div.textContent = c.title || "Untitled Session";
        if (currentChatId === c.id) div.classList.add("active");
        div.onclick = () => loadChat(c.id, c.messages);
        recentList.appendChild(div);
    });
}

function loadChat(id, messages) {
    currentChatId = id;
    chatArea.innerHTML = "";
    messages.forEach(m => {
        const role = m.role === "user" ? "USER" : "ARYAX";
        appendMessage(role, m.parts[0].text);
    });
    // Update active state in sidebar
    document.querySelectorAll(".recent-item").forEach(item => {
        item.classList.toggle("active", item.textContent === (messages[0]?.parts[0].text.slice(0, 30) || "Untitled Session"));
    });
}

$("newChat").onclick = () => {
    currentChatId = Date.now().toString();
    chatArea.innerHTML = '<div class="welcome-hero"><h1>What\'s on the agenda today?</h1></div>';
    document.querySelectorAll(".recent-item").forEach(i => i.classList.remove("active"));
};

// CHAT
async function sendMessage() {
    const text = input.value.trim();
    if (!text || !currentUser) return;
    
    if (!currentChatId) currentChatId = Date.now().toString();
    
    // Remove welcome msg if present
    const welcome = chatArea.querySelector(".welcome-hero");
    if (welcome) welcome.remove();

    appendMessage("USER", text);
    input.value = "";
    input.style.height = "auto";
    
    const botWrap = appendMessage("ARYAX", "Synthesizing...");
    const botText = botWrap.querySelector(".msg");

    try {
        const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, username: currentUser, sessionId: currentChatId })
        });
        
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        botText.innerHTML = "";
        let fullReply = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            for (let line of lines) {
                if (line.startsWith("data: ")) {
                    const raw = line.slice(6);
                    if (raw === "[DONE]") break;
                    try {
                        const json = JSON.parse(raw);
                        if (json.text) {
                            fullReply += json.text;
                            botText.innerHTML = marked.parse(fullReply);
                        }
                        if (json.credits !== undefined && creditDisp) {
                            creditDisp.textContent = `${json.credits} Credits`;
                        }
                    } catch {}
                }
            }
            chatArea.scrollTop = chatArea.scrollHeight;
        }
        
        saveCurrentHistory();

    } catch (e) {
        botText.textContent = "Neural connection lost.";
        console.error(e);
    }
}

async function saveCurrentHistory() {
    const messages = [];
    chatArea.querySelectorAll(".msg-wrap").forEach(wrap => {
        const label = wrap.querySelector(".msg-label").textContent;
        const role = label === "USER" ? "user" : "model";
        const text = wrap.querySelector(".msg").innerText;
        messages.push({ role, parts: [{ text }] });
    });
    
    await fetch("/api/history/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: currentUser,
            chatId: currentChatId,
            title: messages[0]?.parts[0].text.slice(0, 30) || "New Session",
            messages: messages
        })
    });
    loadHistory();
}

function appendMessage(role, text) {
    const wrap = document.createElement("div");
    wrap.className = "msg-wrap";
    wrap.innerHTML = `
        <div class="msg-label">${role}</div>
        <div class="msg ${role === 'USER' ? 'user-msg' : 'bot-msg'}">${marked.parse(text)}</div>
    `;
    chatArea.appendChild(wrap);
    chatArea.scrollTop = chatArea.scrollHeight;
    return wrap;
}

// Auto-resize textarea
input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = (input.scrollHeight) + "px";
});

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

// Sidebar Toggle
const toggleBtn = $("toggleSidebar");
const sidePanel = document.querySelector(".side-panel");

if (toggleBtn && sidePanel) {
    toggleBtn.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
            sidePanel.classList.toggle("open");
        } else {
            sidePanel.classList.toggle("closed");
        }
    });
}

// AUTO LOGIN
(async () => {
    const saved = localStorage.getItem("aryax-user");
    if (saved) {
        try {
            const r = await fetch(`/api/credits?username=${saved}`);
            const d = await r.json();
            if (r.ok) loginSuccess(saved, d.credits);
        } catch {}
    }
})();
