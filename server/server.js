const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingUser = null;

io.on("connection", socket => {

  socket.on("start-chat", ()=>{
    if(waitingUser){
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("matched");
      waitingUser.emit("matched");

      waitingUser = null;
    }else{
      waitingUser = socket;
    }
  });

  socket.on("message", msg=>{
    socket.partner?.emit("message", msg);
  });

  socket.on("skip", ()=>{
    socket.partner?.emit("partner-left");
    socket.partner = null;
    waitingUser = socket;
  });

  socket.on("reveal", profile=>{
    socket.partner?.emit("revealed", profile);
  });

});

server.listen(process.env.PORT || 3000, ()=>console.log("Blind Chat in Campus running"));
