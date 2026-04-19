/**
 * Dora AI API Configuration
 * Loads settings from config.json and resolves environment variables
 * AI Providers are dynamically loaded from config.json - no hardcoded list
 */

const fs = require('fs');
const path = require('path');

// Load config from config.json
const configPath = path.join(__dirname, '..', 'config.json');
let configData;

try {
  configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error('Error loading config.json:', err.message);
  process.exit(1);
}

// Resolve ${ENV_VAR} placeholders
function resolveEnvVars(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, varName) => {
      const envVal = process.env[varName];
      if (!envVal) {
        console.warn(`Warning: Environment variable ${varName} is not set`);
        return '';
      }
      return envVal;
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVars);
  }
  if (obj && typeof obj === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveEnvVars(value);
    }
    return resolved;
  }
  return obj;
}

configData = resolveEnvVars(configData);

// ==================== BUILD AI PROVIDERS DYNAMICALLY ====================
// Each provider in config.json becomes a config property automatically
const aiProviders = {};

if (configData.aiProviders) {
  for (const [name, settings] of Object.entries(configData.aiProviders)) {
    aiProviders[name] = {
      apiKey: settings.apiKey || '',
      baseUrl: settings.baseUrl || '',
      model: settings.model || '',
      maxTokens: settings.maxTokens || 4096,
      temperature: settings.temperature || 0.7,
      timeout: settings.timeout || 60000
    };
  }
}

// Build config object
const config = {
  // Spread dynamically loaded AI providers
  ...aiProviders,

  // ==================== ACTIVE AI PROVIDER ====================
  activeProvider: configData.activeProvider || 'groq',

  // ==================== DATABASE ====================
  mongodb: {
    uri: configData.database?.mongodb || 'mongodb://localhost:27017/dora'
  },

  // ==================== SERVER ====================
  server: {
    port: configData.server?.port || 3000,
    env: configData.server?.env || 'development'
  },

  // ==================== TOOLS ====================
  tools: {
    webSearch: {
      maxResults: configData.tools?.webSearch?.maxResults || 5,
      userAgents: configData.tools?.webSearch?.userAgents || [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      ]
    },
    fetchUrl: {
      maxChars: configData.tools?.fetchUrl?.maxChars || 3000,
      timeout: configData.tools?.fetchUrl?.timeout || 30000
    }
  },

  // ==================== AGENT SETTINGS ====================
  agent: {
    maxTurns: configData.agent?.maxTurns || 5,
    memoryLimit: configData.agent?.memoryLimit || 10,
    recentMemoryLimit: configData.agent?.recentMemoryLimit || 5,
    systemPrompt: `You are Dora, a helpful AI assistant.

You have access to tools:
- webSearch: Search the web via DuckDuckGo HTML. Returns title, snippet, and link for each result.
- fetchUrl: Fetch and extract readable content from any URL.
- generateImage: Generate an image from a text prompt.

When a user asks a question that needs real-time or factual information, ALWAYS use webSearch first.
Then use fetchUrl to get full content from the most relevant result(s) to give a comprehensive answer.

IMPORTANT — Multi-step workflow:
1. If the question needs current info, use webSearch first
2. Fetch the full content of 1-3 most relevant URLs using fetchUrl
3. Synthesize all gathered information into a clear, helpful answer
4. Save important user facts/preferences with memory_update

Return your response as JSON with this exact format:
{
  "reply": "Your synthesized answer text",
  "actions": [{"type": "tool_name", "input": {"query": "..."}}],
  "memory_update": [{"key": "key_name", "value": "value_to_save"}]
}

Rules:
- For time/date questions: include the actual time in the reply
- For news/facts: cite your sources with URLs
- Use fetchUrl on search results to get rich content before answering
- Keep replies conversational, informative, and helpful
- If you use a tool, include a brief note in your reply about what you're looking up`
  }
};

// ==================== HELPER FUNCTIONS ====================

config.getActiveAI = function() {
  const provider = this.activeProvider;
  if (!this[provider]) {
    throw new Error(`Unknown AI provider: "${provider}". Add "${provider}" to aiProviders in config.json`);
  }
  return {
    ...this[provider],
    name: provider
  };
};

config.isAIConfigured = function(provider = null) {
  const p = provider || this.activeProvider;
  const ai = this[p];
  if (!ai) return false;
  // Check if it's a local provider (no apiKey needed) or has valid apiKey
  if (ai.baseUrl && ai.baseUrl.startsWith('http://localhost')) return true;
  return !!(ai.apiKey);
};

// Dynamically get all providers from config.json
config.getAvailableProviders = function() {
  const providers = Object.keys(configData.aiProviders || {});
  return providers.filter(p => this.isAIConfigured(p));
};

// Get all configured providers (even without apiKey)
config.getAllProviders = function() {
  return Object.keys(configData.aiProviders || {});
};

module.exports = config;
