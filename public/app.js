const socket = io({ transports:["websocket"], secure:true });

let userProfile=null;
function show(id){
 document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
}

/* LOGIN */
loginBtn.onclick=()=>{
 if(!emailInput.value.endsWith("@pondiuni.ac.in")){
   alert("Use university email"); return;
 }
 show("profile-screen");
};

/* PROFILE */
saveProfileBtn.onclick=()=>{
 userProfile={dept:dept.value,course:course.value,year:year.value};
 show("start-screen");
};
skipProfileBtn.onclick=()=>show("start-screen");

/* START CHAT */
startBtn.onclick=()=>{
 show("connecting-screen");
 socket.emit("start-chat");
};

socket.on("waiting",()=>{
 status.innerText="Searching for another student...";
});

socket.on("matched",(nickname)=>{
 partnerName.innerText="Chatting with "+nickname;
 show("chat-screen");
});

/* ONLINE COUNTER */
socket.on("online-count",count=>{
 onlineCount.innerText="Online: "+count;
});

/* TYPING INDICATOR */
messageInput.addEventListener("input",()=>{
 socket.emit("typing");
});
socket.on("typing",()=>{
 typingIndicator.innerText="Partner typing...";
 setTimeout(()=>typingIndicator.innerText="",1000);
});

/* CHAT */
sendBtn.onclick=()=>{
 socket.emit("message",messageInput.value);
 chatBox.innerHTML+=`<div>You: ${messageInput.value}</div>`;
 messageInput.value="";
};
socket.on("message",msg=>{
 chatBox.innerHTML+=`<div>Stranger: ${msg}</div>`;
});

/* SKIP */
skipBtn.onclick=()=>{
 socket.emit("skip");
 show("connecting-screen");
};

/* REPORT */
reportBtn.onclick=()=>{
 socket.emit("report");
 alert("User reported");
};

/* PARTNER LEFT */
socket.on("partner-left",()=>{
 alert("Partner left");
 show("start-screen");
});
