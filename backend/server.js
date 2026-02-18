const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server,{
  cors:{origin:"*"}
});

let waitingUsers=[];
let activeRooms={}; // roomId -> [userA,userB]
let userRoom={};    // socketId -> roomId


// ================= MATCH LOGIC =================

function canMatch(a,b){
  if(a.stage===1 || b.stage===1){
    return a.intent===b.intent &&
      (a.preference==="any" || a.preference===b.gender) &&
      (b.preference==="any" || b.preference===a.gender);
  }

  if(a.stage===2 || b.stage===2){
    return (a.preference==="any" || a.preference===b.gender) &&
           (b.preference==="any" || b.preference===a.gender);
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

        userRoom[a.id]=room;
        userRoom[b.id]=room;
        activeRooms[room]=[a.id,b.id];

        io.sockets.sockets.get(a.id)?.join(room);
        io.sockets.sockets.get(b.id)?.join(room);

        io.to(room).emit("matched");

        waitingUsers=waitingUsers.filter(
          u=>u.id!==a.id && u.id!==b.id
        );

        console.log("MATCHED:",room);
        updateCounts();
        return;
      }
    }
  }
}


// ============== ONLINE COUNTERS ==============

function updateCounts(){
  let counts={friendship:0,dating:0,casual:0};
  waitingUsers.forEach(u=>counts[u.intent]++);
  io.emit("online-counts",counts);
}


// ============== SOCKET EVENTS ==============

io.on("connection",(socket)=>{
  console.log("User connected:",socket.id);

  socket.on("start-search",(data)=>{
    waitingUsers.push({
      id:socket.id,
      gender:data.gender,
      preference:data.preference,
      intent:data.intent,
      joinedAt:Date.now(),
      stage:1
    });

    updateCounts();
    tryMatch();
  });

  socket.on("cancel-search",()=>{
    waitingUsers=waitingUsers.filter(u=>u.id!==socket.id);
    updateCounts();
  });

  socket.on("relax-intent",()=>{
    const u=waitingUsers.find(x=>x.id===socket.id);
    if(u) u.stage=2;
  });

  socket.on("open-match",()=>{
    const u=waitingUsers.find(x=>x.id===socket.id);
    if(u) u.stage=3;
  });


  // ============ MESSAGE SYSTEM ============

  socket.on("send-message",(msg)=>{
    const room=userRoom[socket.id];
    if(!room) return;

    socket.to(room).emit("receive-message",msg);
  });


  // ============ SKIP CHAT ============

  socket.on("skip-chat",()=>{
    const room=userRoom[socket.id];
    if(!room) return;

    const users=activeRooms[room];
    if(!users) return;

    const partner=users.find(id=>id!==socket.id);

    io.to(partner).emit("partner-skipped");

    delete activeRooms[room];
    delete userRoom[socket.id];
    delete userRoom[partner];
  });


  // ============ DISCONNECT ============

  socket.on("disconnect",()=>{
    waitingUsers=waitingUsers.filter(u=>u.id!==socket.id);

    const room=userRoom[socket.id];
    if(room){
      const users=activeRooms[room];
      const partner=users?.find(id=>id!==socket.id);
      if(partner) io.to(partner).emit("partner-disconnected");

      delete activeRooms[room];
      delete userRoom[socket.id];
    }

    updateCounts();
    console.log("Disconnected:",socket.id);
  });
});


// ========== RELAX / OPEN TIMERS ==========
setInterval(()=>{
  const now=Date.now();

  waitingUsers.forEach(u=>{
    const wait=(now-u.joinedAt)/1000;

    if(wait>10 && u.stage===1){
      io.to(u.id).emit("suggest-relax-intent");
      u.stage=2;
    }

    if(wait>25 && u.stage===2){
      io.to(u.id).emit("suggest-open-match");
      u.stage=3;
    }
  });

},3000);


server.listen(3001,()=>console.log("Server running"));
