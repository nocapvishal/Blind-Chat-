require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const nodemailer = require("nodemailer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* =========================
   CONFIG
========================= */

const PORT = process.env.PORT || 3000;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
const OTP_COOLDOWN_SECONDS = parseInt(process.env.OTP_COOLDOWN_SECONDS || "60");

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔴 IMPORTANT: Serve frontend correctly (Render fix)
app.use(express.static(path.join(__dirname, "../public")));

// 🔴 IMPORTANT: Explicit root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* =========================
   EMAIL (OTP)
========================= */

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});


const otps = {}; // { email: { code, expiresAt, lastSent } }

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email || !email.endsWith("@pondiuni.ac.in")) {
    return res.status(400).json({ error: "Invalid university email" });
  }

  const now = Date.now();
  const existing = otps[email];

  if (
    existing &&
    existing.lastSent &&
    now - existing.lastSent < OTP_COOLDOWN_SECONDS * 1000
  ) {
    return res.status(429).json({
      error: "Please wait before requesting another OTP",
    });
  }

  const otp = generateOTP();

  otps[email] = {
    code: otp,
    expiresAt: now + OTP_EXPIRY_MINUTES * 60 * 1000,
    lastSent: now,
  };

  try {
    await transporter.sendMail({
      from: `PU Blind Chat <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP for PU Blind Chat",
      text: `Your OTP is ${otp}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const record = otps[email];

  if (!record) {
    return res.status(400).json({ error: "OTP not found" });
  }

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

/* =========================
   SOCKET.IO (CHAT)
========================= */

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

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

  socket.on("message", (msg) => {
    if (socket.partner) {
      socket.partner.emit("message", msg);
    }
  });

  socket.on("disconnect", () => {
    if (waitingUser === socket) {
      waitingUser = null;
    }
    if (socket.partner) {
      socket.partner.emit("partner-disconnected");
      socket.partner.partner = null;
    }
    console.log("User disconnected:", socket.id);
  });
});

/* =========================
   START SERVER
========================= */

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
