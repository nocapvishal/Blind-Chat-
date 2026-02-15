const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let queue = [];
let rooms = {};

/* ---------------- MATCH RULES ---------------- */

function isCompatible(a, b) {
  // preference check BOTH SIDES
  const prefOk =
    (a.preference === "any" || a.preference === b.gender) &&
    (b.preference === "any" || b.preference === a.gender);

  if (!prefOk) return false;

  // Stage 1 → same intent
  if (a.stage === 1 && b.stage === 1) return a.intent === b.intent;

  // Stage 2 → ignore intent
  if (a.stage >= 2 || b.stage >= 2) return prefOk;

  return false;
}

/* ---------------- MATCH ENGINE ---------------- */

function tryMatch() {
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {

      const A = queue[i];
      const B = queue[j];

      if (!isCompatible(A, B)) continue;

      const roomId = `room-${A.id}-${B.id}`;

      rooms[A.id] = roomId;
      rooms[B.id] = roomId;

      io.to(A.id).emit("matched");
      io.to(B.id).emit("matched");

      queue = queue.filter(u => u.id !== A.id && u.id !== B.id);

      console.log("MATCHED:", A.id, B.id);
      return;
    }
  }
}

/* ---------------- SOCKET EVENTS ---------------- */

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("start-search", (data) => {
    queue.push({
      id: socket.id,
      gender: data.gender,
      preference: data.preference,
      intent: data.intent,
      joinedAt: Date.now(),
      stage: 1
    });

    tryMatch();
  });

  /* ----- SKIP PARTNER ----- */
  socket.on("skip", () => {
    const room = rooms[socket.id];

    if (room) {
      const partnerId = Object.keys(rooms)
        .find(id => rooms[id] === room && id !== socket.id);

      if (partnerId) {
        io.to(partnerId).emit("partner-left");
        delete rooms[partnerId];
      }

      delete rooms[socket.id];
    }

    // requeue the skipper instantly
    socket.emit("requeue");
  });

  /* ----- MESSAGES ----- */
  socket.on("send-message", (msg) => {
    const room = rooms[socket.id];
    if (!room) return;

    // send ONLY to partner (not everyone!)
    socket.to(room).emit("receive-message", msg);
  });

  /* ----- DISCONNECT ----- */
  socket.on("disconnect", () => {
    queue = queue.filter(u => u.id !== socket.id);

    const room = rooms[socket.id];
    if (room) {
      const partnerId = Object.keys(rooms)
        .find(id => rooms[id] === room && id !== socket.id);

      if (partnerId) {
        io.to(partnerId).emit("partner-left");
        delete rooms[partnerId];
      }

      delete rooms[socket.id];
    }

    console.log("Disconnected:", socket.id);
  });
});

/* ---------------- SMART FALLBACK SYSTEM ---------------- */
/* After waiting → suggest relaxing preferences */

setInterval(() => {
  const now = Date.now();

  queue.forEach(user => {
    const wait = (now - user.joinedAt) / 1000;

    if (wait > 10 && user.stage === 1) {
      io.to(user.id).emit("suggest-relax-intent");
      user.stage = 2;
    }

    if (wait > 25 && user.stage === 2) {
      io.to(user.id).emit("suggest-open-match");
      user.stage = 3;
    }
  });

  tryMatch();
}, 3000);

server.listen(3001, () =>
  console.log("Server running on port 3001")
);
