const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

let pairQueue = [];
let groupQueue = [];

function matchPair(socket) {
  if (pairQueue.length === 0) return false;

  let partner = pairQueue.shift();

  socket.partner = partner;
  partner.partner = socket;

  socket.emit("matched", partner.profile.nickname);
  partner.emit("matched", socket.profile.nickname);

  return true;
}

function tryGroupMatch() {
  if (groupQueue.length < 3) return;

  let group = groupQueue.splice(0, 3);
  group.forEach(user => {
    user.group = group;
    user.emit("group-matched");
  });
}

io.on("connection", socket => {

  socket.on("start-chat", profile => {
    socket.profile = profile;

    if (!matchPair(socket)) {
      pairQueue.push(socket);
      socket.emit("waiting");

      setTimeout(() => {
        if (pairQueue.includes(socket)) {
          socket.emit("group-offer");
        }
      }, 10000);
    }
  });

  socket.on("join-group", () => {
    pairQueue = pairQueue.filter(u => u !== socket);
    groupQueue.push(socket);
    tryGroupMatch();
  });

  socket.on("message", msg => {
    if (socket.partner) socket.partner.emit("message", msg);

    if (socket.group) {
      socket.group.forEach(u => {
        if (u !== socket) u.emit("message", msg);
      });
    }
  });

  socket.on("typing", () => {
    socket.partner?.emit("typing");
    socket.group?.forEach(u => { if(u!==socket) u.emit("typing"); });
  });

  socket.on("skip", () => {
    socket.partner?.emit("partner-left");
    socket.partner = null;
    pairQueue.push(socket);
    socket.emit("waiting");
  });

  socket.on("disconnect", () => {
    pairQueue = pairQueue.filter(u => u !== socket);
    groupQueue = groupQueue.filter(u => u !== socket);
    socket.partner?.emit("partner-left");
  });

});

server.listen(process.env.PORT || 3000, () =>
  console.log("Blind Chat in Campus running 🚀")
);
