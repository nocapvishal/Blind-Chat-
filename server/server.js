require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

const waiting = [];
const users = {};     // socket.id -> email
const otps = {};      // socket.id -> { code, expiresAt, lastSent }

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

io.on("connection", (socket) => {

  // SEND OTP
  socket.on("send-otp", async (email) => {
    if (!email || !email.endsWith("@pondiuni.ac.in")) {
      socket.emit("otp-error", "Only Pondicherry University emails allowed");
      return;
    }

    const now = Date.now();
    const cooldown = Number(process.env.OTP_COOLDOWN_SECONDS) * 1000;

    if (otps[socket.id]?.lastSent && now - otps[socket.id].lastSent < cooldown) {
      socket.emit("otp-error", "Please wait before requesting another OTP");
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiry = now + Number(process.env.OTP_EXPIRY_MINUTES) * 60 * 1000;

    otps[socket.id] = { code: otp, expiresAt: expiry, lastSent: now };
    users[socket.id] = email;

    await transporter.sendMail({
      from: `"PU Blind Chat" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your PU Blind Chat OTP",
      html: `
        <h2>PU Blind Chat</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for ${process.env.OTP_EXPIRY_MINUTES} minutes.</p>
      `
    });

    socket.emit("otp-sent");
  });

  // VERIFY OTP
  socket.on("verify-otp", (code) => {
    const record = otps[socket.id];
    if (!record) return socket.emit("otp-error", "OTP expired");

    if (Date.now() > record.expiresAt) {
      delete otps[socket.id];
      return socket.emit("otp-error", "OTP expired");
    }

    if (Number(code) !== record.code) {
      return socket.emit("otp-error", "Invalid OTP");
    }

    delete otps[socket.id];
    socket.verified = true;
    socket.emit("verified");
  });

  // START CHAT
  socket.on("start-chat", () => {
    if (!socket.verified) return;

    if (waiting.length > 0) {
      const partner = waiting.pop();
      socket.partner = partner;
      partner.partner = socket;

      socket.emit("matched");
      partner.emit("matched");
    } else {
      waiting.push(socket);
    }
  });

  // MESSAGE
  socket.on("send-message", (msg) => {
    socket.partner?.emit("receive-message", msg);
  });

  // REVEAL (mutual)
  socket.on("request-reveal", () => {
    if (!socket.partner) return;

    socket.reveal = true;
    if (socket.partner.reveal) {
      socket.emit("reveal-success", { email: users[socket.partner.id] });
      socket.partner.emit("reveal-success", { email: users[socket.id] });
      socket.reveal = socket.partner.reveal = false;
    }
  });

  // NEXT
  socket.on("next-chat", () => {
    if (socket.partner) {
      socket.partner.partner = null;
      socket.partner.emit("partner-left");
      socket.partner = null;
    }
    socket.emit("reset");
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


