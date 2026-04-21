const axios = require("axios");

const DORA_API_URL = "https://dora-ai-api.onrender.com/chat";

// Validate API URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  config: {
    name: "dora",
    version: "1.8",
    author: String.fromCharCode(77, 97, 104, 77, 85, 68),
    countDown: 5,
    role: 0,
    description: {
      bn: "AI এর সাথে চ্যাট করুন",
      en: "Chat with Dora AI assistant"
    },
    category: "ai",
    guide: {
      bn: "   {pn} <প্রশ্ন>: আপনার প্রশ্নটি লিখুন",
      en: "   {pn} <question>: Type your question"
    }
  },

  langs: {
    bn: {
      noQuery: "× বেবি, কিছু তো জিজ্ঞেস করো!",
      noResponse: "দুঃখিত, কোনো উত্তর পাওয়া যায়নি।",
      error: "× এআই কাজ করছে না: %1",
      apiDown: "× এআই সার্ভার এখন অফলাইন। পরে আবার চেষ্টা করুন।",
      thinking: "🤖 ভাবছি..."
    },
    en: {
      noQuery: "× Please provide a question!",
      noResponse: "Sorry, I couldn't generate a response.",
      error: "× API error: %1",
      apiDown: "× AI server is offline. Please try again later.",
      thinking: "🤖 Thinking..."
    }
  },

  onStart: async function ({ api, message, args, event, getLang }) {
    // Author validation
    const expectedAuthor = String.fromCharCode(77, 97, 104, 77, 85, 68);
    if (this.config.author !== expectedAuthor) {
      return api.sendMessage(
        "You are not authorized to change the author name.",
        event.threadID,
        event.messageID
      );
    }

    const query = args.join(" ").trim();
    if (!query) {
      return message.reply(getLang("noQuery"));
    }

    // Validate API URL
    if (!isValidUrl(DORA_API_URL)) {
      return message.reply(getLang("error", "Invalid API URL configured"));
    }

    // Send typing indicator
    api.sendTypingIndicator(event.threadID).catch(() => {});

    try {
      const response = await axios.post(
        DORA_API_URL,
        {
          user_id: String(event.senderID),
          message: query
        },
        {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 30000 // 30s timeout
        }
      );

      // Handle various response formats
      const replyText =
        response.data?.reply ||
        response.data?.response ||
        response.data?.message ||
        response.data?.text ||
        getLang("noResponse");

      // Handle empty response
      if (!replyText || replyText.trim() === "") {
        return message.reply(getLang("noResponse"));
      }

      api.sendMessage(replyText, event.threadID, (error, info) => {
        if (!error) {
          if (!global.GoatBot) global.GoatBot = {};
          if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
          global.GoatBot.onReply.set(info.messageID, {
            commandName: this.config.name,
            author: event.senderID,
            messageID: info.messageID
          });
        }
      }, event.messageID);

    } catch (err) {
      console.error("Dora API Error:", err.message);

      // Handle specific error types
      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
        return message.reply(getLang("apiDown"));
      }

      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        if (status === 502 || status === 503 || status === 504) {
          return message.reply(getLang("apiDown"));
        }
        // Include status for debugging
        return message.reply(getLang("error", `HTTP ${status}`));
      }

      if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
        return message.reply(getLang("error", "Request timeout"));
      }

      return message.reply(getLang("error", err.message));
    }
  },

  onReply: async function ({ api, event, Reply, args, getLang, message }) {
    if (Reply.author !== event.senderID) return;

    const query = args.join(" ").trim();
    if (!query) return;

    // Send typing indicator
    api.sendTypingIndicator(event.threadID).catch(() => {});

    try {
      const response = await axios.post(
        DORA_API_URL,
        {
          user_id: String(event.senderID),
          message: query
        },
        {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );

      const replyText =
        response.data?.reply ||
        response.data?.response ||
        response.data?.message ||
        response.data?.text ||
        getLang("noResponse");

      if (!replyText || replyText.trim() === "") {
        return message.reply(getLang("noResponse"));
      }

      api.sendMessage(replyText, event.threadID, (error, info) => {
        if (!error) {
          if (!global.GoatBot) global.GoatBot = {};
          if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
          global.GoatBot.onReply.set(info.messageID, {
            commandName: this.config.name,
            author: event.senderID,
            messageID: info.messageID
          });
        }
      }, event.messageID);

    } catch (err) {
      console.error("Dora Reply Error:", err.message);

      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
        return message.reply(getLang("apiDown"));
      }

      return message.reply(getLang("error", err.message));
    }
  }
};
