const aiService = require('./groqService');
const memoryService = require('./memoryService');
const toolRegistry = require('./toolRegistry');
const config = require('../config');

class AgentService {
  async chat(userId, message) {
    try {
      const aiConfig = config.getActiveAI();

      // 1. Fetch relevant memory
      const memories = await memoryService.getRecent(userId, config.agent.recentMemoryLimit);
      const memoryContext = memories.length > 0
        ? `\nRecent memory:\n${memories.map(m => `${m.key}: ${m.value}`).join('\n')}`
        : '';

      // 2. Fetch conversation history
      const history = await memoryService.getConversationHistory(userId, config.agent.memoryLimit);
      const historyMessages = history.map(h => ({
        role: h.role,
        content: h.content
      }));

      // 3. Build initial messages with system prompt from config
      let messages = [
        { role: 'system', content: config.agent.systemPrompt + memoryContext },
        ...historyMessages,
        { role: 'user', content: message }
      ];

      // 4. Get tool definitions
      const tools = toolRegistry.getDefinitions();

      // 5. Multi-turn loop: keep going until model stops calling tools
      const MAX_TURNS = config.agent.maxTurns;
      let turnCount = 0;
      let finalReply = '';
      let allActions = [];

      while (turnCount < MAX_TURNS) {
        turnCount++;

        // 5a. Call AI
        const response = await aiService.chat(messages, tools);
        const choice = response.choices[0];
        const reply = choice.message.content || '';

        // Check for tool calls
        if (choice.finish_reason !== 'tool_calls' && !choice.message.tool_calls) {
          // No more tool calls — this is the final reply
          try {
            const parsed = JSON.parse(reply);
            finalReply = parsed.reply || reply;
          } catch {
            finalReply = reply;
          }
          break;
        }

        // 5b. Execute all tool calls in this turn
        const toolCalls = choice.message.tool_calls || [];

        // Add assistant message with tool calls to conversation
        messages.push({
          role: 'assistant',
          content: reply
        });

        for (const call of toolCalls) {
          const toolName = call.function.name;
          let args = {};
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            args = {};
          }

          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [call]
          });

          try {
            const result = await toolRegistry.execute(toolName, args);

            let resultContent;
            if (result.success === false) {
              resultContent = `Error: ${result.error}`;
            } else if (Array.isArray(result.results)) {
              const formatted = result.results.map(r =>
                `Title: ${r.title}\nLink: ${r.link}\nSummary: ${r.snippet || 'No summary available'}`
              ).join('\n\n');
              resultContent = `Search results for "${result.query}":\n\n${formatted}`;
            } else if (result.content) {
              resultContent = `Content from ${result.url}:\n${result.content}`;
            } else {
              resultContent = JSON.stringify(result);
            }

            allActions.push({ type: toolName, result });
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: resultContent
            });

          } catch (err) {
            allActions.push({ type: toolName, error: err.message });
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: `Tool execution error: ${err.message}`
            });
          }
        }
      }

      // If we exited due to max turns
      if (turnCount >= MAX_TURNS) {
        finalReply = 'I apologise, I hit the maximum number of tool-use turns. Please try a more specific question.';
      }

      // 6. Save conversation
      await memoryService.saveConversation(userId, 'user', message);
      await memoryService.saveConversation(userId, 'assistant', finalReply);

      // 7. Extract and save memory updates from final reply
      let memoryUpdates = [];
      try {
        const parsed = JSON.parse(finalReply);
        if (parsed.memory_update) memoryUpdates = parsed.memory_update;
      } catch {
        // Not JSON — no memory updates
      }

      for (const update of memoryUpdates) {
        await memoryService.save(userId, update.key, update.value);
      }

      return {
        reply: finalReply,
        actions: allActions,
        memory_update: memoryUpdates
      };
    } catch (error) {
      console.error('Agent error:', error);
      return {
        reply: `Error: ${error.message}`,
        actions: [],
        memory_update: []
      };
    }
  }

  // Direct tool execution
  async executeTool(userId, toolName, params) {
    const result = await toolRegistry.execute(toolName, params);
    await memoryService.save(userId, `tool_${toolName}`, JSON.stringify(params));
    return result;
  }
}

module.exports = new AgentService();
