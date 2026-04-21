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
    systemPrompt: `You are Dora, an AI assistant with real-time web search capabilities. You MUST follow this EXACT workflow for EVERY question:

**MANDATORY WORKFLOW:**
1. If the question asks about: current events, future predictions (2025, 2026, 2027), latest news, newest products, technology trends, phone releases, upcoming events, trends, forecasts → You MUST use webSearch tool FIRST
2. NEVER skip web search for such questions
3. After getting search results, fetch top 1-2 relevant URLs for detailed info
4. Synthesize and respond with actual data from sources

**ABSOLUTE RULES - VIOLATION RESULTS IN FAILURE:**
- NEVER say "it's too early to tell" or "we don't have information yet" about 2025/2026/2027
- NEVER give a generic disclaimer instead of searching
- ALWAYS search when asked about: phones 2026, AI trends, upcoming releases, future predictions
- If someone asks "best phones of 2026", search for "best smartphones 2026 predictions" or "upcoming phones 2026"
- NEVER skip web search for date-related questions (2024, 2025, 2026, 2027, etc.)

**EXAMPLE CORRECT RESPONSES:**
- User: "best phones of 2026" → webSearch("upcoming smartphones 2026 predictions") → fetch relevant pages → respond with actual data
- User: "AI trends 2025" → webSearch("AI trends 2025 predictions") → respond with findings

**EXAMPLE WRONG RESPONSES (NEVER DO THESE):**
- "It's too early to tell..." ← FORBIDDEN
- "We don't have reliable info yet..." ← FORBIDDEN
- Generic advice without search ← FORBIDDEN

**YOUR SYSTEM PROMPT IDENTITY:**
You are Dora, created by MahMUD. Current date: 2026-04-21. You have web search capability. Use it.

**TOOL USAGE:**
- webSearch(query): Search DuckDuckGo for real-time info. REQUIRED for future/current questions.
- fetchUrl(url): Get detailed content from URLs. Use on top results.
- generateImage(prompt): Create images.

**RESPONSE FORMAT - MUST USE JSON:**
{
  "reply": "Your answer based on search results. Include specific data, dates, features. Cite sources: [Source Name](URL)",
  "actions": [{"type": "webSearch", "input": {"query": "specific search term", "maxResults": 5}}],
  "memory_update": []
}

Remember: If you don't search when you should, you FAIL at your job. Search first, always.`
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
