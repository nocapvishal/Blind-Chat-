require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const helmet = require("helmet");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const { createClient } = require("redis");
const Room = require("./models/Room");
const Report = require("./models/Report");
const MatchingService = require("./services/matching.service");
const {
  normalizeGender,
  normalizePreference,
  normalizeIntent,
  sanitizeMessage
} = require("./utils/validation");

const app = express();
app.use(helmet());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
  }
});

/* =========================
   DATABASE CONNECTION
========================= */

let dbConnected = false;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    dbConnected = true;
    console.log("✅ MongoDB Connected");
  })
  .catch(err => {
    console.error("Mongo Error:", err.message);
    console.log("⚠️ Running in memory-only mode (no DB)");
  });

/* =========================
   REDIS CONNECTION (ADD THIS HERE)
========================= */
const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('❌ Redis Client Error', err));

(async () => {
  try {
    await redisClient.connect();
    console.log("✅ Upstash Redis Connected");
  } catch (err) {
    console.error("❌ Redis Connection Failed:", err.message);
  }
})();

/* =========================
   MEMORY STORE (DEV MODE)
========================= */

const memoryRooms = new Map(); // roomId -> { users: [], messages: [] }

const matching = new MatchingService();
const onlineCounts = { friendship: 0, dating: 0, casual: 0 };
const activeRooms = new Map();
const messageLimits = new Map();

function updateOnlineCounts() {
  onlineCounts.friendship = matching.users.filter(u => u.intent === "friendship").length;
  onlineCounts.dating = matching.users.filter(u => u.intent === "dating").length;
  onlineCounts.casual = matching.users.filter(u => u.intent === "casual").length;
  io.emit("online-counts", onlineCounts);
}

/* =========================
   SOCKET CONNECTION
========================= */

// OTP Store and Email Setup
const otpStore = new Map();
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT, // Usually 2525 or 587
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Helps avoid local certificate errors
  }
});

// Add this to verify the connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Mailer Connection Error:", error.message);
  } else {
    console.log("✅ Mailtrap Ready to Send Emails");
  }
});

// --- UPDATE THE SOCKET CONNECTION BLOCK ---
io.on("connection", (socket) => {
  console.log("➜ Connected:", socket.id);

  // 1. OTP Logic
  socket.on("send-otp", async (email) => {
    if (!email.toLowerCase().endsWith("@pondiuni.ac.in")) {
      return socket.emit("email-invalid", "Use @pondiuni.ac.in only");
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, otp);
    
    try {
      await transporter.sendMail({
        from: '"BlindChat Support" <noreply@blindchat.in>',
        to: email,
        subject: "Your Campus Verification Code",
        text: `Welcome! Your verification code is: ${otp}`
      });
      console.log(`📧 OTP sent to ${email}`);
      socket.emit("otp-sent");
    } catch (err) { 
      console.error("Mailer Error Details:", err); // This tells us the real problem
      socket.emit("email-invalid", "Email failed to send. Check server logs."); 
    }
  });

  socket.on("verify-otp", ({ email, otp }) => {
    if (otpStore.get(email) === otp) {
      otpStore.delete(email);
      socket.emit("email-valid");
    } else {
      socket.emit("email-invalid", "Wrong code!");
    }
  });

  // 2. Fixed Message Logic (Matches your app.js)
  socket.on("message", async (text) => {
    const roomId = activeRooms.get(socket.id);
    if (!roomId) return;

    const message = {
      messageId: uuidv4(),
      senderId: socket.id,
      text: sanitizeMessage(text),
      timestamp: Date.now()
    };

    // This sends it back to BOTH people so the UI updates
    io.to(roomId).emit("message", message);

    if (dbConnected) {
      await Room.updateOne({ roomId }, { $push: { messages: message } });
    }
  });

  // ... keep your start-search, skip-chat, and disconnect logic here ...
  socket.on("start-chat", (profile) => {
  console.log(`🔎 ${profile.nickname} is looking for a match...`);

  const user = {
    id: socket.id,
    nickname: profile.nickname || "Student",
    gender: profile.gender,
    preference: profile.prefGender, // Aligning 'prefGender' from app.js to 'preference' for the class
    intent: profile.intent
  };

  // 1. Check for an existing match BEFORE adding the new user to the list
  const partner = matching.users.find(u => matching.canMatch(user, u));

  if (partner) {
    const roomId = `room-${uuidv4()}`;
    
    // Remove partner from waiting list
    matching.remove(partner.id);

    // Join the room
    socket.join(roomId);
    const partnerSocket = io.sockets.sockets.get(partner.id);
    if (partnerSocket) partnerSocket.join(roomId);

    activeRooms.set(socket.id, roomId);
    activeRooms.set(partner.id, roomId);

    // ─── UPDATED LOGIC HERE ───
    // Tell the current user they matched with the partner
    socket.emit("matched", partner.nickname);

    // Tell the partner they matched with the current user
    if (partnerSocket) {
      partnerSocket.emit("matched", user.nickname);
    }
    // ──────────────────────────

    console.log(`✅ MATCH: ${user.nickname} <-> ${partner.nickname}`);
  } else {
    // 2. If no match found, add this user to the waiting list
    matching.add(user);
    console.log(`⏳ No match yet. ${user.nickname} added to queue.`);
  }
});

  // 4. Handle Disconnect/Cleanup
 socket.on("disconnect", () => {
  console.log("➜ Disconnected:", socket.id);
  
  // Use 'remove' because that's what is in your class
  if (matching && typeof matching.remove === 'function') {
    matching.remove(socket.id);
  }
  
  activeRooms.delete(socket.id);
});
});

/* =========================
   BASIC ROUTE
========================= */

app.get("/", (req, res) => {
  res.send("BlindChat Backend Running 🚀");
});

server.listen(process.env.PORT || 3001, () => {
  console.log("🚀 BlindChat Server Running on port", process.env.PORT || 3001);
});