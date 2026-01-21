const store = new Map();

exports.getWizard = (uid) => store.get(uid);
exports.setWizard = (uid, data) => store.set(uid, data);
exports.clearWizard = (uid) => store.delete(uid);

// 供 group 使用
exports.findWizardByChat = (chatId) => {
  for (const v of store.values()) {
    if (v.chatId === chatId) return v;
  }
  return null;
};
