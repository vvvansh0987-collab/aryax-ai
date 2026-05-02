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
const upgradeBtn = $("upgradeBtn"), pricingOverlay = $("pricingOverlay");
const pricingClose = $("pricingClose"), userPlan = $("userPlan");

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

function loginSuccess(username,credits){
  currentUser=username;
  localStorage.setItem("aryax-user",username);
  authOverlay.style.display="none";
  mainApp.style.display="flex";
  $("userName").textContent=username;
  $("userAvatar").textContent=username[0].toUpperCase();
  creditCount.textContent=credits;
  input.focus();
}

logoutBtn?.addEventListener("click",()=>{
  localStorage.removeItem("aryax-user");
  currentUser=null;
  authOverlay.style.display="flex";
  mainApp.style.display="none";
});

// Auto login
(async()=>{
  const saved=localStorage.getItem("aryax-user");
  if(saved){
    try{
      const r=await fetch(`/api/credits?username=${saved}`);
      const d=await r.json();
      if(r.ok){loginSuccess(saved,d.credits);return}
    }catch{}
  }
  authOverlay.style.display="flex";
  mainApp.style.display="none";
})();

// ===== THEME =====
function applyTheme(dark){
  isDark=dark;
  document.documentElement.setAttribute("data-theme",dark?"dark":"light");
  themeToggle.textContent=dark?"🌙 Dark Mode":"☀️ Light Mode";
  localStorage.setItem("aryax-theme",dark?"dark":"light");
}
themeToggle?.addEventListener("click",()=>applyTheme(!isDark));
const savedTheme = localStorage.getItem("aryax-theme");
applyTheme(savedTheme === "dark"); // Default to light if nothing saved

// ===== SIDEBAR =====
menuBtn?.addEventListener("click",()=>{sidebar.classList.add("open");overlay.classList.add("show")});
overlay?.addEventListener("click",closeSide);
closeSidebarBtn?.addEventListener("click",closeSide);
function closeSide(){sidebar.classList.remove("open");overlay.classList.remove("show")}

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
  let html=marked.parse(text);
  html=html.replace(/<pre><code class="language-(\w+)">/g,(_,lang)=>
    `<pre><div class="code-header"><span class="code-lang">${lang}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code class="language-${lang}">`);
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
  chat.innerHTML=`<div class="welcome" id="welcome"><div class="welcome-logo">⚡</div><h1>AryaX AI</h1>
    <p class="welcome-tagline">Next-generation AI — Beyond human intelligence</p>
    <div class="welcome-stats"><div class="stat"><span class="stat-num">17+</span><span class="stat-label">AI Modes</span></div>
    <div class="stat"><span class="stat-num">∞</span><span class="stat-label">Knowledge</span></div>
    <div class="stat"><span class="stat-num">5000</span><span class="stat-label">Daily Credits</span></div></div>
    <div class="quick-grid">
      <button class="quick-btn" data-msg="Write a Python web scraper with BeautifulSoup">💻 Python Scraper</button>
      <button class="quick-btn" data-msg="Teach me ethical hacking basics">🔒 Learn Hacking</button>
      <button class="quick-btn" data-msg="Build a SaaS landing page">🌐 Build Website</button>
      <button class="quick-btn" data-msg="Solve: integrate x^2 * e^x dx">🧮 Solve Calculus</button>
      <button class="quick-btn" data-msg="Create a Flappy Bird game in HTML/CSS/JS">🎮 Flappy Bird</button>
      <button class="quick-btn" data-msg="Write essay on AI impact on society">📝 Write Essay</button>
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
  ttsToggle.textContent=ttsEnabled?"🔊":"🔇";
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

// ===== FILE UPLOAD =====
fileUpload?.addEventListener("change",async e=>{
  const file=e.target.files[0];
  if(!file)return;
  if(file.size>500000){alert("File too large! Max 500KB");return}
  const text=await file.text();
  const preview=text.length>2000?text.substring(0,2000)+"\n...(truncated)":text;
  input.value=`Analyze this file (${file.name}):\n\n\`\`\`\n${preview}\n\`\`\``;
  input.style.height="auto";input.style.height=Math.min(input.scrollHeight,150)+"px";
  fileUpload.value="";
  input.focus();
});

function exportChatToFile(){
  if(chatHistory.length===0){alert("No chat to export!");return}
  let text="=== AryAX Chat Export ===\nDate: "+new Date().toLocaleString()+"\n\n";
  chatHistory.forEach(m=>{
    text+=(m.role==="user"?"👤 YOU":"🤖 ARYAX")+":\n"+m.text+"\n\n";
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

// ===== CHAT HISTORY SAVE/LOAD =====
function saveChatToHistory(title){
  const saved=JSON.parse(localStorage.getItem("aryax-chats")||"[]");
  saved.unshift({id:sessionId,title:title.substring(0,40),messages:chatHistory.slice(),date:Date.now()});
  if(saved.length>20)saved.length=20;
  localStorage.setItem("aryax-chats",JSON.stringify(saved));
  renderChatHistory();
}
function renderChatHistory(){
  const saved=JSON.parse(localStorage.getItem("aryax-chats")||"[]");
  recentList.innerHTML="";
  if(!saved.length){recentList.innerHTML='<p class="empty-hint">No saved chats</p>';return}
  saved.forEach((ch,i)=>{
    const item=document.createElement("div");
    item.className="recent-item";
    item.innerHTML=`<span>${ch.title||"Chat "+(i+1)}</span><button class="del-btn" title="Delete">✕</button>`;
    item.querySelector("span").addEventListener("click",()=>loadChat(ch));
    item.querySelector(".del-btn").addEventListener("click",e=>{e.stopPropagation();deleteChat(i)});
    recentList.appendChild(item);
  });
}
function loadChat(ch){
  sessionId=ch.id||uid();firstMsg=false;chatHistory=ch.messages||[];
  $("welcome")?.remove();
  chat.innerHTML="";
  chatHistory.forEach(m=>{
    if(m.role==="user")addUserMessage(m.text);
    else addBotMessage(m.text);
  });
  closeSide();
}
function deleteChat(index){
  const saved=JSON.parse(localStorage.getItem("aryax-chats")||"[]");
  saved.splice(index,1);
  localStorage.setItem("aryax-chats",JSON.stringify(saved));
  renderChatHistory();
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

// ===== PWA SERVICE WORKER =====
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

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
    $('upiPlanText').textContent = plan === 'pro' ? 'Pro Plan' : 'Ultra Plan';
    
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
      alert("Payment Verified! Welcome to the " + (selectedPlan === "pro" ? "Pro" : "Ultra") + " Plan.");
      pricingOverlay.style.display = "none";
      userPlan.textContent = selectedPlan === "pro" ? "⚡ Pro Plan" : "💎 Ultra Plan";
      creditCount.textContent = selectedPlan === "pro" ? "20000" : "∞";
    } else {
      alert("Error: " + (data.error || "Verification failed"));
    }
  } catch(e) {
    alert("Network error. Please try again.");
  }
  
  $('verifyUpiBtn').textContent = "Verify Payment";
  $('verifyUpiBtn').disabled = false;
});