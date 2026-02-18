const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUsers = [];
let activeChats = {}; // socketId -> partnerId
let userTimers = {};  // popup timers

// =========================
// MATCHING LOGIC
// =========================

function preferenceMatch(a, b) {
  return (
    (a.preference === "any" || a.preference === b.gender) &&
    (b.preference === "any" || b.preference === a.gender)
  );
}

function strictMatch(a, b) {
  return a.intent === b.intent && preferenceMatch(a, b);
}

function tryMatch() {
  for (let i = 0; i < waitingUsers.length; i++) {
    for (let j = i + 1; j < waitingUsers.length; j++) {
      const A = waitingUsers[i];
      const B = waitingUsers[j];

      let canMatch = false;

      if (A.stage === 1 && B.stage === 1) {
        canMatch = strictMatch(A, B);
      } else if (A.stage >= 2 && B.stage >= 2) {
        canMatch = preferenceMatch(A, B);
      } else if (A.stage === 3 || B.stage === 3) {
        canMatch = true;
      }

      if (canMatch) {
        startChat(A.id, B.id);
        return;
      }
    }
  }
}

function startChat(id1, id2) {
  console.log("Matched:", id1, id2);

  activeChats[id1] = id2;
  activeChats[id2] = id1;

  waitingUsers = waitingUsers.filter(u => u.id !== id1 && u.id !== id2);

  clearTimers(id1);
  clearTimers(id2);

  io.to(id1).emit("matched");
  io.to(id2).emit("matched");
}

// =========================
// TIMER SYSTEM
// =========================

function startTimers(socketId) {
  userTimers[socketId] = {
    relax: setTimeout(() => {
      io.to(socketId).emit("suggest-relax-intent");
      updateStage(socketId, 2);
    }, 10000),

    open: setTimeout(() => {
      io.to(socketId).emit("suggest-open-match");
      updateStage(socketId, 3);
    }, 25000)
  };
}

function clearTimers(socketId) {
  if (!userTimers[socketId]) return;
  clearTimeout(userTimers[socketId].relax);
  clearTimeout(userTimers[socketId].open);
  delete userTimers[socketId];
}

function updateStage(id, stage) {
  const user = waitingUsers.find(u => u.id === id);
  if (user) user.stage = stage;
}

// =========================
// SOCKET EVENTS
// =========================

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  // START SEARCH
  socket.on("start-search", data => {
    waitingUsers.push({
      id: socket.id,
      gender: data.gender,
      preference: data.preference,
      intent: data.intent,
      stage: 1
    });

    startTimers(socket.id);
    tryMatch();
  });

  socket.on("relax-intent", () => updateStage(socket.id, 2));
  socket.on("open-match", () => updateStage(socket.id, 3));

  // MESSAGE
  socket.on("send-message", msg => {
    const partner = activeChats[socket.id];
    if (partner) io.to(partner).emit("receive-message", msg);
  });

  // SKIP CHAT
  socket.on("skip", () => {
    const partner = activeChats[socket.id];
    if (!partner) return;

    delete activeChats[socket.id];
    delete activeChats[partner];

    io.to(partner).emit("partner-disconnected");

    // put partner back to search queue automatically
    waitingUsers.push({
      id: partner,
      stage: 3,
      preference: "any",
      gender: "any",
      intent: "chat"
    });

    tryMatch();
  });

  // CANCEL SEARCH (from match page)
  socket.on("cancel-search", () => {
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    clearTimers(socket.id);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    clearTimers(socket.id);

    const partner = activeChats[socket.id];
    if (partner) {
      io.to(partner).emit("partner-disconnected");
      delete activeChats[partner];
      delete activeChats[socket.id];
    }
  });
});

server.listen(3001, () => console.log("Server running"));