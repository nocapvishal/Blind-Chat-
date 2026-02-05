require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const OTP_COOLDOWN_SECONDS = Number(process.env.OTP_COOLDOWN_SECONDS || 60);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});


// ================= OTP STORAGE =================

const otps = {}; 
// email → { code, expiresAt, lastSent }

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


// ================= SEND OTP =================

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email || !email.endsWith("@pondiuni.ac.in")) {
    return res.status(400).json({ error: "Only Pondicherry University emails allowed" });
  }

  const now = Date.now();
  const existing = otps[email];

  if (existing && now - existing.lastSent < OTP_COOLDOWN_SECONDS * 1000) {
    return res.status(429).json({ error: "Please wait before requesting another OTP" });
  }

  const otp = generateOTP();

  otps[email] = {
    code: otp,
    expiresAt: now + OTP_EXPIRY_MINUTES * 60 * 1000,
    lastSent: now,
  };

  try {
    await sgMail.send({
      to: email,
      from: "nocapvishal@gmail.com", // verified sender
      subject: "Blind Chat OTP",
      text: `Your OTP for Blind Chat is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("SENDGRID ERROR:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});


// ================= VERIFY OTP =================

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const record = otps[email];

  if (!record) return res.status(400).json({ error: "OTP not found" });
  if (Date.now() > record.expiresAt) {
    delete otps[email];
    return res.status(400).json({ error: "OTP expired" });
  }

  if (record.code !== otp) {
    return res.status(400).json({ error: "Incorrect OTP" });
  }

  delete otps[email];
  res.json({ success: true });
});


// ================= SOCKET CHAT =================

let waitingUser = null;

io.on("connection", (socket) => {

  if (waitingUser) {
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit("matched");
    waitingUser.emit("matched");

    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit("waiting");
  }

  socket.on("message", msg => {
    if (socket.partner) {
      socket.partner.emit("message", msg);
    }
  });

  socket.on("disconnect", () => {
    if (waitingUser === socket) waitingUser = null;
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }
  });

});


// ================= START SERVER =================

server.listen(PORT, () => {
  console.log(`🚀 Blind Chat running on port ${PORT}`);
});
