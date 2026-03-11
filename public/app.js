const socket = io("http://localhost:3001", { 
  transports: ["websocket"] 
});
const screens=document.querySelectorAll(".screen");
function show(id){screens.forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active");}

// 1. Ask server to send the OTP
verifyBtn.onclick = () => {
  const email = emailInput.value.trim();
  console.log("Requesting OTP for:", email);
  socket.emit("send-otp", email); // Matches backend socket.on("send-otp")
};

// 2. Handle the server's response
const otpSection = document.getElementById("otp-section");
const otpInput = document.getElementById("otpInput");
const submitOtpBtn = document.getElementById("submitOtpBtn");

// 1. When OTP is sent, show the input field
socket.on("otp-sent", () => {
  otpSection.style.display = "block"; 
  verifyBtn.style.display = "none"; // Hide the "Continue" button
  alert("Code sent to your email!");
});

// 2. Handle the manual verification
submitOtpBtn.onclick = () => {
  const otp = otpInput.value.trim();
  const email = emailInput.value.trim();
  
  if (otp.length === 6) {
    socket.emit("verify-otp", { email, otp });
  } else {
    alert("Please enter a valid 6-digit code.");
  }
};

// 3. If valid, show the next screen
socket.on("email-valid", () => {
  show("profile-screen");
});

// 3. Move to profile only if OTP is valid
socket.on("email-valid", () => {
  show("profile-screen");
});

socket.on("email-invalid", (msg) => {
  emailError.innerText = msg;
  alert(msg);
});

// 2. Handle the server's response
socket.on("otp-sent", () => {
  const userOtp = prompt("Enter the 6-digit code sent to your email:");
  if (userOtp) {
    socket.emit("verify-otp", { email: emailInput.value, otp: userOtp });
  }
});

// 3. Move to profile only if OTP is valid
socket.on("email-valid", () => {
  show("profile-screen");
});

socket.on("email-invalid", (msg) => {
  emailError.innerText = msg;
  alert(msg);
});

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

// Handle sending messages (s)
function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  // Don't append HTML here! Let the socket.on("message") handle it.
  socket.emit("message", text); 
  msgInput.value = "";
}
sendBtn.onclick=sendMessage;
msgInput.addEventListener("keypress",e=>{if(e.key==="Enter") sendMessage();});

socket.on("message", (msg) => {
  // Check if I sent this message or the other person did
  const isMe = msg.senderId === socket.id;
  const msgClass = isMe ? "me" : "them";
  
  chatBox.innerHTML += `<div class="msg ${msgClass}">${msg.text}</div>`;
  
  // Auto-scroll to bottom
  chatBox.scrollTop = chatBox.scrollHeight;
});

msgInput.oninput=()=>socket.emit("typing");
socket.on("typing",()=>partnerName.innerText="Typing...");

skipBtn.onclick=()=>{socket.emit("skip");show("search-screen");chatBox.innerHTML="";}
