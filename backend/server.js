const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUsers = [];
let rooms = {};


// ================= MATCH LOGIC =================

function canMatch(a, b) {
  const stage = Math.min(a.stage, b.stage);

  // Stage 1 — strict intent + gender
  if (stage === 1) {
    return (
      a.intent === b.intent &&
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }

  // Stage 2 — ignore intent, keep gender preference
  if (stage === 2) {
    return (
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }

  // Stage 3 — open campus
  return true;
}


function tryMatch() {
  for (let i = 0; i < waitingUsers.length; i++) {
    for (let j = i + 1; j < waitingUsers.length; j++) {

      const a = waitingUsers[i];
      const b = waitingUsers[j];

      if (canMatch(a, b)) {
        const room = "room-" + a.id + "-" + b.id;

        rooms[a.id] = room;
        rooms[b.id] = room;

        io.to(a.id).emit("matched");
        io.to(b.id).emit("matched");

        waitingUsers = waitingUsers.filter(
          u => u.id !== a.id && u.id !== b.id
        );

        console.log("Matched:", a.id, b.id);
        return;
      }
    }
  }
}


// ================= SOCKET =================

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
    tryMatch();
  });


  // 🔥 SKIP BUTTON FIX
  socket.on("skip", () => {
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    delete rooms[socket.id];

    socket.emit("restart-search");
    console.log("User skipped:", socket.id);
  });


  // MESSAGE ROUTING FIX
  socket.on("send-message", (msg) => {
    const room = rooms[socket.id];
    if (!room) return;

    socket.broadcast.emit("receive-message", msg);
  });


  // DISCONNECT FIX
  socket.on("disconnect", () => {
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);

    const room = rooms[socket.id];
    if (room) {
      socket.broadcast.emit("partner-left");
    }

    delete rooms[socket.id];
    console.log("Disconnected:", socket.id);
  });

});


// ================= SMART POPUPS =================

setInterval(() => {
  const now = Date.now();

  waitingUsers.forEach(user => {
    const waitTime = (now - user.joinedAt) / 1000;

    // Check strict match exists
    const strictMatchExists = waitingUsers.some(other =>
      other.id !== user.id &&
      other.intent === user.intent &&
      (user.preference === "any" || user.preference === other.gender) &&
      (other.preference === "any" || other.preference === user.gender)
    );

    if (!strictMatchExists && waitTime > 10 && user.stage === 1) {
      io.to(user.id).emit("suggest-relax-intent");
      user.stage = 2;
    }

    // Check gender match exists
    const genderMatchExists = waitingUsers.some(other =>
      other.id !== user.id &&
      (user.preference === "any" || user.preference === other.gender) &&
      (other.preference === "any" || other.preference === user.gender)
    );

    if (!genderMatchExists && waitTime > 25 && user.stage === 2) {
      io.to(user.id).emit("suggest-open-match");
      user.stage = 3;
    }

  });

}, 3000);


server.listen(3001, () =>
  console.log("Server running on port 3001")
);
