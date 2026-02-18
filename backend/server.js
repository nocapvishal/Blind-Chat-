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

function getCounts() {
  const counts = { friendship:0, dating:0, casual:0 };
  waitingUsers.forEach(u => {
    if(counts[u.intent] !== undefined) counts[u.intent]++;
  });
  return counts;
}

function broadcastCounts() {
  io.emit("online-counts", getCounts());
}

function canMatch(a,b){
  if(a.stage===1 || b.stage===1){
    return (
      a.intent===b.intent &&
      (a.preference==="any"||a.preference===b.gender) &&
      (b.preference==="any"||b.preference===a.gender)
    );
  }
  if(a.stage===2 || b.stage===2){
    return (
      (a.preference==="any"||a.preference===b.gender) &&
      (b.preference==="any"||b.preference===a.gender)
    );
  }
  return true;
}

function tryMatch(){
  for(let i=0;i<waitingUsers.length;i++){
    for(let j=i+1;j<waitingUsers.length;j++){
      const a=waitingUsers[i];
      const b=waitingUsers[j];

      if(canMatch(a,b)){
        const room="room-"+a.id+"-"+b.id;
        rooms[a.id]=room;
        rooms[b.id]=room;

        io.to(a.id).emit("matched");
        io.to(b.id).emit("matched");

        waitingUsers = waitingUsers.filter(
          u => u.id!==a.id && u.id!==b.id
        );

        broadcastCounts();
        return;
      }
    }
  }
}

io.on("connection",(socket)=>{

  socket.on("start-search",(data)=>{
    waitingUsers.push({
      id:socket.id,
      gender:data.gender,
      preference:data.preference,
      intent:data.intent,
      joinedAt:Date.now(),
      stage:1
    });
    broadcastCounts();
    tryMatch();
  });

  socket.on("cancel-search",()=>{
    waitingUsers = waitingUsers.filter(u=>u.id!==socket.id);
    broadcastCounts();
  });

  socket.on("relax-intent",()=>{
    const u=waitingUsers.find(x=>x.id===socket.id);
    if(u) u.stage=2;
  });

  socket.on("open-match",()=>{
    const u=waitingUsers.find(x=>x.id===socket.id);
    if(u) u.stage=3;
  });

  socket.on("send-message",(msg)=>{
    const room=rooms[socket.id];
    if(!room) return;
    socket.broadcast.emit("receive-message",msg);
  });

  socket.on("skip-chat",()=>{
    const room=rooms[socket.id];
    if(room){
      socket.broadcast.emit("partner-left");
      delete rooms[socket.id];
    }
  });

  socket.on("disconnect",()=>{
    waitingUsers = waitingUsers.filter(u=>u.id!==socket.id);
    delete rooms[socket.id];
    broadcastCounts();
  });
});

setInterval(()=>{
  const now=Date.now();
  waitingUsers.forEach(user=>{
    const wait=(now-user.joinedAt)/1000;
    if(wait>10 && user.stage===1){
      io.to(user.id).emit("suggest-relax-intent");
      user.stage=2;
    }
    if(wait>25 && user.stage===2){
      io.to(user.id).emit("suggest-open-match");
      user.stage=3;
    }
  });
},3000);

server.listen(3001,()=>console.log("Server running"));
