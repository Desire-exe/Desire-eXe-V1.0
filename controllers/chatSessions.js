
const activeChats = new Map();

module.exports = {
    enableChat: (chatId) => {
        activeChats.set(chatId, []);
    },
    disableChat: (chatId) => {
        activeChats.delete(chatId);
    },
    isChatEnabled: (chatId) => activeChats.has(chatId),
    getMessages: (chatId) => activeChats.get(chatId) || [],
    addMessage: (chatId, role, content) => {
        if (!activeChats.has(chatId)) return;
        const messages = activeChats.get(chatId);
        messages.push({ role, content });
        if (messages.length > 10) messages.shift(); // Limit to last 10 messages
        activeChats.set(chatId, messages);
    }
};
