const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

let waitingUsers = [];
let onlineUsers = 0;

io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("online-count", onlineUsers);
  console.log("User connected:", socket.id);

  socket.on("start-search", (preferences) => {
    socket.preferences = preferences;
    waitingUsers.push(socket);
    matchUsers();
  });

  socket.on("send-message", (msg) => {
    if (socket.partner) {
      io.to(socket.partner).emit("receive-message", msg);
      io.to(socket.partner).emit("play-sound");
    }
  });

  socket.on("typing", () => {
    if (socket.partner) io.to(socket.partner).emit("typing");
  });

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("online-count", onlineUsers);

    waitingUsers = waitingUsers.filter((u) => u.id !== socket.id);

    if (socket.partner) {
      io.to(socket.partner).emit("partner-left");
    }

    console.log("User disconnected:", socket.id);
  });
});

function matchUsers() {
  if (waitingUsers.length < 2) return;

  const user1 = waitingUsers.shift();
  const user2 = waitingUsers.shift();

  user1.partner = user2.id;
  user2.partner = user1.id;

  io.to(user1.id).emit("matched");
  io.to(user2.id).emit("matched");

  console.log("Matched:", user1.id, user2.id);
}

server.listen(3001, () => console.log("Server running on port 3001"));
