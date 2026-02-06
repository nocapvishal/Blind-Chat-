const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});

app.use(express.static("public"));

let pairQueue=[];
let groupQueue=[];
let onlineUsers=0;

function matchPair(socket){
 let index=pairQueue.findIndex(u=>u!==socket);
 if(index!==-1){
   let partner=pairQueue.splice(index,1)[0];
   socket.partner=partner;
   partner.partner=socket;
   socket.emit("matched",partner.profile.nickname);
   partner.emit("matched",socket.profile.nickname);
   return true;
 }
 return false;
}

function tryGroupMatch(){
 if(groupQueue.length>=3){
   let group=groupQueue.splice(0,3);
   group.forEach(s=>{
     s.group=group;
     s.emit("group-matched");
   });
 }
}

io.on("connection",socket=>{
 onlineUsers++;
 io.emit("online-count",onlineUsers);

 socket.on("start-chat",profile=>{
   socket.profile=profile;

   // try pair match
   if(!matchPair(socket)){
     pairQueue.push(socket);

     // after 15s offer group chat
     setTimeout(()=>{
       if(pairQueue.includes(socket)){
         socket.emit("group-offer");
       }
     },15000);
   }
 });

 socket.on("join-group",()=>{
   pairQueue=pairQueue.filter(u=>u!==socket);
   groupQueue.push(socket);
   tryGroupMatch();
 });

 socket.on("message",msg=>{
   if(socket.partner){
     socket.partner.emit("message",msg);
   }
   if(socket.group){
     socket.group.forEach(u=>{
       if(u!==socket) u.emit("message",msg);
     });
   }
 });

 socket.on("disconnect",()=>{
   onlineUsers--;
   io.emit("online-count",onlineUsers);
   pairQueue=pairQueue.filter(u=>u!==socket);
   groupQueue=groupQueue.filter(u=>u!==socket);
 });

});

server.listen(process.env.PORT||3000,()=>console.log("Group engine live"));
