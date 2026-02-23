class MatchingService {
  constructor() {
    this.users = [];
  }

  add(user) {
    this.users.push(user);
  }

  remove(id) {
    this.users = this.users.filter(u => u.id !== id);
  }

  canMatch(a, b) {
    if (a.id === b.id) return false;

    return (
      a.intent === b.intent &&
      (a.preference === "any" || a.preference === b.gender) &&
      (b.preference === "any" || b.preference === a.gender)
    );
  }
}

module.exports = MatchingService;