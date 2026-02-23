const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const reactionSchema = new mongoose.Schema({
  userId: String,
  emoji: String
}, { _id: false });

const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    default: uuidv4
  },
  senderId: String,
  text: String,
  timestamp: Number,
  replyTo: {
    messageId: String,
    text: String
  },
  reactions: [reactionSchema]
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  roomId: String,
  users: [String],
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Room", RoomSchema);