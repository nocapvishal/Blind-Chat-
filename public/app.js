const socket=io({transports:["websocket"]});
const screens=document.querySelectorAll(".screen");
function show(id){screens.forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active");}

verifyBtn.onclick=()=>socket.emit("verify-email",emailInput.value);
socket.on("email-valid",()=>show("profile-screen"));
socket.on("email-invalid",()=>emailError.innerText="Use university email");

startBtn.onclick=()=>{
 const profile={
  nickname:nickname.value||"Student",
  gender:gender.value,
  prefGender:prefGender.value,
  intent:intent.value
 };
 show("search-screen");
 socket.emit("start-chat",profile);
};

socket.on("matched",name=>{
 partnerName.innerText="Chatting with "+name;
 show("chat-screen");
});

function sendMessage(){
 if(!msgInput.value) return;
 socket.emit("message",msgInput.value);
 chatBox.innerHTML+=`<div class="msg me">${msgInput.value}</div>`;
 msgInput.value="";
 chatBox.scrollTop=chatBox.scrollHeight;
}
sendBtn.onclick=sendMessage;
msgInput.addEventListener("keypress",e=>{if(e.key==="Enter") sendMessage();});

socket.on("message",msg=>{
 chatBox.innerHTML+=`<div class="msg them">${msg}</div>`;
});

msgInput.oninput=()=>socket.emit("typing");
socket.on("typing",()=>partnerName.innerText="Typing...");

skipBtn.onclick=()=>{socket.emit("skip");show("search-screen");chatBox.innerHTML="";}
