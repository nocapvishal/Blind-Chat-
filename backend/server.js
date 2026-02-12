const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});


// ================= STATE =================

const waitingUsers = {
  friends: [],
  dating: [],
  casual: []
};

const rooms = {};
let onlineUsers = 0;


// ================= HELPERS =================

// Check gender compatibility
function compatible(userA, userB) {
  const aLikesB =
    userA.preferredGender === "any" ||
    userA.preferredGender === userB.gender;

  const bLikesA =
    userB.preferredGender === "any" ||
    userB.preferredGender === userA.gender;

  return aLikesB && bLikesA;
}

function createRoom(user1, user2, intent) {
  const roomId = "room_" + Math.random().toString(36).substring(2, 9);

  rooms[roomId] = {
    users: [user1.id, user2.id],
    intent
  };

  user1.join(roomId);
  user2.join(roomId);

  user1.roomId = roomId;
  user2.roomId = roomId;

  user1.emit("matched", roomId);
  user2.emit("matched", roomId);

  console.log("Matched:", user1.id, user2.id);
}

function removeFromQueues(socket) {
  Object.keys(waitingUsers).forEach(intent => {
    waitingUsers[intent] = waitingUsers[intent].filter(
      user => user.id !== socket.id
    );
  });
}


// ================= SOCKET =================

io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("online-count", onlineUsers);
  console.log("User connected:", socket.id);


  // ===== START SEARCH =====
  socket.on("start-search", ({ gender, preferredGender, intent }) => {
    console.log("Searching:", socket.id);

    socket.gender = gender;
    socket.preferredGender = preferredGender;
    socket.intent = intent;

    removeFromQueues(socket);

    const queue = waitingUsers[intent];

    // Try find compatible partner
    let partnerIndex = -1;

    for (let i = 0; i < queue.length; i++) {
      if (compatible(socket, queue[i])) {
        partnerIndex = i;
        break;
      }
    }

    if (partnerIndex !== -1) {
      const partner = queue.splice(partnerIndex, 1)[0];
      createRoom(socket, partner, intent);
    } else {
      queue.push(socket);
    }
  });


  // ===== CHAT MESSAGE =====
  socket.on("send-message", (message) => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("receive-message", message);
  });


  // ===== TYPING =====
  socket.on("typing", () => {
    if (!socket.roomId) return;
    socket.to(socket.roomId).emit("partner-typing");
  });


  // ===== SKIP =====
  socket.on("skip", () => {
  if (!socket.roomId) return;

  const oldRoom = socket.roomId;

  socket.leave(oldRoom);
  socket.to(oldRoom).emit("partner-left");
  delete rooms[oldRoom];

  socket.roomId = null;

  // 🔁 Immediately search again
  const queue = waitingUsers[socket.intent];

  let partnerIndex = -1;

  for (let i = 0; i < queue.length; i++) {
    if (compatible(socket, queue[i])) {
      partnerIndex = i;
      break;
    }
  }

  if (partnerIndex !== -1) {
    const partner = queue.splice(partnerIndex, 1)[0];
    createRoom(socket, partner, socket.intent);
  } else {
    queue.push(socket);
  }
});



  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    removeFromQueues(socket);

    if (socket.roomId) {
      socket.to(socket.roomId).emit("partner-left");
      delete rooms[socket.roomId];
    }

    onlineUsers--;
    io.emit("online-count", onlineUsers);
  });

});


server.listen(3001, () => {
  console.log("Server running on port 3001");
});
