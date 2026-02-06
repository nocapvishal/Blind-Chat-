const socket = io({ transports:["websocket"] });

const screens=document.querySelectorAll(".screen");
function show(id){
 screens.forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
}

/* START CHAT */
startBtn.onclick=()=>{
 const profile={
  nickname:nickname.value||"Student",
  gender:gender.value,
  prefGender:prefGender.value,
  dept:dept.value,
  year:year.value
 };
 show("search-screen");
 socket.emit("start-chat",profile);
};

socket.on("matched",name=>{
 partnerName.innerText="Chatting with "+name;
 show("chat-screen");
});

/* SEND MESSAGE */
function sendMessage(){
 if(!msgInput.value.trim()) return;
 socket.emit("message",msgInput.value);
 chatBox.innerHTML+=`<div class="msg me">${msgInput.value}</div>`;
 msgInput.value="";
 chatBox.scrollTop=chatBox.scrollHeight;
}
sendBtn.onclick=sendMessage;

/* ENTER KEY SEND */
msgInput.addEventListener("keypress",e=>{
 if(e.key==="Enter") sendMessage();
});

/* RECEIVE MESSAGE */
socket.on("message",msg=>{
 chatBox.innerHTML+=`<div class="msg them">${msg}</div>`;
 chatBox.scrollTop=chatBox.scrollHeight;
});

/* TYPING */
let typingTimeout;
msgInput.addEventListener("input",()=>{
 socket.emit("typing");
});
socket.on("typing",()=>{
 partnerName.innerHTML=`
  <div class="typing">
   <div class="dot"></div>
   <div class="dot"></div>
   <div class="dot"></div>
  </div>`;
 setTimeout(()=>partnerName.innerText="Chatting...",1000);
});

/* SKIP */
skipBtn.onclick=()=>{
 socket.emit("skip");
 chatBox.innerHTML="";
 show("search-screen");
};

/* GROUP OFFER */
socket.on("group-offer",()=>{
 if(confirm("No partner found. Join group chat?")){
   socket.emit("join-group");
 }
});
socket.on("group-matched",()=>{
 partnerName.innerText="🎉 Group Chat Started";
});
