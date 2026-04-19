const axios = require('axios');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1';
    this.model = 'llama-3.1-8b-instant';
  }

  async chat(messages, tools = []) {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const requestBody = {
      model: this.model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Groq API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }
}

module.exports = new GroqService();
