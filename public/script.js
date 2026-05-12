const $ = id => document.getElementById(id);
const chat = $("chat"), input = $("input"), sendBtn = $("send");
const authOverlay = $("authOverlay"), mainApp = $("mainApp");

let currentUser = null;

// AUTH
$("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const u = $("loginUser").value.trim();
    const p = $("loginPass").value;
    $("loginError").textContent = "Connecting...";
    
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

function loginSuccess(username, credits) {
    currentUser = username;
    localStorage.setItem("aryax-user", username);
    authOverlay.style.display = "none";
    mainApp.style.display = "flex";
    $("userName").textContent = username;
    $("creditCount").textContent = `${credits} Credits`;
}

$("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("aryax-user");
    location.reload();
});

// CHAT
async function sendMessage() {
    const text = input.value.trim();
    if (!text || !currentUser) return;
    
    appendMessage("USER", text);
    input.value = "";
    
    const botWrap = appendMessage("ARYAX", "Typing...");
    const botText = botWrap.querySelector(".msg");

    try {
        const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, username: currentUser })
        });
        const d = await r.json();
        if (r.ok) {
            botText.innerHTML = marked.parse(d.response);
            if ($("creditCount")) $("creditCount").textContent = `${d.credits} Credits`;
        } else {
            botText.textContent = "Error: " + d.error;
        }
    } catch {
        botText.textContent = "Neural connection lost.";
    }
    chat.scrollTop = chat.scrollHeight;
}

function appendMessage(role, text) {
    const wrap = document.createElement("div");
    wrap.className = "msg-wrap";
    wrap.innerHTML = `
        <div class="msg-label">${role}</div>
        <div class="msg ${role === 'USER' ? 'user-msg' : 'bot-msg'}">${text}</div>
    `;
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
    return wrap;
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

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
