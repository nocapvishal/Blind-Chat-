const socket = io();
let userProfile = null;

function show(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* LOGIN */
document.getElementById("loginBtn").onclick = () => {
  const email = emailInput.value.trim();
  if(!email.endsWith("@pondiuni.ac.in")){
    alert("Use university email");
    return;
  }
  show("profile-screen");
};

/* PROFILE SAVE */
saveProfileBtn.onclick = ()=>{
  userProfile = {
    dept: dept.value,
    course: course.value,
    ethnicity: ethnicity.value,
    year: year.value
  };
  show("start-screen");
};

skipProfileBtn.onclick = ()=>{
  show("start-screen");
};

/* START CHAT */
startBtn.onclick = ()=>{
  show("connecting-screen");
  socket.emit("start-chat");
};

socket.on("matched", ()=>{
  show("chat-screen");
});

/* CHAT */
sendBtn.onclick = ()=>{
  socket.emit("message", messageInput.value);
  chatBox.innerHTML += `<div>You: ${messageInput.value}</div>`;
  messageInput.value="";
};

socket.on("message", msg=>{
  chatBox.innerHTML += `<div>Stranger: ${msg}</div>`;
});

/* SKIP PARTNER */
skipBtn.onclick = ()=>{
  socket.emit("skip");
  show("connecting-screen");
};

/* REVEAL */
revealBtn.onclick = ()=>{
  if(!userProfile){
    alert("Fill details first!");
    show("profile-screen");
    return;
  }
  socket.emit("reveal", userProfile);
};

socket.on("revealed", profile=>{
  chatBox.innerHTML += `<hr>Partner revealed:
  ${profile.dept} | ${profile.course} | ${profile.year}`;
});
