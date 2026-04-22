const sessions = new Map();

function createEmptySession() {
  return {
    messages: [],
    order: { items: [] },
    nextQuestion: null,
    status: "collecting",
    total: 0,
    orderId: null,
    confirmedAt: null,
    stuckCount: 0,       // quantas msgs seguidas na mesma nextQuestion
    invalidCount: 0      // quantas respostas inválidas seguidas
  };
}

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, createEmptySession());
  }

  return sessions.get(userId);
}

function saveSession(userId, session) {
  sessions.set(userId, session);
}

function resetSession(userId) {
  sessions.set(userId, createEmptySession());
}

module.exports = {
  getSession,
  saveSession,
  resetSession
};