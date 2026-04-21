const aiService = require('./groqService');
const memoryService = require('./memoryService');
const toolRegistry = require('./toolRegistry');
const config = require('../config');

class AgentService {
  async chat(userId, message) {
    let memories = [];
    let historyMessages = [];

    // Fetch memory and history with graceful fallbacks
    try {
      const memResult = await memoryService.getRecent(userId, config.agent.recentMemoryLimit);
      memories = Array.isArray(memResult) ? memResult : [];
    } catch (e) {
      console.warn('[Agent] Memory fetch failed, continuing without:', e.message);
    }

    try {
      const histResult = await memoryService.getConversationHistory(userId, config.agent.memoryLimit);
      historyMessages = Array.isArray(histResult) ? histResult.map(h => ({ role: h.role, content: h.content })) : [];
    } catch (e) {
      console.warn('[Agent] History fetch failed, continuing without:', e.message);
    }

    const memoryContext = memories.length > 0
      ? `\nRecent memory:\n${memories.map(m => `${m.key}: ${m.value}`).join('\n')}`
      : '';

    // Build messages - ADD MANDATORY SEARCH HINT FOR DATE-RELATED QUERIES
    const isFutureQuestion = /\b(202[5-9]|203[0-9])\b/.test(message) || 
                             /\b(upcoming|future|latest|newest|best of|predictions?|forecast)\b/i.test(message);
    
    const searchHint = isFutureQuestion 
      ? '\n\n⚠️ IMPORTANT: This question mentions a future date or prediction. You MUST use webSearch tool FIRST before answering. Do not skip this step.'
      : '';
    
    let messages = [
      { role: 'system', content: config.agent.systemPrompt + memoryContext + searchHint },
      ...historyMessages,
      { role: 'user', content: message }
    ];

    // Get tool definitions
    const tools = toolRegistry.getDefinitions();

    // Multi-turn loop
    const MAX_TURNS = config.agent.maxTurns;
    let turnCount = 0;
    let finalReply = '';
    let allActions = [];

    try {
      while (turnCount < MAX_TURNS) {
        turnCount++;

        const response = await aiService.chat(messages, tools);
        const choice = response.choices[0];
        const reply = choice.message.content || '';

        if (choice.finish_reason !== 'tool_calls' && !choice.message.tool_calls) {
          try {
            const parsed = JSON.parse(reply);
            finalReply = parsed.reply || reply;
          } catch {
            finalReply = reply;
          }
          break;
        }

        const toolCalls = choice.message.tool_calls || [];

        messages.push({ role: 'assistant', content: reply });

        for (const call of toolCalls) {
          const toolName = call.function.name;
          let args = {};
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            args = {};
          }

          messages.push({ role: 'assistant', content: null, tool_calls: [call] });

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
            messages.push({ role: 'tool', tool_call_id: call.id, content: resultContent });
          } catch (err) {
            allActions.push({ type: toolName, error: err.message });
            messages.push({ role: 'tool', tool_call_id: call.id, content: `Tool execution error: ${err.message}` });
          }
        }
      }

      if (turnCount >= MAX_TURNS) {
        finalReply = 'I apologise, I hit the maximum number of tool-use turns. Please try a more specific question.';
      }
    } catch (error) {
      console.error('Agent loop error:', error);
      return {
        reply: `Error: ${error.message}`,
        actions: [],
        memory_update: []
      };
    }

    // Save conversation
    try {
      await memoryService.saveConversation(userId, 'user', message);
    } catch (e) {
      console.warn('[Agent] Failed to save user message:', e.message);
    }
    try {
      await memoryService.saveConversation(userId, 'assistant', finalReply);
    } catch (e) {
      console.warn('[Agent] Failed to save assistant reply:', e.message);
    }

    // Extract and save memory updates
    let memoryUpdates = [];
    try {
      const parsed = JSON.parse(finalReply);
      if (parsed.memory_update) memoryUpdates = parsed.memory_update;
    } catch {
      // Not JSON — no memory updates
    }

    for (const update of memoryUpdates) {
      try {
        await memoryService.save(userId, update.key, update.value);
      } catch (e) {
        console.warn('[Agent] Failed to save memory update:', e.message);
      }
    }

    return {
      reply: finalReply,
      actions: allActions,
      memory_update: memoryUpdates
    };
  }

  async executeTool(userId, toolName, params) {
    const result = await toolRegistry.execute(toolName, params);
    try {
      await memoryService.save(userId, `tool_${toolName}`, JSON.stringify(params));
    } catch (e) {
      console.warn('[Agent] Failed to log tool use:', e.message);
    }
    return result;
  }
}

module.exports = new AgentService();
