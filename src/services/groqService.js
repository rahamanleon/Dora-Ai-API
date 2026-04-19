/**
 * Universal AI Provider Service
 * Supports any OpenAI-compatible API provider configured in config.json
 * Provider is set via config.activeProvider
 */

const axios = require('axios');
const config = require('../config');

class AIService {
  async chat(messages, tools = []) {
    const ai = config.getActiveAI();
    
    if (!ai.apiKey) {
      throw new Error(`${ai.name.toUpperCase()} API key not configured. Check your config.json or .env`);
    }

    const requestBody = {
      model: ai.model,
      messages: messages,
      temperature: ai.temperature,
      max_tokens: ai.maxTokens
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    try {
      const response = await axios.post(`${ai.baseUrl}/chat/completions`, requestBody, {
        headers: {
          'Authorization': `Bearer ${ai.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: ai.timeout
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        const msg = error.response.data?.error?.message || error.response.data?.error?.code || error.message;
        throw new Error(`${ai.name.toUpperCase()} API error: ${error.response.status} - ${msg}`);
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to ${ai.name} at ${ai.baseUrl}. Check if the server is running.`);
      }
      throw error;
    }
  }

  // Test a specific provider
  async testProvider(providerName, message = 'Say "Hello, this is a test." and nothing else.') {
    const original = config.activeProvider;
    
    try {
      config.activeProvider = providerName;
      const ai = config.getActiveAI();
      
      if (!ai.apiKey) {
        return { success: false, error: `No API key for ${providerName}` };
      }

      const response = await axios.post(`${ai.baseUrl}/chat/completions`, {
        model: ai.model,
        messages: [{ role: 'user', content: message }],
        temperature: 0.7,
        max_tokens: 100
      }, {
        headers: {
          'Authorization': `Bearer ${ai.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: ai.timeout
      });

      return {
        success: true,
        provider: providerName,
        model: ai.model,
        response: response.data.choices[0].message.content,
        tokens: response.data.usage
      };
    } catch (error) {
      return {
        success: false,
        provider: providerName,
        error: error.response?.data?.error?.message || error.message
      };
    } finally {
      config.activeProvider = original;
    }
  }
}

module.exports = new AIService();
