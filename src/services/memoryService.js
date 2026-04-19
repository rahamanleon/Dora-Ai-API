const Memory = require('../models/Memory');
const Conversation = require('../models/Conversation');

class MemoryService {
  constructor() {
    // In-memory fallback storage
    this.memoryCache = new Map();
    this.conversationCache = new Map();
  }

  async safeOp(operation, fallback = null) {
    try {
      return await operation();
    } catch (err) {
      if (err.code === 8000 || err.message.includes('not allowed')) {
        console.warn('[MemoryService] MongoDB permission denied, using in-memory fallback');
        return fallback;
      }
      throw err;
    }
  }

  async save(userId, key, value) {
    return this.safeOp(async () => {
      const memory = new Memory({ user_id: userId, key, value });
      await memory.save();
      return memory;
    }, { user_id: userId, key, value, timestamp: new Date() });
  }

  async get(userId, key = null) {
    return this.safeOp(async () => {
      const query = { user_id: userId };
      if (key) query.key = key;
      return Memory.find(query).sort({ timestamp: -1 }).limit(50);
    }, (this.memoryCache.get(userId) || []).filter(m => !key || m.key === key));
  }

  async getRecent(userId, limit = 10) {
    return this.safeOp(async () => {
      return Memory.find({ user_id: userId })
        .sort({ timestamp: -1 })
        .limit(limit);
    }, (this.memoryCache.get(userId) || []).slice(0, limit));
  }

  async getContext(userId, query) {
    const search = query.toLowerCase();
    return this.safeOp(async () => {
      return Memory.find({
        user_id: userId,
        $or: [
          { key: { $regex: query, $options: 'i' } },
          { value: { $regex: query, $options: 'i' } }
        ]
      }).limit(10);
    }, (this.memoryCache.get(userId) || []).filter(m =>
      m.key.toLowerCase().includes(search) || m.value.toLowerCase().includes(search)
    ));
  }

  async saveConversation(userId, role, content) {
    return this.safeOp(async () => {
      const conv = new Conversation({ user_id: userId, role, content });
      await conv.save();
      return conv;
    }, (() => {
      const entry = { user_id: userId, role, content, timestamp: new Date() };
      if (!this.conversationCache.has(userId)) {
        this.conversationCache.set(userId, []);
      }
      this.conversationCache.get(userId).push(entry);
      return entry;
    })());
  }

  async getConversationHistory(userId, limit = 20) {
    return this.safeOp(async () => {
      return Conversation.find({ user_id: userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .then(docs => docs.reverse());
    }, (this.conversationCache.get(userId) || []).slice(-limit));
  }

  async clearMemory(userId, key = null) {
    return this.safeOp(async () => {
      const query = { user_id: userId };
      if (key) query.key = key;
      return Memory.deleteMany(query);
    }, (() => {
      const existing = this.memoryCache.get(userId) || [];
      this.memoryCache.set(userId, key
        ? existing.filter(m => m.key !== key)
        : []
      );
      return { deletedCount: key ? existing.filter(m => m.key === key).length : existing.length };
    })());
  }
}

module.exports = new MemoryService();
