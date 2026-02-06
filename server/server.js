const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server,{
  cors:{origin:"*"}
});

app.use(express.static("public"));

let waitingUser = null;
let onlineUsers = 0;

io.on("connection", socket => {

  onlineUsers++;
  io.emit("online-count", onlineUsers);

  socket.nickname = "Student " + Math.floor(Math.random()*900+100);

  socket.on("start-chat", () => {
    if(waitingUser){
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("matched", socket.partner.nickname);
      waitingUser.emit("matched", socket.nickname);

      waitingUser = null;
    } else {
      waitingUser = socket;
      socket.emit("waiting");
    }
  });

  socket.on("typing", () => socket.partner?.emit("typing"));
  socket.on("message", msg => socket.partner?.emit("message", msg));

  socket.on("skip", ()=>{
    socket.partner?.emit("partner-left");
    socket.partner=null;
    waitingUser=socket;
  });

  socket.on("disconnect", ()=>{
    onlineUsers--;
    io.emit("online-count", onlineUsers);
    socket.partner?.emit("partner-left");
    if(waitingUser===socket) waitingUser=null;
  });
});

server.listen(process.env.PORT||3000,()=>console.log("Server running 🚀"));
