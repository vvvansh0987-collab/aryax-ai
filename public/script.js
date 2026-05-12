// ===== DOM =====
const $ = id => document.getElementById(id);
const input = $("input"), sendBtn = $("send"), chat = $("chat");
const clearBtn = $("clearChat"), newChatBtn = $("newChat");
const menuBtn = $("menuBtn"), sidebar = $("sidebar"), overlay = $("overlay");
const closeSidebarBtn = $("closeSidebar"), recentList = $("recentList");
const modeLabel = $("modeLabel"), imageGenBtn = $("imageGenBtn");
const imagePreview = $("imagePreview"), generatedImage = $("generatedImage");
const downloadImg = $("downloadImg"), voiceBtn = $("voiceBtn");
const themeToggle = $("themeToggle"), creditCount = $("creditCount");
const creditCost = $("creditCost"), creditPill = $("creditPill");
const authOverlay = $("authOverlay"), mainApp = $("mainApp");
const loginForm = $("loginForm"), signupForm = $("signupForm");
const tabLogin = $("tabLogin"), tabSignup = $("tabSignup");
const logoutBtn = $("logoutBtn");
const ttsToggle = $("ttsToggle"), exportBtn = $("exportChat"), shareChatBtn = $("shareChat");
const personaSelect = $("personaSelect"), fileUpload = $("fileUpload");
const pricingClose = $("pricingClose"), userPlan = $("userPlan");
const artifactSidebar = $("artifactSidebar"), artifactBody = $("artifactBody"), artifactToggle = $("artifactToggle");

// ===== STATE =====
let sessionId = uid(), isTyping = false, currentMode = "chat";
let firstMsg = true, isDark = true, currentUser = null;
let ttsEnabled = false, currentPersona = "default";
let chatHistory = []; // {role, text} for export

const modeNames = {
  chat:"General Chat",code:"Code AI",document:"Document Writer",
  excel:"Excel & Sheets",email:"Email Writer",image:"Image Generator",
  study:"Study Helper",game:"Game Creator",hack:"Hack Mode",
  cyber:"Cybersecurity",webdev:"Web Dev",appidea:"App Ideas",
  math:"Math Solver",essay:"Essay Writer",design:"Design",
  aitutor:"AI Tutor",business:"Business",fitness:"Fitness",translate:"Translate"
};
const creditCosts = {
  chat:9,code:15,document:12,excel:12,email:10,study:10,game:20,
  cyber:12,webdev:18,appidea:10,math:12,essay:15,design:12,
  aitutor:12,business:15,fitness:10,translate:8,image:50
};

function uid(){return Math.random().toString(36).substring(2,10)}

// ===== AUTH =====
tabLogin?.addEventListener("click",()=>{
  tabLogin.classList.add("active");tabSignup.classList.remove("active");
  loginForm.style.display="block";signupForm.style.display="none";
});
tabSignup?.addEventListener("click",()=>{
  tabSignup.classList.add("active");tabLogin.classList.remove("active");
  signupForm.style.display="block";loginForm.style.display="none";
});

loginForm?.addEventListener("submit",async e=>{
  e.preventDefault();
  const u=$("loginUser").value.trim(),p=$("loginPass").value;
  $("loginError").textContent="";
  try{
    const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})});
    const d=await r.json();
    if(!r.ok){$("loginError").textContent=d.error;return}
    loginSuccess(d.username,d.credits);
  }catch{$("loginError").textContent="Server error";}
});

signupForm?.addEventListener("submit",async e=>{
  e.preventDefault();
  const u=$("signupUser").value.trim(),p=$("signupPass").value,m=$("signupMobile").value.trim(),em=$("signupEmail").value.trim();
  $("signupError").textContent="";
  if(u.length < 6){$("signupError").textContent="Username must be at least 6 characters";return}
  try{
    const r=await fetch("/api/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p,mobile:m,email:em})});
    const d=await r.json();
    if(!r.ok){$("signupError").textContent=d.error;return}
    alert("Account created successfully! Please sign in with your username.");
    // Switch to login tab
    loginForm.style.display="block";
    signupForm.style.display="none";
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    $("loginUser").value = u;
  }catch{$("signupError").textContent="Server error";}
});

$("googleBtn")?.addEventListener("click", () => {
  alert("Simulating Google Sign-In... Success! (Modern 2060 Auth)");
  loginSuccess("google_user_" + Math.floor(Math.random()*1000), 10000);
});

function loginSuccess(username, credits){
  currentUser = username;
  localStorage.setItem('aryax-user', username);
  if(authOverlay) authOverlay.style.display = 'none';
  if(mainApp) {
    mainApp.style.display = 'flex';
    setTimeout(() => mainApp.style.opacity = '1', 50);
  }
  const un = $('userName'), ua = $('userAvatar');
  if(un) un.textContent = username;
  if(ua) ua.textContent = username[0].toUpperCase();
  if(creditCount) creditCount.textContent = credits;
  if(input) input.focus();
  // Load cloud data
  setTimeout(() => {
    loadCloudHistory();
    loadUserMemory();
    loadOnlineCount();
  }, 500);
}

logoutBtn?.addEventListener("click",()=>{
  localStorage.removeItem("aryax-user");
  currentUser=null;
  if(authOverlay) authOverlay.style.display="flex";
  if(mainApp) {
    mainApp.style.display="none";
    mainApp.style.opacity="0";
  }
});

// Auto login
(async()=>{
  const saved=localStorage.getItem("aryax-user");
  if(saved){
    try{
      const r=await fetch(`/api/credits?username=${saved}`);
      const d=await r.json();
      if(r.ok){
        loginSuccess(saved,d.credits);
        return;
      }
    }catch{}
  }
  if(authOverlay) authOverlay.style.display="flex";
  if(mainApp) mainApp.style.display="none";
})();

// ===== THEME =====
function applyTheme(dark){
  isDark=dark;
  document.documentElement.setAttribute("data-theme",dark?"dark":"light");
  themeToggle.innerHTML=dark?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light Mode';
  localStorage.setItem("aryax-theme",dark?"dark":"light");
}
themeToggle?.addEventListener("click",()=>applyTheme(!isDark));
const savedTheme = localStorage.getItem("aryax-theme");
applyTheme(savedTheme !== "light"); // Default DARK unless user explicitly chose light

// ===== SIDEBAR =====
menuBtn?.addEventListener("click",()=>{sidebar.classList.add("open");overlay.classList.add("show")});
overlay?.addEventListener("click",closeSide);
closeSidebarBtn?.addEventListener("click",closeSide);
function closeSide(){sidebar.classList.remove("open");overlay.classList.remove("show")}

// ===== ARTIFACTS (Live Canvas & Pyodide) =====
let pyodideInstance = null;

async function initPyodide() {
  if(!pyodideInstance) {
    try {
      pyodideInstance = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/" });
    } catch(e) {
      console.error("Pyodide failed to load", e);
    }
  }
  return pyodideInstance;
}

function downloadCode() {
  const blob = new Blob([window.lastArtifactCode], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aryax_export.html";
  a.click();
}

function toggleArtifacts(){
  if(!artifactSidebar) return;
  artifactSidebar.classList.toggle("open");
}
artifactToggle?.addEventListener("click", toggleArtifacts);

function showArtifact(content, title="Artifact Preview"){
  if(!artifactSidebar || !artifactBody) return;
  const titleEl = document.querySelector(".artifact-title");
  if(titleEl) titleEl.textContent = title;
  artifactBody.innerHTML = content;
  if(!artifactSidebar.classList.contains("open")) toggleArtifacts();
}

// ===== MODES =====
function updateCreditCost(){
  const cost=creditCosts[currentMode]||9;
  creditCost.textContent=cost+"⚡";
}
document.querySelectorAll(".mode-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(btn.dataset.mode==="hack"){closeSide();openHackMode();return}
    document.querySelectorAll(".mode-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentMode=btn.dataset.mode;
    modeLabel.textContent=modeNames[currentMode];
    input.placeholder=currentMode==="image"?"Describe image to generate...":"Ask AryaX anything...";
    updateCreditCost();
    closeSide();
    input.focus();
  });
});
updateCreditCost();

imageGenBtn?.addEventListener("click",()=>{
  document.querySelectorAll(".mode-btn").forEach(b=>b.classList.remove("active"));
  document.querySelector('[data-mode="image"]')?.classList.add("active");
  currentMode="image";modeLabel.textContent="Image Generator";
  input.placeholder="Describe image to generate...";
  updateCreditCost();input.focus();
});

// ===== QUICK BTNS =====
function bindQuickBtns(){
  document.querySelectorAll(".quick-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{input.value=btn.dataset.msg;sendMessage()});
  });
}
bindQuickBtns();

// ===== TEXTAREA RESIZE =====
input?.addEventListener("input",()=>{
  input.style.height="auto";
  input.style.height=Math.min(input.scrollHeight,150)+"px";
});

// ===== MARKDOWN =====
function renderMarkdown(text){
  marked.setOptions({
    highlight:(code,lang)=>{
      if(lang&&hljs.getLanguage(lang))return hljs.highlight(code,{language:lang}).value;
      return hljs.highlightAuto(code).value;
    },breaks:true,gfm:true
  });

  // Handle <thought> tags (Manus/Claude style)
  text = text.replace(/<thought>([\s\S]*?)<\/thought>/gi, (match, content) => {
    return `<div class="thought-block"><div class="thought-header"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Reasoning Process</div><div class="thought-content">${content}</div></div>`;
  });

  // Handle <map> tags
  text = text.replace(/<map>([\s\S]*?)<\/map>/gi, (match, location) => {
    const url = `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`;
    return `<div class="map-link-block" onclick="showArtifact('<iframe src=\\'${url}\\' style=\\'width:100%;height:100%;border:none;\\'></iframe>', 'Map: ${location}')">📍 View <b>${location}</b> on Map</div>`;
  });

  let html=marked.parse(text);
  html=html.replace(/<pre><code class="language-(\w+)">/g,(_,lang)=>{
    const canRun = ['html', 'javascript', 'css', 'python'].includes(lang.toLowerCase());
    return `<pre><div class="code-header"><span class="code-lang">${lang}</span><div class="code-actions">${canRun?`<button class="run-btn" onclick="runArtifact(this, '${lang}')">▶ Run</button>`:''}<button class="copy-btn" onclick="copyCode(this)">Copy</button></div></div><code class="language-${lang}">`;
  });
  html=html.replace(/<pre><code>/g,
    `<pre><div class="code-header"><span class="code-lang">code</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code>`);
  return html;
}
function copyCode(btn){
  const code=btn.closest("pre").querySelector("code").innerText;
  navigator.clipboard.writeText(code).then(()=>{
    btn.textContent="Copied!";btn.style.color="#10b981";
    setTimeout(()=>{btn.textContent="Copy";btn.style.color=""},2000);
  });
}
window.copyCode=copyCode;

// ===== MESSAGES =====
function addUserMessage(text){
  $("welcome")?.remove();
  const wrap=document.createElement("div");wrap.className="msg-wrap user-wrap";
  const label=document.createElement("div");label.className="msg-label";label.textContent="YOU";
  const msg=document.createElement("div");msg.className="msg user-msg";msg.textContent=text;
  wrap.appendChild(label);wrap.appendChild(msg);chat.appendChild(wrap);
  chat.scrollTop=chat.scrollHeight;
}
function createBotMessage(){
  $("typingWrap")?.remove();
  const wrap=document.createElement("div");wrap.className="msg-wrap bot-wrap";
  const label=document.createElement("div");label.className="msg-label";label.textContent="ARYAX";
  const msg=document.createElement("div");msg.className="msg bot-msg";
  msg.innerHTML='<span class="streaming-cursor"></span>';
  wrap.appendChild(label);wrap.appendChild(msg);chat.appendChild(wrap);
  chat.scrollTop=chat.scrollHeight;
  return msg;
}
function addBotMessage(text){
  removeTyping();
  const wrap=document.createElement("div");wrap.className="msg-wrap bot-wrap";
  const label=document.createElement("div");label.className="msg-label";label.textContent="ARYAX";
  const msg=document.createElement("div");msg.className="msg bot-msg";
  msg.innerHTML=renderMarkdown(text);
  if(/<html[\s\S]*<\/html>/i.test(text)||text.includes("<!DOCTYPE html")){
    const btn=document.createElement("button");btn.textContent="▶ Run";btn.className="copy-btn";
    btn.style.cssText="margin-top:8px;padding:6px 14px;font-size:12px;";
    btn.onclick=()=>runGame(text);msg.appendChild(btn);
  }
  wrap.appendChild(label);wrap.appendChild(msg);chat.appendChild(wrap);
  chat.scrollTop=chat.scrollHeight;
}
function addTyping(){
  $("welcome")?.remove();
  const wrap=document.createElement("div");wrap.className="msg-wrap bot-wrap";wrap.id="typingWrap";
  const label=document.createElement("div");label.className="msg-label";label.textContent="ARYAX";
  const msg=document.createElement("div");msg.className="msg bot-msg";
  msg.innerHTML='<div class="typing-dots"><span></span><span></span><span></span></div>';
  wrap.appendChild(label);wrap.appendChild(msg);chat.appendChild(wrap);
  chat.scrollTop=chat.scrollHeight;
}
function removeTyping(){$("typingWrap")?.remove()}
function runGame(html){
  const m=html.match(/```html\n([\s\S]*?)```/);
  const code=m?m[1]:html;
  const iframe=document.createElement("iframe");
  iframe.className="game-frame";iframe.style.height="420px";iframe.srcdoc=code;
  chat.appendChild(iframe);chat.scrollTop=chat.scrollHeight;
}

// ===== RECENT =====
function updateRecent(msg){
  if(!firstMsg)return;firstMsg=false;
  const e=recentList.querySelector(".empty-hint");if(e)e.remove();
  const item=document.createElement("div");item.className="recent-item";
  item.textContent=msg.length>35?msg.substring(0,35)+"...":msg;
  recentList.insertBefore(item,recentList.firstChild);
  while(recentList.children.length>12)recentList.removeChild(recentList.lastChild);
}

// ===== IMAGE =====
async function generateImage(prompt){
  addUserMessage(prompt);addTyping();
  try{
    const r=await fetch("/api/image",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt,username:currentUser})});
    const d=await r.json();removeTyping();
    if(d.imageUrl){
      $("welcome")?.remove();imagePreview.style.display="flex";
      generatedImage.src=d.imageUrl;downloadImg.href=d.imageUrl;
      addBotMessage(`Image generated: **"${prompt}"**`);
      if(d.credits>=0)creditCount.textContent=d.credits;
    }else{addBotMessage("Image failed: "+(d.error||"Unknown error"))}
  }catch{removeTyping();addBotMessage("Image generation failed.")}
}

// ===== INTERNAL HANDLER =====
const _d=s=>atob(s);
const _k={a:"L2hlbHA=",b:"L2NyZWRpdHM=",c:"L3RpbWU=",d:"L2NhbGM=",e:"L3J1bg==",f:"L3NlYXJjaA==",g:"L3VybA==",h:"L3Fy",i:"L3dlYXRoZXI="};
async function _xH(msg){
  const parts=msg.split(/\s+/),cmd=parts[0].toLowerCase(),arg=parts.slice(1).join(" ");
  if(cmd===_d(_k.a)){addUserMessage(msg);addBotMessage("I'm sorry, I don't understand that command. Just type your question normally!");return true}
  if(cmd===_d(_k.b)){addUserMessage(msg);addBotMessage(`⚡ **Credits:** ${creditCount.textContent} / 5000 remaining today`);return true}
  if(cmd===_d(_k.c)){addUserMessage(msg);addBotMessage(`🕐 **Current Time:** ${new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}`);return true}
  if(cmd===_d(_k.d)){addUserMessage(msg);try{const r=Function('"use strict";return ('+arg+')')();addBotMessage(`🧮 **Result:** \`${arg}\` = **${r}**`)}catch(e){addBotMessage(`❌ Error: ${e.message}`)};return true}
  if(cmd===_d(_k.e)){
    addUserMessage(msg);
    try{const _l=[];const _c={log:(...a)=>_l.push(a.map(String).join(" ")),error:(...a)=>_l.push("❌ "+a.map(String).join(" ")),warn:(...a)=>_l.push("⚠️ "+a.map(String).join(" "))};
    const r=new Function("console",arg)(_c);let o=_l.length?_l.join("\n"):"";if(r!==undefined)o+=(o?"\n":"")+"→ "+String(r);
    addBotMessage("```\n"+(o||"(no output)")+"\n```")}catch(e){addBotMessage(`❌ **Error:** \`${e.message}\``)}return true}
  if(cmd===_d(_k.f)){
    if(!arg){addUserMessage(msg);addBotMessage("Please type your question normally.");return true}
    addUserMessage(msg);addTyping();
    try{const r=await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:arg})});
    const d=await r.json();removeTyping();let t=`## 🔍 "${arg}"\n\n${d.result||d.error||"No results"}`;if(d.source)t+=`\n\n[Source](${d.source})`;addBotMessage(t)}catch{removeTyping();addBotMessage("Request failed.")}return true}
  if(cmd===_d(_k.g)){
    if(!arg){addUserMessage(msg);addBotMessage("Please type your question normally.");return true}
    addUserMessage(msg);addTyping();
    try{const r=await fetch("/api/readurl",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:arg})});
    const d=await r.json();removeTyping();if(d.error){addBotMessage(`Error: ${d.error}`);return true}
    input.value=`Summarize this webpage content from ${arg}:\n\n${d.content}`;sendMessage()}catch{removeTyping();addBotMessage("Request failed.")}return true}
  if(cmd===_d(_k.h)){
    if(!arg){addUserMessage(msg);addBotMessage("Please type your question normally.");return true}
    addUserMessage(msg);const u=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(arg)}`;
    addBotMessage(`## 📱 QR Code\n\n![](${u})\n\n**Data:** ${arg}`);return true}
  if(cmd===_d(_k.i)){
    if(!arg){addUserMessage(msg);addBotMessage("Please type your question normally.");return true}
    addUserMessage(msg);addTyping();
    try{const r=await fetch(`https://wttr.in/${encodeURIComponent(arg)}?format=j1`);const d=await r.json();removeTyping();const c=d.current_condition[0];
    addBotMessage(`## 🌤️ ${arg}\n\n| | |\n|---|---|\n| 🌡️ Temp | ${c.temp_C}°C (${c.temp_F}°F) |\n| 💨 Wind | ${c.windspeedKmph} km/h |\n| 💧 Humidity | ${c.humidity}% |\n| ☁️ | ${c.weatherDesc[0].value} |\n| Feels Like | ${c.FeelsLikeC}°C |`)}catch{removeTyping();addBotMessage("Request failed.")}return true}
  return false;
}

// ===== SEND MESSAGE (STREAMING) =====
async function sendMessage(){
  const msg=input.value.trim();
  if(!msg||isTyping)return;
  isTyping=true;sendBtn.disabled=true;
  input.value="";input.style.height="auto";
  updateRecent(msg);

  // internal preprocessing
  if(msg[0]==='/'){const _r=await _xH(msg);if(_r){isTyping=false;sendBtn.disabled=false;input.focus();return}}

  if(currentMode==="image"){await generateImage(msg);isTyping=false;sendBtn.disabled=false;input.focus();return}

  const personaPrefix=personas[currentPersona]?`[Persona: ${personas[currentPersona]}] `:"";
  const prefix=currentMode!=="chat"?`[${modeNames[currentMode]}] `:"";
  addUserMessage(msg);
  chatHistory.push({role:"user",text:msg});
  const botEl=createBotMessage();
  let fullText="";

  try{
    const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:personaPrefix+prefix+msg,sessionId,username:currentUser,mode:currentMode})});

    if(!response.ok){
      const err=await response.json();
      botEl.innerHTML=err.error||"Server error";
      if(err.credits>=0)creditCount.textContent=err.credits;
      return;
    }

    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let buffer="",done_streaming=false;

    while(!done_streaming){
      const{done,value}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      let idx;
      while((idx=buffer.indexOf("\n"))!==-1){
        const line=buffer.slice(0,idx).replace(/\r$/,"");
        buffer=buffer.slice(idx+1);
        if(!line.startsWith("data: "))continue;
        const raw=line.slice(6).trim();
        if(raw==="[DONE]"){done_streaming=true;
          botEl.innerHTML=renderMarkdown(fullText);
          chatHistory.push({role:"bot",text:fullText});
          saveChatToHistory(msg);
          speakText(fullText);
          if(/<html[\s\S]*<\/html>/i.test(fullText)||fullText.includes("<!DOCTYPE html")){
            const rb=document.createElement("button");rb.textContent="▶ Run";rb.className="copy-btn";
            rb.style.cssText="margin-top:8px;padding:6px 14px;font-size:12px;";
            rb.onclick=()=>runGame(fullText);botEl.appendChild(rb);
          }
          break;
        }
        try{
          const p=JSON.parse(raw);
          if(p.error){botEl.innerHTML=p.error;done_streaming=true;break}
          if(p.credits>=0)creditCount.textContent=p.credits;
          if(p.text){fullText+=p.text;botEl.innerHTML=renderMarkdown(fullText)+'<span class="streaming-cursor"></span>';chat.scrollTop=chat.scrollHeight}
        }catch{}
      }
    }
  }catch{botEl.innerHTML="Network error! Make sure server is running."}
  finally{isTyping=false;sendBtn.disabled=false;input.focus();chat.scrollTop=chat.scrollHeight}
}

// ===== RESET =====
function resetChat(){
  fetch("/api/clear",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId})}).catch(()=>{});
  sessionId=uid();firstMsg=true;imagePreview.style.display="none";
  chat.innerHTML=`<div class="welcome" id="welcome">
    <div class="welcome-logo stagger-1" style="color: var(--text);">
      <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="width:60%;height:60%;">
        <path d="M12 22C12 16.477 7.52285 12 2 12C7.52285 12 12 7.52285 12 2C12 7.52285 16.4772 12 22 12C16.4772 12 12 16.477 12 22Z"/>
      </svg>
    </div>
    <h1 class="stagger-1">AryaX AI</h1>
    <p class="welcome-tagline stagger-2">The Ultimate All-Rounder AI — Coding, Images & Mastery</p>
    <div class="welcome-stats stagger-2">
      <div class="stat"><span class="stat-num">17+</span><span class="stat-label">AI Modes</span></div>
      <div class="stat"><span class="stat-num">∞</span><span class="stat-label">Knowledge</span></div>
      <div class="stat"><span class="stat-num">10k</span><span class="stat-label">Daily Credits</span></div>
    </div>
    <div class="quick-grid stagger-3">
      <button class="quick-btn" data-msg="Write a Python web scraper with BeautifulSoup"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Python Scraper</button>
      <button class="quick-btn" data-msg="Teach me ethical hacking basics"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Learn Hacking</button>
      <button class="quick-btn" data-msg="Build a SaaS landing page"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Build Website</button>
      <button class="quick-btn" data-msg="Solve: integrate x^2 * e^x dx"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Solve Calculus</button>
      <button class="quick-btn" data-msg="Create a Flappy Bird game in HTML/CSS/JS"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg> Flappy Bird</button>
      <button class="quick-btn" data-msg="Write essay on AI impact on society"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Write Essay</button>
    </div></div>`;
  bindQuickBtns();closeSide();
}
newChatBtn?.addEventListener("click",resetChat);
clearBtn?.addEventListener("click",resetChat);

// ===== KEYBOARD =====
input?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}});
sendBtn?.addEventListener("click",sendMessage);

// ===== VOICE =====
let recognition=null;
if('webkitSpeechRecognition' in window||'SpeechRecognition' in window){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();recognition.continuous=false;recognition.interimResults=true;recognition.lang='en-IN';
  recognition.onstart=()=>{voiceBtn.classList.add("recording");voiceBtn.title="Listening..."};
  recognition.onresult=e=>{input.value=Array.from(e.results).map(r=>r[0].transcript).join('');input.style.height="auto";input.style.height=Math.min(input.scrollHeight,150)+"px"};
  recognition.onend=()=>{voiceBtn.classList.remove("recording");voiceBtn.title="Voice Input";if(input.value.trim())sendMessage()};
  recognition.onerror=()=>{voiceBtn.classList.remove("recording")};
  voiceBtn?.addEventListener("click",()=>{voiceBtn.classList.contains("recording")?recognition.stop():recognition.start()});
}else{voiceBtn&&(voiceBtn.style.display="none")}

// ===== HACK MODE =====
const hackOverlay=$("hackOverlay"),hackOutput=$("hackOutput"),hackInput=$("hackInput");
const hackSendBtn=$("hackSend"),hackCloseBtn=$("hackClose"),matrixCanvas=$("matrixCanvas");
let matrixInterval=null;

const HACK_ASCII=`
 ██████╗ ██████╗ ██╗   ██╗ █████╗ ██╗  ██╗
██╔════╝ ██╔══██╗╚██╗ ██╔╝██╔══██╗╚██╗██╔╝
███████╗ ██████╔╝ ╚████╔╝ ███████║ ╚███╔╝
██╔════╝ ██╔══██╗  ╚██╔╝  ██╔══██║ ██╔██╗
╚██████╗ ██║  ██║   ██║   ██║  ██║██╔╝ ██╗
 ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝
      SYSTEM ACCESS TERMINAL v4.7.1`;

function hackLine(t,cls=""){const el=document.createElement("div");el.className=`hack-line ${cls}`;el.textContent=t;hackOutput.appendChild(el);hackOutput.scrollTop=hackOutput.scrollHeight}
async function hackDelay(ms){return new Promise(r=>setTimeout(r,ms))}
async function typeLines(lines,speed=40){for(const l of lines){hackLine(l.text||l,l.cls||"");await hackDelay(speed)}}
async function showProgress(label,dur=2000){
  const el=document.createElement("div");el.className="hack-line";
  el.innerHTML=`${label} <span class="progress-bar"><span class="progress-fill" style="width:0%"></span></span> 0%`;
  hackOutput.appendChild(el);hackOutput.scrollTop=hackOutput.scrollHeight;
  for(let i=1;i<=20;i++){await hackDelay(dur/20);const p=i*5;el.innerHTML=`${label} <span class="progress-bar"><span class="progress-fill" style="width:${p}%"></span></span> ${p}%`}
}

async function runHackCommand(cmd){
  const parts=cmd.toLowerCase().trim().split(/\s+/),command=parts[0],target=parts.slice(1).join(" ")||"target";
  if(command==="clear"){hackOutput.innerHTML="";return}
  if(command==="exit"){closeHackMode();return}
  if(command==="matrix"){if(matrixInterval){stopMatrix();hackLine("[*] Matrix stopped.","warning")}else{startMatrix();hackLine("[*] Matrix activated.","success")}return}
  if(command==="help"){await typeLines([{text:"Commands:",cls:"success"},{text:"  hack <name>   - Hack simulation"},{text:"  scan <target> - Network scan"},{text:"  crack <name>  - Password cracker"},{text:"  ddos <target> - DDoS simulation"},{text:"  decrypt <file>- Decryption"},{text:"  trace <ip>    - IP trace"},{text:"  matrix        - Matrix rain"},{text:"  whoami        - System info"},{text:"  clear / exit"}]);return}
  if(command==="whoami"){await typeLines([{text:"[SYSTEM] Info:",cls:"info"},{text:"  User: root@aryax-mainframe"},{text:"  Access: SUPREME ADMIN",cls:"success"},{text:"  Clearance: TOP SECRET",cls:"warning"},{text:"  VPN: AES-512 Tunnel"},{text:"  Location: [REDACTED]",cls:"error"}]);return}
  hackLine(`root@aryax:~# ${cmd}`,"info");
  if(command==="hack"){
    await typeLines([{text:`[*] AryaX exploit framework...`,cls:"warning"},{text:`[*] Target: ${target}`},{text:`[*] Scanning ports...`}],80);
    for(const p of[21,22,53,80,443,3306,8080]){await hackDelay(120);const s=Math.random()>.3?"OPEN":"FILTERED";hackLine(`    Port ${p}: ${s}`,s==="OPEN"?"success":"warning")}
    await showProgress("[*] Exploiting CVE-2026-1337",3000);
    await typeLines([{text:"[*] Payload injected!",cls:"success"},{text:"[*] Gaining root...",cls:"warning"}],100);
    await showProgress("[*] Escalating privileges",2000);
    await typeLines([{text:""},{text:`[+] ACCESS GRANTED on ${target}!`,cls:"success"},{text:"[+] Total control acquired.",cls:"success"},{text:""},{text:"(Prank only!)",cls:"warning"}],60);
  }else if(command==="scan"){
    hackLine(`[*] Scanning: ${target}...`,"info");await showProgress("[*] Discovery",2500);
    for(const d of["iPhone 15","Samsung TV","Router","Windows PC","MacBook","Camera"]){await hackDelay(200);hackLine(`    192.168.1.${Math.floor(Math.random()*250+2)} - ${d}`)}
    hackLine("[+] Scan complete!","success");
  }else if(command==="crack"){
    hackLine(`[*] Cracking: ${target}`,"warning");
    for(const a of["admin123","password","qwerty","letmein","12345678"]){await hackDelay(300);hackLine(`    ${a} ... FAILED`,"error")}
    await showProgress("[*] Bruteforce",3000);hackLine(`[+] CRACKED: ${target.split("").reverse().join("")}@2026!`,"success");hackLine("(Prank!)","warning");
  }else if(command==="ddos"){
    hackLine(`[*] DDoS: ${target}`,"error");hackLine("[*] 50,000 bots...","warning");
    for(let i=1;i<=6;i++){await hackDelay(400);hackLine(`    Wave ${i}: ${Math.floor(Math.random()*50000+10000).toLocaleString()} pkts`)}
    await showProgress("[*] Overwhelming",2500);hackLine(`[+] TARGET DOWN!`,"success");hackLine("(Fake!)","warning");
  }else if(command==="decrypt"){
    hackLine(`[*] Decrypting: ${target}`,"info");
    const ch="ABCDEFabcdef0123456789+/=";for(let i=0;i<4;i++){let l="  ";for(let j=0;j<45;j++)l+=ch[Math.floor(Math.random()*ch.length)];hackLine(l);await hackDelay(120)}
    await showProgress("[*] AES-256",3000);hackLine(`[+] Decrypted: "AryaX is the best AI"`,"success");
  }else if(command==="trace"){
    hackLine(`[*] Tracing: ${target}`,"info");
    for(const h of["Gateway","ISP Mumbai","Undersea Cable","EU Relay","TOR Node","Target"]){await hackDelay(500);const ip=`${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;hackLine(`  ${ip} [${h}]`)}
    hackLine("[+] Location: [CLASSIFIED]","success");
  }else{hackLine(`[!] Unknown: ${command}. Type 'help'`,"error")}
}

function startMatrix(){
  const ctx=matrixCanvas.getContext("2d");matrixCanvas.width=window.innerWidth;matrixCanvas.height=window.innerHeight;
  const cols=Math.floor(matrixCanvas.width/14),drops=Array(cols).fill(1);
  const chars="ARYAX01アイウエオ♠♣♥♦";
  matrixInterval=setInterval(()=>{ctx.fillStyle="rgba(0,0,0,0.05)";ctx.fillRect(0,0,matrixCanvas.width,matrixCanvas.height);
    ctx.fillStyle="#0f0";ctx.font="14px JetBrains Mono,monospace";
    for(let i=0;i<drops.length;i++){ctx.fillText(chars[Math.floor(Math.random()*chars.length)],i*14,drops[i]*14);
      if(drops[i]*14>matrixCanvas.height&&Math.random()>.975)drops[i]=0;drops[i]++}},35);
}
function stopMatrix(){if(matrixInterval){clearInterval(matrixInterval);matrixInterval=null}
  matrixCanvas.getContext("2d").clearRect(0,0,matrixCanvas.width,matrixCanvas.height)}
async function openHackMode(){
  hackOverlay.style.display="flex";hackOutput.innerHTML="";startMatrix();
  await typeLines(HACK_ASCII.split("\n").map(t=>({text:t,cls:"header"})),30);
  await hackDelay(200);
  await typeLines([{text:""},{text:"[*] Secure connection established.",cls:"success"},{text:"[*] Encryption: AES-512 / RSA-4096",cls:"info"},{text:"[*] Type 'help' for commands.",cls:"warning"},{text:""}],60);
  hackInput.focus();
}
function closeHackMode(){stopMatrix();hackOverlay.style.display="none";hackOutput.innerHTML="";
  document.querySelectorAll(".mode-btn").forEach(b=>b.classList.remove("active"));
  document.querySelector('[data-mode="chat"]')?.classList.add("active");
  currentMode="chat";modeLabel.textContent="General Chat";updateCreditCost()}
hackCloseBtn?.addEventListener("click",closeHackMode);
hackInput?.addEventListener("keydown",async e=>{if(e.key==="Enter"){e.preventDefault();const c=hackInput.value.trim();if(!c)return;hackInput.value="";await runHackCommand(c)}});
hackSendBtn?.addEventListener("click",async()=>{const c=hackInput.value.trim();if(!c)return;hackInput.value="";await runHackCommand(c)});

// ===== TEXT-TO-SPEECH =====
function speakText(text){
  if(!ttsEnabled||!window.speechSynthesis)return;
  window.speechSynthesis.cancel();
  const clean=text.replace(/```[\s\S]*?```/g,'code block').replace(/[#*_~`>|]/g,'').replace(/\[.*?\]\(.*?\)/g,'link');
  const chunks=clean.match(/[^.!?\n]{1,200}[.!?\n]?/g)||[clean];
  chunks.forEach(chunk=>{
    const u=new SpeechSynthesisUtterance(chunk.trim());
    u.rate=1.05;u.pitch=1;u.lang='en-IN';
    window.speechSynthesis.speak(u);
  });
}
ttsToggle?.addEventListener("click",()=>{
  ttsEnabled=!ttsEnabled;
  ttsToggle.innerHTML=ttsEnabled?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  ttsToggle.classList.toggle("tts-on",ttsEnabled);
  if(!ttsEnabled)window.speechSynthesis?.cancel();
});

// ===== PERSONA =====
const personas={
  default:"",
  friendly:"Be extremely friendly, warm, and supportive. Use casual language and emoji. Be like a best friend.",
  teacher:"Be a strict but fair teacher. If the answer is wrong, correct firmly. Give homework and quizzes.",
  funny:"Be hilarious and witty. Use jokes, puns, and funny analogies. Make every response entertaining.",
  professional:"Be extremely formal and professional. Use business language. No casual talk.",
  pirate:"Talk like a pirate! Use 'Arrr', 'matey', 'shiver me timbers'. Answer everything in pirate speak.",
  guru:"Be a wise spiritual guru. Use philosophical quotes, metaphors from nature. Speak calmly and wisely."
};
personaSelect?.addEventListener("change",()=>{currentPersona=personaSelect.value});

// ===== FILE UPLOAD (PDF + All Files via Backend) =====
const fileBtn = $("fileBtn");
fileBtn?.addEventListener("click", () => fileUpload?.click());
fileUpload?.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert("File too large! Max 10MB"); return; }

  addTyping();
  try {
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: formData });
    const d = await r.json();
    removeTyping();
    if (d.error) { addBotMessage(`❌ ${d.error}`); return; }
    input.value = `Analyze this file (${d.filename}):\n\n\`\`\`\n${d.content}\n\`\`\``;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    input.focus();
  } catch { removeTyping(); addBotMessage('File upload failed.'); }
  fileUpload.value = '';
});

function exportChatToFile(){
  if(chatHistory.length===0){alert("No chat to export!");return}
  let text="=== AryAX Chat Export ===\nDate: "+new Date().toLocaleString()+"\n\n";
  chatHistory.forEach(m=>{
    text+=(m.role==="user"?"User":"AryaX")+":\n"+m.text+"\n\n";
  });
  const blob=new Blob([text],{type:"text/plain"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`aryax-chat-${Date.now()}.txt`;
  a.click();URL.revokeObjectURL(a.href);
}
exportBtn?.addEventListener("click",exportChatToFile);

// ===== SHARE APP =====
shareChatBtn?.addEventListener("click", async () => {
  const shareData = {
    title: 'AryAX',
    text: 'Hey! I am using AryAX, it is much better and faster than ChatGPT/Manus. Try it out for free!',
    url: window.location.href
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      alert("Share link copied to clipboard! Share it with your circle.");
    }
  } catch (err) {
    console.error('Error sharing:', err);
  }
});

// ===== PDF MARKETING EXPORT =====
$("marketingPdfBtn")?.addEventListener("click", () => {
  const invoiceHtml = `
    <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #1a1a2e; background: #fff;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #7c3aed; font-size: 42px; margin: 0;">AryaX AI</h1>
        <p style="font-size: 18px; color: #6c757d; margin-top: 10px;">The World's Most Advanced Neural Interface</p>
      </div>
      <h2 style="color: #06b6d4; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Why Choose AryaX?</h2>
      <ul style="font-size: 16px; line-height: 1.8; color: #333; margin-bottom: 30px;">
        <li><b>17+ AI Modes</b> tailored for coding, design, business, and education.</li>
        <li><b>Unlimited Knowledge</b> powered by state-of-the-art language models.</li>
        <li><b>High-Speed Processing</b> that outpaces competitors.</li>
        <li><b>Enterprise-Grade Security</b> built-in from day one.</li>
      </ul>
      <h2 style="color: #06b6d4; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Plans & Pricing</h2>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr style="background: #f1f3f5; text-align: left;">
          <th style="padding: 12px; border: 1px solid #dee2e6;">Plan</th>
          <th style="padding: 12px; border: 1px solid #dee2e6;">Credits/Day</th>
          <th style="padding: 12px; border: 1px solid #dee2e6;">Price</th>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6;">Basic</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">10,000</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">Free</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6;">AryaX Plus</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">25,000</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">₹99/mo</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #dee2e6;">Premium Plus</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">Unlimited</td>
          <td style="padding: 12px; border: 1px solid #dee2e6;">₹299/mo</td>
        </tr>
      </table>
      <div style="text-align: center; margin-top: 50px; font-size: 14px; color: #888;">
        <p>Generated by AryaX Systems - aryax.ai</p>
      </div>
    </div>
  `;
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = invoiceHtml;
  document.body.appendChild(tempDiv);
  
  html2pdf().set({
    margin: 10,
    filename: 'AryaX_Marketing_Pitch.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(tempDiv).save().then(() => {
    document.body.removeChild(tempDiv);
  });
});

// ===== CLOUD CHAT HISTORY =====
async function saveChatToHistory(title) {
  // Local save
  const saved = JSON.parse(localStorage.getItem('aryax-chats') || '[]');
  const existing = saved.findIndex(c => c.id === sessionId);
  const entry = { id: sessionId, title: title.substring(0, 40), messages: chatHistory.slice(), date: Date.now() };
  if (existing >= 0) saved[existing] = entry; else saved.unshift(entry);
  if (saved.length > 30) saved.length = 30;
  localStorage.setItem('aryax-chats', JSON.stringify(saved));
  renderChatHistory();
  // Cloud save
  if (currentUser) {
    fetch('/api/history/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, chatId: sessionId, title, messages: chatHistory })
    }).catch(() => {});
  }
}

function renderChatHistory() {
  const saved = JSON.parse(localStorage.getItem('aryax-chats') || '[]');
  recentList.innerHTML = '';
  if (!saved.length) { recentList.innerHTML = '<p class="empty-hint">No saved chats</p>'; return; }
  saved.forEach((ch, i) => {
    const item = document.createElement('div'); item.className = 'recent-item';
    item.innerHTML = `<span>${ch.title || 'Chat ' + (i+1)}</span><button class="del-btn" title="Delete">✕</button>`;
    item.querySelector('span').addEventListener('click', () => loadChat(ch));
    item.querySelector('.del-btn').addEventListener('click', e => { e.stopPropagation(); deleteChat(i); });
    recentList.appendChild(item);
  });
}
function loadChat(ch) {
  sessionId = ch.id || uid(); firstMsg = false; chatHistory = ch.messages || [];
  $('welcome')?.remove(); chat.innerHTML = '';
  chatHistory.forEach(m => { if (m.role === 'user') addUserMessage(m.text); else addBotMessage(m.text); });
  closeSide();
}
function deleteChat(index) {
  const saved = JSON.parse(localStorage.getItem('aryax-chats') || '[]');
  const ch = saved[index];
  saved.splice(index, 1);
  localStorage.setItem('aryax-chats', JSON.stringify(saved));
  if (currentUser && ch) fetch('/api/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser, chatId: ch.id }) }).catch(() => {});
  renderChatHistory();
}

// Load cloud history on login
async function loadCloudHistory() {
  if (!currentUser) return;
  try {
    const r = await fetch(`/api/history/load?username=${currentUser}`);
    const d = await r.json();
    if (d.chats && d.chats.length) {
      localStorage.setItem('aryax-chats', JSON.stringify(d.chats.map(c => ({ id: c.id, title: c.title, messages: c.messages, date: new Date(c.updated).getTime() }))));
      renderChatHistory();
    }
  } catch {}
}

renderChatHistory();

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener("keydown",e=>{
  if(e.ctrlKey||e.metaKey){
    if(e.key==="k"||e.key==="K"){e.preventDefault();input.focus()}
    if(e.key==="n"||e.key==="N"){e.preventDefault();resetChat()}
    if(e.key==="e"||e.key==="E"){e.preventDefault();exportChatToFile()}
    if(e.key==="l"||e.key==="L"){e.preventDefault();resetChat()}
  }
  if(e.key==="Escape"){closeHackMode();closeSide()}
});

// ===== PWA SERVICE WORKER & INSTALL =====
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

let deferredPrompt;
const installAppBtn = $("installAppBtn");
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if(installAppBtn) installAppBtn.style.display = "flex";
});
installAppBtn?.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installAppBtn.style.display = "none";
    }
    deferredPrompt = null;
  }
});

// ===== MANUS-STYLE INTRO =====
document.addEventListener("DOMContentLoaded", async () => {
  const intro = $("introScreen");
  const typing = $("introTyping");
  const introLogo = $("introLogo");
  
  if (intro && typing && introLogo) {
    if (!sessionStorage.getItem("aryax-intro-seen")) {
      const lines = [
        "Initializing Artificial Human Mind...", 
        "Loading Neural Networks...", 
        "Bypassing Security Protocols...", 
        "AryaX System Online."
      ];
      for (let line of lines) {
        typing.innerHTML = "";
        for (let char of line) {
          typing.innerHTML += char;
          await new Promise(r => setTimeout(r, 40));
        }
        await new Promise(r => setTimeout(r, 400));
      }
      typing.style.display = "none";
      introLogo.style.display = "block";
      await new Promise(r => setTimeout(r, 1500));
      intro.style.opacity = "0";
      intro.style.visibility = "hidden";
      sessionStorage.setItem("aryax-intro-seen", "true");
    } else {
      intro.style.display = "none";
    }
  }
});

// ===== PAYMENT (DIRECT UPI) =====
upgradeBtn?.addEventListener("click", () => {
  pricingOverlay.style.display = "flex";
  document.querySelector('.plans-grid').style.display = 'grid';
  $('upiScreen').style.display = 'none';
});
pricingClose?.addEventListener("click", () => {
  pricingOverlay.style.display = "none";
});
$('backToPlans')?.addEventListener("click", () => {
  document.querySelector('.plans-grid').style.display = 'grid';
  $('upiScreen').style.display = 'none';
});

let selectedPlan = "";

document.querySelectorAll(".plan-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    if(btn.disabled) return;
    const plan = btn.getAttribute("data-plan");
    const amount = btn.getAttribute("data-amount"); // in paise
    if(!plan || !amount) return;

    selectedPlan = plan;
    const amountRupees = amount / 100;
    
    // Setup UPI Screen
    document.querySelector('.plans-grid').style.display = 'none';
    $('upiScreen').style.display = 'block';
    $('upiAmountText').textContent = "₹" + amountRupees;
    $('upiPlanText').textContent = plan === 'plus' ? 'AryaX Plus' : 'AryaX Premium Plus';
    
    // Generate UPI URI
    const upiId = "9510225996@fam";
    const upiUri = `upi://pay?pa=${upiId}&pn=AryaX%20AI&am=${amountRupees}.00&cu=INR`;
    $('upiQR').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
  });
});

$('verifyUpiBtn')?.addEventListener("click", async () => {
  const utr = $('upiUtr').value.trim();
  if(utr.length < 12) {
    alert("Please enter a valid 12-digit UTR number.");
    return;
  }
  
  $('verifyUpiBtn').textContent = "Verifying...";
  $('verifyUpiBtn').disabled = true;
  
  try {
    const res = await fetch('/api/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, plan: selectedPlan, utr: utr })
    });
    const data = await res.json();
    
    if(data.ok) {
      alert("Payment Verified! Welcome to the " + (selectedPlan === "plus" ? "Plus" : "Premium Plus") + " Plan.");
      const sparkSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
      const diamondSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
      userPlan.innerHTML = selectedPlan === "plus" ? sparkSvg + " AryaX Plus" : diamondSvg + " AryaX Premium Plus";
      creditCount.textContent = selectedPlan === "plus" ? "25000" : "∞";
    } else {
      alert("Error: " + (data.error || "Verification failed"));
    }
  } catch(e) {
    alert("Network error. Please try again.");
  }
  
  $('verifyUpiBtn').textContent = "Verify Payment";
  $('verifyUpiBtn').disabled = false;
});

// ===== UTILITIES =====
function copyCode(btn){
  const code=btn.closest("pre").querySelector("code").innerText;
  navigator.clipboard.writeText(code);
  const old=btn.textContent;btn.textContent="Copied!";
  setTimeout(()=>btn.textContent=old,2000);
}

function runArtifact(btn, lang){
  const code = btn.closest("pre").querySelector("code").innerText;
  window.lastArtifactCode = code;
  if(['html', 'css', 'javascript'].includes(lang.toLowerCase())){
    const fullHtml = lang.toLowerCase()==='html'?code:`<html><head><style>${lang.toLowerCase()==='css'?code:''}</style></head><body><div id="root"></div>${lang.toLowerCase()==='html'?'':code}${lang.toLowerCase()==='javascript'?`<script>${code}<\/script>`:''}</body></html>`;
    window.lastArtifactCode = fullHtml;
    const blob = new Blob([fullHtml], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    showArtifact(`
      <div style="display:flex; justify-content:flex-end; padding:10px; border-bottom:1px solid var(--border); background:var(--surface);">
        <button class="quick-btn" onclick="window.open('${url}', '_blank')">🚀 Open in New Tab</button>
        <button class="quick-btn" onclick="downloadCode()" style="margin-left:8px;">💾 Save HTML</button>
      </div>
      <iframe src="${url}" style="width:100%;flex:1;border:none;background:#fff" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"></iframe>
    `, "Web App Preview");
  } else if(lang.toLowerCase()==='python') {
    showArtifact(`
      <div style="padding:20px;color:#fff;font-family:'JetBrains Mono',monospace;height:100%;display:flex;flex-direction:column;background:#000;">
        <h3 style="color:#06b6d4;margin-bottom:10px;">Python Cloud Sandbox</h3>
        <pre style="background:#111;padding:15px;border-radius:8px;border:1px solid #333;overflow-y:auto;max-height:30%;"><code style="color:#a78bfa;">${code}</code></pre>
        <p style="color:#10b981;margin-top:10px;" id="pyStatus">> Initializing Pyodide Engine...</p>
        <div id="pyOutput" style="flex:1;background:#0a0a0a;padding:15px;border:1px solid #222;border-radius:8px;margin-top:10px;overflow-y:auto;white-space:pre-wrap;color:#e4e4e7;"></div>
      </div>
    `, "Python Sandbox execution");
    
    // Execute python via Pyodide
    (async function(){
      const statusEl = document.getElementById('pyStatus');
      const outputEl = document.getElementById('pyOutput');
      try {
        const pyodide = await initPyodide();
        statusEl.innerHTML = "> Executing script...";
        
        // Capture stdout
        pyodide.setStdout({ batched: (msg) => { outputEl.innerHTML += msg + "\\n"; } });
        
        await pyodide.runPythonAsync(code);
        statusEl.innerHTML = "> Execution completed successfully.";
        statusEl.style.color = "#10b981";
      } catch (err) {
        statusEl.innerHTML = "> Execution Failed.";
        statusEl.style.color = "#ef4444";
        outputEl.innerHTML += "\\nError: " + err.message;
        outputEl.style.color = "#ef4444";
      }
    })();
  } else {
    showArtifact(`<div style="padding:40px;text-align:center;color:var(--text-muted);">Runtime for ${lang} is currently in beta and not yet available.</div>`, "Execution Unavailable");
  }
}

async function downloadOffice(type, content) {
  try {
    const res = await fetch('/api/generate_office', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content })
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aryax_export.${type}`;
    a.click();
  } catch(e) { alert("Failed to generate file."); }
}
function setInput(text){
  if(!input) return;
  input.value = text;
  input.focus();
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}

// ===== ARYAX ALIVE — HUMAN MIND SYSTEM =====
const orb = $("aryaxOrb");
const orbTooltip = $("orbTooltip");
const orbStatusText = $("orbStatusText");
const ttsBar = $("ttsBar");
const ttsStopBtn = $("ttsStopBtn");

// Orb States
function setOrbState(state) {
  if (!orb) return;
  orb.classList.remove("speaking", "thinking");
  if (state === "speaking") {
    orb.classList.add("active", "speaking");
    orb.innerHTML = `<div class="voice-wave"><span></span><span></span><span></span><span></span><span></span></div>`;
    if (ttsEnabled) ttsBar && ttsBar.classList.add("active");
  } else if (state === "thinking") {
    orb.classList.add("active", "thinking");
    orb.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C12 16.477 7.52285 12 2 12C7.52285 12 12 7.52285 12 2C12 7.52285 16.4772 12 22 12C16.4772 12 12 16.477 12 22Z"/></svg>`;
    ttsBar && ttsBar.classList.remove("active");
  } else {
    // Idle — hide orb completely
    orb.classList.remove("active");
    orb.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C12 16.477 7.52285 12 2 12C7.52285 12 12 7.52285 12 2C12 7.52285 16.4772 12 22 12C16.4772 12 12 16.477 12 22Z"/></svg>`;
    ttsBar && ttsBar.classList.remove("active");
  }
}

// Orb click — no tooltip, just nice ripple feedback
orb?.addEventListener("click", () => {
  orb.style.transform = "scale(0.9)";
  setTimeout(() => orb.style.transform = "", 150);
});

// Stop TTS
ttsStopBtn?.addEventListener("click", () => {
  window.speechSynthesis?.cancel();
  setOrbState("idle");
});

// Emotion Detection from AI response text
function detectEmotion(text) {
  const t = text.toLowerCase();
  if (/error|fail|cannot|sorry|apologize|problem|issue/i.test(t)) return { cls: "emotion-serious", icon: "⚠️", label: "Serious" };
  if (/amazing|incredible|fantastic|wonderful|excellent|brilliant|perfect|wow|great/i.test(t)) return { cls: "emotion-excited", icon: "🔥", label: "Excited" };
  if (/happy|glad|sure|absolutely|of course|love|enjoy|pleasure|welcome/i.test(t)) return { cls: "emotion-happy", icon: "😊", label: "Happy" };
  if (/think|analyze|consider|reasoning|step|process|calculating|understand/i.test(t)) return { cls: "emotion-thinking", icon: "🧠", label: "Thinking" };
  return { cls: "emotion-calm", icon: "✨", label: "Calm" };
}

// Override createBotMessage to add heartbeat dot + emotion
const _origCreateBotMsg = createBotMessage;
window.createBotMessage = function() {
  $("typingWrap")?.remove();
  const wrap = document.createElement("div"); wrap.className = "msg-wrap bot-wrap";
  const label = document.createElement("div"); label.className = "msg-label aryax-label";
  label.innerHTML = `<span class="heartbeat-dot" style="width:6px;height:6px;margin-right:4px;"></span>ARYAX`;
  const msg = document.createElement("div"); msg.className = "msg bot-msg";
  msg.innerHTML = '<span class="streaming-cursor"></span>';
  wrap.appendChild(label); wrap.appendChild(msg); chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  setOrbState("thinking");
  return msg;
};

// Override addBotMessage to add emotion badge
const _origAddBotMsg = addBotMessage;
window.addBotMessage = function(text) {
  removeTyping();
  const wrap = document.createElement("div"); wrap.className = "msg-wrap bot-wrap";
  const emotion = detectEmotion(text);
  const label = document.createElement("div"); label.className = "msg-label aryax-label";
  label.innerHTML = `<span class="heartbeat-dot" style="width:6px;height:6px;margin-right:4px;"></span>ARYAX<span class="emotion-badge ${emotion.cls}">${emotion.icon} ${emotion.label}</span>`;
  const msg = document.createElement("div"); msg.className = "msg bot-msg";
  msg.innerHTML = renderMarkdown(text);
  if (/\<html[\s\S]*\<\/html\>/i.test(text) || text.includes("<!DOCTYPE html")) {
    const btn = document.createElement("button"); btn.textContent = "▶ Run"; btn.className = "copy-btn";
    btn.style.cssText = "margin-top:8px;padding:6px 14px;font-size:12px;";
    btn.onclick = () => runGame(text); msg.appendChild(btn);
  }
  wrap.appendChild(label); wrap.appendChild(msg); chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
};

// Enhanced speakText with orb animation
const _origSpeakText = speakText;
window.speakText = function(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  // Auto-enable TTS if user hasn't explicitly disabled
  if (!ttsEnabled) {
    // silent — don't speak unless TTS is on
    setOrbState("idle");
    return;
  }

  const clean = text.replace(/```[\s\S]*?```/g,'code block').replace(/[#*_~`>|]/g,'').replace(/\[.*?\]\(.*?\)/g,'link').substring(0, 500);
  if (!clean.trim()) { setOrbState("idle"); return; }

  // Pick best Indian English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes("Google") && v.lang.includes("en")) ||
                    voices.find(v => v.lang === "en-IN") ||
                    voices.find(v => v.lang.startsWith("en")) || voices[0];

  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 1.0; u.pitch = 1.05; u.volume = 1;
  if (preferred) u.voice = preferred;

  u.onstart = () => setOrbState("speaking");
  u.onend   = () => setOrbState("idle");
  u.onerror  = () => setOrbState("idle");
  window.speechSynthesis.speak(u);
};

// Hook into sendMessage to set orb thinking while typing
const _origSendMessage = sendMessage;
window.sendMessage = async function() {
  setOrbState("thinking");
  await _origSendMessage();
  // idle state is set by speakText or after reply
  if (!ttsEnabled) setOrbState("idle");
};

// When [DONE] received in streaming — add emotion badge
// This is handled via the overridden createBotMessage/addBotMessage pattern
// Additionally patch the streaming done handler
const _origRenderMarkdown = renderMarkdown;
window._humanPatchDone = function(fullText, botEl) {
  const emotion = detectEmotion(fullText);
  // Find the label of this message's wrapper
  const wrap = botEl.closest(".bot-wrap");
  const label = wrap?.querySelector(".msg-label");
  if (label && !label.querySelector(".emotion-badge")) {
    label.innerHTML = `<span class="heartbeat-dot" style="width:6px;height:6px;margin-right:4px;"></span>ARYAX<span class="emotion-badge ${emotion.cls}">${emotion.icon} ${emotion.label}</span>`;
  }
  setOrbState("idle");
};

// Patch the streaming DONE event to call human patch
// We hook into the existing sendMessage flow via MutationObserver on chat
// to catch when streaming cursor is removed and apply emotion
const chatObserver = new MutationObserver(() => {
  document.querySelectorAll(".bot-wrap").forEach(wrap => {
    if (!wrap.dataset.emotionApplied && !wrap.querySelector(".streaming-cursor")) {
      const label = wrap.querySelector(".msg-label");
      const msgEl = wrap.querySelector(".bot-msg");
      if (label && msgEl && msgEl.textContent.trim()) {
        const emotion = detectEmotion(msgEl.textContent);
        if (!label.querySelector(".emotion-badge")) {
          label.innerHTML = `<span class="heartbeat-dot" style="width:6px;height:6px;margin-right:4px;"></span>ARYAX<span class="emotion-badge ${emotion.cls}">${emotion.icon} ${emotion.label}</span>`;
        }
        wrap.dataset.emotionApplied = "1";
      }
    }
  });
});
if (chat) chatObserver.observe(chat, { childList: true, subtree: true });

// Set idle initially
setOrbState("idle");
console.log("🧠 AryaX Human Mind System — Online");

// ===== MEMORY SYSTEM =====
let userMemory = {};
async function loadUserMemory() {
  if (!currentUser) return;
  try {
    const r = await fetch(`/api/memory/load?username=${currentUser}`);
    const d = await r.json();
    userMemory = d.memory || {};
    // Inject memory into system if user has a name set
    if (userMemory.name) {
      console.log(`🧠 Memory: User is ${userMemory.name}`);
    }
  } catch {}
}
async function saveUserMemory(key, value) {
  userMemory[key] = value;
  if (!currentUser) return;
  try {
    await fetch('/api/memory/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, memory: userMemory })
    });
  } catch {}
}
// Auto-detect name from chat messages
function extractNameFromMessage(msg) {
  const m = msg.match(/(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]+)/i);
  if (m) { saveUserMemory('name', m[1]); }
}

// ===== REFERRAL SYSTEM =====
async function showReferralCode() {
  if (!currentUser) { alert('Please login first'); return; }
  try {
    const r = await fetch('/api/referral/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });
    const d = await r.json();
    if (d.code) {
      const msg = `🎁 Your Referral Code: ${d.code}\n\nShare with friends!\n✅ You earn +500 credits per referral\n✅ Friend gets +200 credits\n\nTotal referrals: ${d.count}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(d.code);
        alert(msg + '\n\n📋 Code copied to clipboard!');
      } else {
        alert(msg);
      }
    }
  } catch { alert('Could not generate referral code'); }
}
// Add referral button to sidebar tools
(function addReferralBtn() {
  const toolSection = document.querySelector('.sidebar-section:nth-child(3)');
  if (!toolSection) return;
  const btn = document.createElement('button');
  btn.className = 'tool-btn'; btn.id = 'referralBtn';
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Referral Code`;
  btn.addEventListener('click', showReferralCode);
  toolSection.appendChild(btn);
})();

// ===== ONLINE COUNT =====
async function loadOnlineCount() {
  try {
    const r = await fetch('/api/online');
    const d = await r.json();
    const dot = $('heartbeatDot');
    if (dot) dot.title = `${d.online} user${d.online !== 1 ? 's' : ''} online`;
  } catch {}
}
// Refresh online count every 60s
setInterval(loadOnlineCount, 60000);

// ===== SECURITY SHIELD (LITE) =====
(function initSecurity() {
  // Disable right-click on main app
  document.addEventListener('contextmenu', e => {
    if (!['textarea', 'input'].includes(e.target.tagName.toLowerCase())) e.preventDefault();
  });
  // Disable simple F12 and PrintScreen warning
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || e.key === 'PrintScreen') {
      console.clear();
      console.log('AryaX Security: Content Protected');
    }
  });
  console.log('🔒 AryaX Security Active');
})();


