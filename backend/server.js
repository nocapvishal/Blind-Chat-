const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let waitingUsers = [];
let rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  io.emit("online-count", io.engine.clientsCount);

  // START SEARCH
  socket.on("start-search", () => {
    waitingUsers = waitingUsers.filter(id => id !== socket.id);

    if (waitingUsers.length > 0) {
      const partnerId = waitingUsers.shift();

      const roomId = socket.id + "#" + partnerId;

      socket.join(roomId);
      io.sockets.sockets.get(partnerId)?.join(roomId);

      socket.roomId = roomId;
      io.sockets.sockets.get(partnerId).roomId = roomId;

      rooms[roomId] = { users: [socket.id, partnerId] };

      io.to(roomId).emit("matched");
      console.log("Matched:", roomId);
    } else {
      waitingUsers.push(socket.id);
    }
  });

  // MESSAGE
  socket.on("send-message", (msg) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("receive-message", msg);
    }
  });

  // SKIP
  socket.on("skip", () => {
    leaveRoomAndRequeue(socket);
  });

  // STOP SEARCH
  socket.on("stop-search", () => {
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    leaveRoomAndRequeue(socket, true);
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    io.emit("online-count", io.engine.clientsCount);
  });

  function leaveRoomAndRequeue(socket, isDisconnect=false) {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = rooms[roomId];
    if (!room) return;

    room.users.forEach((id) => {
      const s = io.sockets.sockets.get(id);
      if (!s) return;

      s.leave(roomId);
      s.roomId = null;

      if (!isDisconnect) {
        waitingUsers.push(id);
        s.emit("partner-left");
      }
    });

    delete rooms[roomId];
  }
});

const PORT = 5000;
server.listen(PORT, () => console.log("Server running on port", PORT));
