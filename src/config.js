/**
 * Dora AI API Configuration
 * Loads settings from config.json and resolves environment variables
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

// Build config object from JSON
const config = {
  // ==================== AI PROVIDERS ====================
  groq: {
    apiKey: configData.aiProviders?.groq?.apiKey || '',
    baseUrl: configData.aiProviders?.groq?.baseUrl || 'https://api.groq.com/openai/v1',
    model: configData.aiProviders?.groq?.model || 'llama-3.1-8b-instant',
    maxTokens: configData.aiProviders?.groq?.maxTokens || 4096,
    temperature: configData.aiProviders?.groq?.temperature || 0.7,
    timeout: configData.aiProviders?.groq?.timeout || 60000
  },

  openai: {
    apiKey: configData.aiProviders?.openai?.apiKey || '',
    baseUrl: configData.aiProviders?.openai?.baseUrl || 'https://api.openai.com/v1',
    model: configData.aiProviders?.openai?.model || 'gpt-4o-mini',
    maxTokens: configData.aiProviders?.openai?.maxTokens || 4096,
    temperature: configData.aiProviders?.openai?.temperature || 0.7,
    timeout: configData.aiProviders?.openai?.timeout || 60000
  },

  openrouter: {
    apiKey: configData.aiProviders?.openrouter?.apiKey || '',
    baseUrl: configData.aiProviders?.openrouter?.baseUrl || 'https://openrouter.ai/api/v1',
    model: configData.aiProviders?.openrouter?.model || 'google/gemini-2.0-flash-thinking-exp:free',
    maxTokens: configData.aiProviders?.openrouter?.maxTokens || 4096,
    temperature: configData.aiProviders?.openrouter?.temperature || 0.7,
    timeout: configData.aiProviders?.openrouter?.timeout || 60000
  },

  huggingface: {
    apiKey: configData.aiProviders?.huggingface?.apiKey || '',
    baseUrl: configData.aiProviders?.huggingface?.baseUrl || 'https://api-inference.huggingface.co/models',
    model: configData.aiProviders?.huggingface?.model || 'meta-llama/Llama-3.2-3B-Instruct',
    timeout: configData.aiProviders?.huggingface?.timeout || 60000
  },

  ollama: {
    baseUrl: configData.aiProviders?.ollama?.baseUrl || 'http://localhost:11434',
    model: configData.aiProviders?.ollama?.model || 'llama3.2',
    maxTokens: configData.aiProviders?.ollama?.maxTokens || 4096,
    temperature: configData.aiProviders?.ollama?.temperature || 0.7,
    timeout: configData.aiProviders?.ollama?.timeout || 120000
  },

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
    throw new Error(`Unknown AI provider: ${provider}`);
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
  if (p === 'ollama') return true;
  return !!(ai.apiKey);
};

config.getAvailableProviders = function() {
  const providers = ['groq', 'openai', 'openrouter', 'huggingface', 'ollama'];
  return providers.filter(p => this.isAIConfigured(p));
};

module.exports = config;
