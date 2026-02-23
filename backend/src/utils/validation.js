const validator = require("validator");

function normalizeGender(gender) {
  const map = {
    "male": "male",
    "female": "female",
    "lgbtq+": "other"
  };

  return map[gender?.toLowerCase()] || null;
}

function normalizePreference(pref) {
  const map = {
    "male": "male",
    "female": "female",
    "anyone": "any",
    "any": "any"
  };

  return map[pref?.toLowerCase()] || null;
}

function normalizeIntent(intent) {
  const map = {
    "friendship": "friendship",
    "dating": "dating",
    "casual conversations": "casual",
    "casual": "casual"
  };

  return map[intent?.toLowerCase()] || null;
}

function sanitizeMessage(text) {
  if (!text || typeof text !== "string") return "";
  return text.trim().substring(0, 1000);
}

module.exports = {
  normalizeGender,
  normalizePreference,
  normalizeIntent,
  sanitizeMessage
};