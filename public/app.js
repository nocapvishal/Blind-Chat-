const socket = io();

const screens = {
  email: "email-screen",
  otp: "otp-screen",
  start: "start-screen",
  connect: "connecting-screen",
  chat: "chat-screen"
};

function show(name) {
  Object.values(screens).forEach(id =>
    document.getElementById(id).classList.remove("active")
  );
  document.getElementById(screens[name]).classList.add("active");
}

document.getElementById("sendOtpBtn").onclick = () =>
  socket.emit("send-otp", emailInput.value.trim());

document.getElementById("verifyOtpBtn").onclick = () =>
  socket.emit("verify-otp", otpInput.value.trim());

document.getElementById("startBtn").onclick = () => {
  show("connect");
  socket.emit("start-chat");
};

document.getElementById("sendBtn").onclick = () => {
  const msg = messageInput.value.trim();
  if (!msg) return;
  add(msg, "sent");
  socket.emit("send-message", msg);
  messageInput.value = "";
};

document.getElementById("nextBtn").onclick = () => {
  chatBox.innerHTML = "";
  show("connect");
  socket.emit("next-chat");
};

document.getElementById("revealBtn").onclick = () =>
  socket.emit("request-reveal");

socket.on("otp-sent", () => show("otp"));
socket.on("verified", () => show("start"));
socket.on("matched", () => show("chat"));
socket.on("receive-message", m => add(m, "received"));
socket.on("reveal-success", d => system(`Revealed: ${d.email}`));
socket.on("partner-left", () => system("Partner disconnected"));

function add(text, cls) {
  const d = document.createElement("div");
  d.className = `message ${cls}`;
  d.innerText = text;
  chatBox.appendChild(d);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function system(text) {
  add(text, "received");
}
