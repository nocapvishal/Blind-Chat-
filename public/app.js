/* =========================
   SCREEN HANDLER
========================= */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
}

/* =========================
   EMAIL → SEND OTP
========================= */
const emailInput = document.getElementById("emailInput");
const sendOtpBtn = document.getElementById("sendOtpBtn");

sendOtpBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  if (!email) {
    alert("Please enter your email");
    return;
  }

  if (!email.endsWith("@pondiuni.ac.in")) {
    alert("Only Pondicherry University emails allowed");
    return;
  }

  sendOtpBtn.disabled = true;
  sendOtpBtn.innerText = "Sending OTP...";

  try {
    const res = await fetch("/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send OTP");

    showScreen("otp-screen");
  } catch (err) {
    alert(err.message || "Server error");
  } finally {
    sendOtpBtn.disabled = false;
    sendOtpBtn.innerText = "Continue";
  }
});

/* =========================
   VERIFY OTP
========================= */
const otpInput = document.getElementById("otpInput");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");

verifyOtpBtn.addEventListener("click", async () => {
  const otp = otpInput.value.trim();
  const email = emailInput.value.trim();

  if (!otp) {
    alert("Enter the OTP");
    return;
  }

  verifyOtpBtn.disabled = true;
  verifyOtpBtn.innerText = "Verifying...";

  try {
    const res = await fetch("/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "OTP verification failed");

    showScreen("start-screen");
  } catch (err) {
    alert(err.message || "OTP verification failed");
  } finally {
    verifyOtpBtn.disabled = false;
    verifyOtpBtn.innerText = "Verify";
  }
});

/* =========================
   START CHAT
========================= */
const startBtn = document.getElementById("startBtn");

let socket = null;

startBtn.addEventListener("click", () => {
  showScreen("connecting-screen");

  socket = io();

  socket.on("waiting", () => {
    console.log("Waiting for match...");
  });

  socket.on("matched", () => {
    showScreen("chat-screen");
  });

  socket.on("message", (msg) => {
    addMessage(msg, "them");
  });

  socket.on("partner-disconnected", () => {
    alert("Partner disconnected");
    showScreen("start-screen");
  });
});

/* =========================
   CHAT MESSAGES
========================= */
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");

sendMessageBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage()
