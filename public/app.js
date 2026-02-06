const socket = io({ transports:["websocket"] });

const screens=document.querySelectorAll(".screen");
function showScreen(id){
 screens.forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
}

startBtn.onclick=()=>{
 const profile={
  nickname:nickname.value||"Student",
  gender:gender.value,
  prefGender:prefGender.value,
  dept:dept.value,
  year:year.value
 };

 showScreen("search-screen");
 socket.emit("start-chat",profile);
};

socket.on("matched",name=>{
 partnerName.innerText="Chatting with "+name;
 showScreen("chat-screen");
});

sendBtn.onclick=()=>{
 socket.emit("message",msgInput.value);
 chatBox.innerHTML+=`<div class="msg me">${msgInput.value}</div>`;
 msgInput.value="";
 chatBox.scrollTop=chatBox.scrollHeight;
};

socket.on("message",msg=>{
 chatBox.innerHTML+=`<div class="msg them">${msg}</div>`;
 chatBox.scrollTop=chatBox.scrollHeight;
});

skipBtn.onclick=()=>{
 socket.emit("skip");
 showScreen("search-screen");
 chatBox.innerHTML="";
};
