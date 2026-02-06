const socket = io({transports:["websocket"],secure:true});
let profile=null;

function show(id){
 document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
}

loginBtn.onclick=()=>{
 if(!emailInput.value.endsWith("@pondiuni.ac.in")) return alert("Use university email");
 show("profile-screen");
};

saveProfileBtn.onclick=()=>{
 profile={dept:dept.value,course:course.value,year:year.value};
 show("start-screen");
};
skipProfileBtn.onclick=()=>show("start-screen");

startBtn.onclick=()=>{
 show("connecting-screen");
 socket.emit("start-chat");
};

socket.on("waiting",()=>status.innerText="Waiting for another student...");
socket.on("matched",(nick)=>{
 partnerName.innerText="Chatting with "+nick;
 show("chat-screen");
});

socket.on("online-count",c=>onlineCount.innerText="Online: "+c);

messageInput.oninput=()=>socket.emit("typing");
socket.on("typing",()=>{
 typingIndicator.innerText="Typing...";
 setTimeout(()=>typingIndicator.innerText="",1000);
});

sendBtn.onclick=()=>{
 socket.emit("message",messageInput.value);
 chatBox.innerHTML+=`<div class="msg me">${messageInput.value}</div>`;
 messageInput.value="";
 chatBox.scrollTop=chatBox.scrollHeight;
};

socket.on("message",msg=>{
 chatBox.innerHTML+=`<div class="msg them">${msg}</div>`;
 chatBox.scrollTop=chatBox.scrollHeight;
});

skipBtn.onclick=()=>{
 socket.emit("skip");
 show("connecting-screen");
};

socket.on("partner-left",()=>{
 alert("Partner left");
 show("start-screen");
});
