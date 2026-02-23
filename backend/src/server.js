require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const helmet = require("helmet");

const Room = require("./models/Room");
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

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("Mongo Error:", err.message);
    process.exit(1);
  });

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

io.on("connection", (socket) => {

  console.log("➜ Connected:", socket.id);

  // ================= START SEARCH =================
  socket.on("start-search", (data) => {

    const gender = normalizeGender(data.gender);
    const preference = normalizePreference(data.preference);
    const intent = normalizeIntent(data.intent);

    if (!gender || !preference || !intent) return;

    matching.add({
      id: socket.id,
      gender,
      preference,
      intent,
      joinedAt: Date.now()
    });

    updateOnlineCounts();
    tryMatch();
  });

  socket.on("cancel-search", () => {
    matching.remove(socket.id);
    updateOnlineCounts();
  });

  async function tryMatch() {
    const users = [...matching.users].sort((a, b) => a.joinedAt - b.joinedAt);

    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {

        if (matching.canMatch(users[i], users[j])) {

          const userA = users[i];
          const userB = users[j];

          const roomId = "room-" + Date.now();

          matching.remove(userA.id);
          matching.remove(userB.id);
          updateOnlineCounts();

          const socketA = io.sockets.sockets.get(userA.id);
          const socketB = io.sockets.sockets.get(userB.id);
          if (!socketA || !socketB) return;

          socketA.join(roomId);
          socketB.join(roomId);

          activeRooms.set(userA.id, roomId);
          activeRooms.set(userB.id, roomId);

          socketA.data.roomId = roomId;
          socketB.data.roomId = roomId;

          await Room.create({
            roomId,
            users: [userA.id, userB.id],
            messages: []
          });

          console.log("✅ Room created:", roomId);

          io.to(roomId).emit("match-found");
          return;
        }
      }
    }
  }

  // ================= SEND MESSAGE =================
  socket.on("send-message", async (rawMessage) => {

    const text = sanitizeMessage(rawMessage);
    if (!text) return;

    const now = Date.now();
    const lastMessage = messageLimits.get(socket.id) || 0;

    if (now - lastMessage < 800) return; // anti-spam
    messageLimits.set(socket.id, now);

    const roomId = activeRooms.get(socket.id);
    if (!roomId) {
      console.log("❌ No room for:", socket.id);
      return;
    }

    const roomSockets = await io.in(roomId).fetchSockets();
    if (roomSockets.length < 2) {
      socket.emit("partner-left");
      activeRooms.delete(socket.id);
      return;
    }

    const timestamp = Date.now();

    try {
      await Room.updateOne(
        { roomId },
        {
          $push: {
            messages: {
              senderId: socket.id,
              text,
              timestamp
            }
          }
        }
      );
    } catch (err) {
      console.error("DB Error:", err.message);
    }

    io.to(roomId).emit("receive-message", {
      senderId: socket.id,
      text,
      timestamp
    });

  });

  // ================= TYPING =================
  socket.on("typing", () => {
    const roomId = activeRooms.get(socket.id);
    if (!roomId) return;
    socket.to(roomId).emit("partner-typing");
  });

  socket.on("stop-typing", () => {
    const roomId = activeRooms.get(socket.id);
    if (!roomId) return;
    socket.to(roomId).emit("partner-stop-typing");
  });

  // ================= SEEN =================
  socket.on("message-seen", () => {
    const roomId = activeRooms.get(socket.id);
    if (!roomId) return;
    socket.to(roomId).emit("message-seen");
  });

  // ================= RECONNECT =================
  socket.on("reconnect-request", () => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.join(roomId);
      socket.emit("match-found");
    }
  });

  // ================= SKIP =================
  socket.on("skip-chat", async () => {

    const roomId = activeRooms.get(socket.id);
    if (!roomId) return;

    io.to(roomId).emit("partner-left");

    try {
      await Room.deleteOne({ roomId });
    } catch {}

    const sockets = await io.in(roomId).fetchSockets();
    sockets.forEach(s => {
      s.leave(roomId);
      activeRooms.delete(s.id);
    });
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", async () => {

    matching.remove(socket.id);
    updateOnlineCounts();
    messageLimits.delete(socket.id);

    const roomId = activeRooms.get(socket.id);

    if (roomId) {
      io.to(roomId).emit("partner-left");

      try {
        await Room.deleteOne({ roomId });
      } catch {}

      const sockets = await io.in(roomId).fetchSockets();
      sockets.forEach(s => {
        s.leave(roomId);
        activeRooms.delete(s.id);
      });
    }

    console.log("✕ Disconnected:", socket.id);
  });

});

app.get("/", (req, res) => {
  res.send("BlindChat Backend Running 🚀");
});

server.listen(process.env.PORT || 3001, () => {
  console.log("🚀 BlindChat Server Running on port", process.env.PORT || 3001);
});