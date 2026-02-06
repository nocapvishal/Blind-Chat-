const socket = io({ transports:["websocket"] });

const startBtn = document.getElementById("startBtn");
const sendBtn = document.getElementById("sendBtn");
const skipBtn = document.getElementById("skipBtn");

const profileScreen = document.getElementById("profile-screen");
const chatScreen = document.getElementById("chat-screen");
const chatBox = document.getElementById("chatBox");
const partnerName = document.getElementById("partnerName");
const msgInput = document.getElementById("msgInput");

let profile = {};

startBtn.onclick = () => {
  profile = {
    nickname: document.getElementById("nickname").value || "Student",
    gender: document.getElementById("gender").value,
    prefGender: document.getElementById("prefGender").value,
    dept: document.getElementById("dept").value,
    year: document.getElementById("year").value
  };

  profileScreen.style.display = "none";
  chatScreen.style.display = "block";

  socket.emit("start-chat", profile);
};

socket.on("matched", name => {
  partnerName.innerText = "Chatting with " + name;
});

sendBtn.onclick = () => {
  if(!msgInput.value) return;

  socket.emit("message", msgInput.value);
  chatBox.innerHTML += `<div class="msg me">${msgInput.value}</div>`;
  msgInput.value="";
  chatBox.scrollTop=chatBox.scrollHeight;
};

socket.on("message", msg => {
  chatBox.innerHTML += `<div class="msg them">${msg}</div>`;
  chatBox.scrollTop=chatBox.scrollHeight;
});

msgInput.oninput = () => socket.emit("typing");

socket.on("typing", () => {
  partnerName.innerText="Typing...";
  setTimeout(()=>partnerName.innerText="",1000);
});

skipBtn.onclick = () => {
  socket.emit("skip");
  chatBox.innerHTML="";
  partnerName.innerText="Searching new partner...";
};

socket.on("group-offer", () => {
  if(confirm("No partner found. Join group chat?")) {
    socket.emit("join-group");
  }
});

socket.on("group-matched", () => {
  partnerName.innerText="🎉 Group Chat Started";
});
