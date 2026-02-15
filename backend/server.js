const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUsers = [];
let rooms = {}; // socketId -> roomId

// ---------------- MATCH RULES ----------------

function canMatch(a, b) {
  // Stage 1 — strict
  if (a.stage === 1 || b.stage === 1) {
    return (
      a.intent === b.intent &&
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }

  // Stage 2 — relax intent
  if (a.stage === 2 || b.stage === 2) {
    return (
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }

  // Stage 3 — open campus
  return true;
}

// ---------------- MATCH ENGINE ----------------

function tryMatch() {
  for (let i = 0; i < waitingUsers.length; i++) {
    for (let j = i + 1; j < waitingUsers.length; j++) {

      const a = waitingUsers[i];
      const b = waitingUsers[j];

      if (!canMatch(a, b)) continue;

      const room = "room-" + a.id + "-" + b.id;

      rooms[a.id] = room;
      rooms[b.id] = room;

      io.sockets.sockets.get(a.id)?.join(room);
      io.sockets.sockets.get(b.id)?.join(room);

      io.to(room).emit("matched");

      waitingUsers = waitingUsers.filter(
        u => u.id !== a.id && u.id !== b.id
      );

      console.log("Matched:", a.id, b.id);
      return;
    }
  }
}

// 🔁 CONTINUOUS MATCH LOOP (VERY IMPORTANT)
setInterval(() => {
  if (waitingUsers.length > 1) tryMatch();
}, 1000);

// ---------------- SOCKET EVENTS ----------------

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("start-search", (data) => {
    waitingUsers.push({
      id: socket.id,
      gender: data.gender,
      preference: data.preference,
      intent: data.intent,
      joinedAt: Date.now(),
      stage: 1
    });

    console.log("Searching:", socket.id);
  });

  // Suggest relaxing filters
  setInterval(() => {
    const user = waitingUsers.find(u => u.id === socket.id);
    if (!user) return;

    const waitTime = (Date.now() - user.joinedAt) / 1000;

    if (waitTime > 10 && user.stage === 1) {
      socket.emit("suggest-relax-intent");
      user.stage = 2;
    }

    if (waitTime > 25 && user.stage === 2) {
      socket.emit("suggest-open-match");
      user.stage = 3;
    }
  }, 3000);

  // 💬 Messaging (ROOM BASED — FIXED)
  socket.on("send-message", (msg) => {
    const room = rooms[socket.id];
    if (!room) return;
    socket.to(room).emit("receive-message", msg);
  });

  // 🔁 SKIP = NEXT PERSON
  socket.on("skip", () => {
    const room = rooms[socket.id];

    if (room) {
      socket.to(room).emit("partner-left");
    }

    delete rooms[socket.id];

    socket.emit("requeue");
    console.log("User skipped:", socket.id);
  });

  socket.on("disconnect", () => {
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);

    const room = rooms[socket.id];
    if (room) {
      socket.to(room).emit("partner-left");
    }

    delete rooms[socket.id];

    console.log("Disconnected:", socket.id);
  });
});

server.listen(3001, () =>
  console.log("Server running on port 3001")
);
