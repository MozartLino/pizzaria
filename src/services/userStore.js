const users = new Map();

function getUserData(userId) {
  return users.get(userId) || {};
}

function saveUserData(userId, data) {
  users.set(userId, { ...getUserData(userId), ...data });
}

module.exports = { getUserData, saveUserData };
