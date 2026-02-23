const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  roomId: String,
  users: [String],
  messages: [
    {
      senderId: String,
      text: String,
      timestamp: Number
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Room", RoomSchema);