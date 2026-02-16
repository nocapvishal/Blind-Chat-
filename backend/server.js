const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* ===============================
   DATA STORES
=================================*/

let waitingUsers = [];
let rooms = {}; // socketId -> roomId

/* ===============================
   MATCHING LOGIC
=================================*/

function canMatch(a, b) {

  // Stage 1 → STRICT (intent + gender pref)
  if (a.stage === 1 && b.stage === 1) {
    return (
      a.intent === b.intent &&
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }

  // Stage 2 → ignore intent
  if (a.stage >= 2 || b.stage >= 2) {
    return (
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }

  // Stage 3 → open campus
  return true;
}

function matchUsers(a, b) {
  const room = "room-" + a.id + "-" + b.id;

  rooms[a.id] = room;
  rooms[b.id] = room;

  io.to(a.id).emit("matched");
  io.to(b.id).emit("matched");

  waitingUsers = waitingUsers.filter(
    u => u.id !== a.id && u.id !== b.id
  );

  console.log("✅ Matched:", a.id, b.id);
}

function tryMatch() {
  if (waitingUsers.length < 2) return;

  for (let i = 0; i < waitingUsers.length; i++) {
    for (let j = i + 1; j < waitingUsers.length; j++) {

      const a = waitingUsers[i];
      const b = waitingUsers[j];

      if (canMatch(a, b)) {
        matchUsers(a, b);
        return;
      }
    }
  }
}

/* ===============================
   SOCKET EVENTS
=================================*/

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  io.emit("online-count", io.engine.clientsCount);

  /* START SEARCH */
  socket.on("start-search", (data) => {

    waitingUsers.push({
      id: socket.id,
      gender: data.gender,
      preference: data.preference,
      intent: data.intent,
      joinedAt: Date.now(),
      stage: 1
    });

    console.log("🔎 Searching:", socket.id);
    tryMatch();
  });

  /* RELAX MATCHING */
  socket.on("relax-intent", () => {
    const user = waitingUsers.find(u => u.id === socket.id);
    if (user) user.stage = 2;
    tryMatch();
  });

  /* OPEN MATCH */
  socket.on("open-match", () => {
    const user = waitingUsers.find(u => u.id === socket.id);
    if (user) user.stage = 3;
    tryMatch();
  });

  /* TYPING INDICATOR */
  socket.on("typing", () => {
    const room = rooms[socket.id];
    if (!room) return;

    socket.broadcast.emit("typing");
  });

  /* SEND MESSAGE */
  socket.on("send-message", (msg) => {
    const room = rooms[socket.id];
    if (!room) return;

    socket.broadcast.emit("receive-message", msg);
  });

  /* SKIP PARTNER */
  socket.on("skip", () => {
    const room = rooms[socket.id];

    if (room) {
      socket.broadcast.emit("partner-left");
      delete rooms[socket.id];
    }

    waitingUsers.push({
      id: socket.id,
      gender: "any",
      preference: "any",
      intent: "any",
      joinedAt: Date.now(),
      stage: 3
    });

    tryMatch();
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    const room = rooms[socket.id];
    if (room) socket.broadcast.emit("partner-left");

    delete rooms[socket.id];
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);

    io.emit("online-count", io.engine.clientsCount);
  });
});

/* ===============================
   AUTO RELAX MATCH TIMER
=================================*/

setInterval(() => {
  const now = Date.now();

  waitingUsers.forEach(user => {
    const wait = (now - user.joinedAt) / 1000;

    if (wait > 12 && user.stage === 1) {
      io.to(user.id).emit("suggest-relax-intent");
      user.stage = 2;
    }

    if (wait > 25 && user.stage === 2) {
      io.to(user.id).emit("suggest-open-match");
      user.stage = 3;
    }
  });

}, 3000);

/* ===============================
   START SERVER
=================================*/

server.listen(3001, () => {
  console.log("🚀 Server running on port 3001");
});
