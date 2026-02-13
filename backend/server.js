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
    methods: ["GET", "POST"]
  }
});

let waitingUsers = [];
let rooms = {};

function createRoom(user1, user2) {
  const roomId = "room_" + user1 + "_" + user2;
  rooms[roomId] = { users: [user1, user2] };

  io.sockets.sockets.get(user1)?.join(roomId);
  io.sockets.sockets.get(user2)?.join(roomId);

  io.to(roomId).emit("matched");
}

function tryMatch() {
  if (waitingUsers.length >= 2) {
    const user1 = waitingUsers.shift();
    const user2 = waitingUsers.shift();
    createRoom(user1, user2);
  }
}

function leaveRoomAndRequeue(socket, isDisconnect=false) {
  const roomId = socket.roomId;
  if (!roomId) return;

  const room = rooms[roomId];
  if (!room) return;

  const partnerId = room.users.find(id => id !== socket.id);
  const partnerSocket = io.sockets.sockets.get(partnerId);

  delete rooms[roomId];
  socket.leave(roomId);
  socket.roomId = null;

  if (partnerSocket) {
    partnerSocket.leave(roomId);
    partnerSocket.roomId = null;
    partnerSocket.emit("partner-left");

    if (!isDisconnect) waitingUsers.push(partnerId);
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("start-search", () => {
    if (!waitingUsers.includes(socket.id)) {
      waitingUsers.push(socket.id);
      tryMatch(); // instant match
    }
  });

  socket.on("send-message", (msg) => {
    const roomId = socket.roomId;
    if (roomId) socket.to(roomId).emit("receive-message", msg);
  });

  // 🔥 TYPING EVENTS
  socket.on("typing", () => {
    if (socket.roomId) socket.to(socket.roomId).emit("partner-typing");
  });

  socket.on("stop-typing", () => {
    if (socket.roomId) socket.to(socket.roomId).emit("partner-stop-typing");
  });

  socket.on("skip", () => {
    leaveRoomAndRequeue(socket);
    waitingUsers.push(socket.id);
    tryMatch();
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    leaveRoomAndRequeue(socket, true);
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
  });
});

server.listen(3001, () => console.log("Server running on port 3001"));
