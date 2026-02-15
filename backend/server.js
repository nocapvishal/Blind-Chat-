const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUsers = [];
let rooms = {}; // socketId → roomId

// ---------- MATCH RULES ----------
function canMatch(a, b) {

  // Stage 1 strict
  if (a.stage === 1 || b.stage === 1) {
    return (
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }

  // Stage 2 relax gender preference
  if (a.stage === 2 || b.stage === 2) {
    return true;
  }

  // Stage 3 open campus
  return true;
}

// ---------- MATCH ENGINE ----------
function tryMatch() {

  if (waitingUsers.length < 2) return;

  for (let i = 0; i < waitingUsers.length; i++) {
    for (let j = i + 1; j < waitingUsers.length; j++) {

      const a = waitingUsers[i];
      const b = waitingUsers[j];

      if (canMatch(a, b)) {

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
}

// ---------- SOCKET CONNECTION ----------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // START SEARCH
  socket.on("start-search", (data) => {

    waitingUsers.push({
      id: socket.id,
      gender: data.gender,
      preference: data.preference,
      joinedAt: Date.now(),
      stage: 1
    });

    console.log("Searching:", socket.id);
    tryMatch();
  });

  // RELAX FILTERS
  socket.on("relax-intent", () => {
    const user = waitingUsers.find(u => u.id === socket.id);
    if (user) {
      user.stage = 2;
      tryMatch(); // retry match immediately
    }
  });

  // OPEN MATCH
  socket.on("open-match", () => {
    const user = waitingUsers.find(u => u.id === socket.id);
    if (user) {
      user.stage = 3;
      tryMatch(); // retry match immediately
    }
  });

  // SKIP USER
  socket.on("skip", () => {

    const room = rooms[socket.id];
    if (room) {
      socket.to(room).emit("partner-left");
      socket.leave(room);
    }

    delete rooms[socket.id];

    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);

    socket.emit("skipped");
    console.log("User skipped:", socket.id);
  });

  // SEND MESSAGE (FIXED ROOM BUG)
  socket.on("send-message", (msg) => {
    const room = rooms[socket.id];
    if (!room) return;

    socket.to(room).emit("receive-message", msg);
  });

  // DISCONNECT HANDLING (FIXED GHOST BUG)
  socket.on("disconnect", () => {

    const room = rooms[socket.id];
    if (room) {
      socket.to(room).emit("partner-left");
    }

    delete rooms[socket.id];
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);

    console.log("Disconnected:", socket.id);
  });
});

// ---------- AUTO RELAX TIMER ----------
setInterval(() => {

  const now = Date.now();

  waitingUsers.forEach(user => {
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

}, 3000);

server.listen(3001, () =>
  console.log("Server running on port 3001")
);
