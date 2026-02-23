const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
  reporter: String,
  reported: String,
  reason: String,
  roomId: String,
  messageId: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Report", ReportSchema);