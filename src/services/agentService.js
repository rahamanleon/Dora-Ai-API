const groqService = require('./groqService');
const memoryService = require('./memoryService');
const toolRegistry = require('./toolRegistry');

const SYSTEM_PROMPT = `You are Dora, a helpful AI assistant powered by Groq.

You have access to tools:
- webSearch: Search the web via DuckDuckGo HTML. Returns title, snippet, and link for each result.
- fetchUrl: Fetch and extract readable content from any URL. Returns title and main text content.
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
- For time/date questions: include the actual time in the reply (e.g. "It's 11 PM in Bangladesh")
- For news/facts: cite your sources with URLs
- Use fetchUrl on search results to get rich content before answering
- Keep replies conversational, informative, and helpful
- If you use a tool, include a brief note in your reply about what you're looking up`;

class AgentService {
  async chat(userId, message) {
    try {
      // 1. Fetch relevant memory
      const memories = await memoryService.getRecent(userId, 5);
      const memoryContext = memories.length > 0
        ? `\nRecent memory:\n${memories.map(m => `${m.key}: ${m.value}`).join('\n')}`
        : '';

      // 2. Fetch conversation history
      const history = await memoryService.getConversationHistory(userId, 10);
      const historyMessages = history.map(h => ({
        role: h.role,
        content: h.content
      }));

      // 3. Build initial messages
      let messages = [
        { role: 'system', content: SYSTEM_PROMPT + memoryContext },
        ...historyMessages,
        { role: 'user', content: message }
      ];

      // 4. Get tool definitions
      const tools = toolRegistry.getDefinitions();

      // 5. Multi-turn loop: keep going until model stops calling tools
      const MAX_TURNS = 5;
      let turnCount = 0;
      let finalReply = '';
      let allActions = [];

      while (turnCount < MAX_TURNS) {
        turnCount++;

        // 5a. Call Groq
        const response = await groqService.chat(messages, tools);
        const choice = response.choices[0];
        const reply = choice.message.content || '';

        // Check for tool calls
        if (choice.finish_reason !== 'tool_calls' && !choice.message.tool_calls) {
          // No more tool calls — this is the final reply
          // Try to parse structured response
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

        const toolResults = [];

        for (const call of toolCalls) {
          const toolName = call.function.name;
          let args = {};
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            args = {};
          }

          // Add assistant tool call message
          messages.push({
            role: 'assistant',
          content: null,
            tool_calls: [call]
          });

          try {
            const result = await toolRegistry.execute(toolName, args);

            // Format result for model context
            let resultContent;
            if (result.success === false) {
              resultContent = `Error: ${result.error}`;
            } else if (Array.isArray(result.results)) {
              // Web search results — format nicely
              const formatted = result.results.map(r =>
                `Title: ${r.title}\nLink: ${r.link}\nSummary: ${r.snippet || 'No summary available'}`
              ).join('\n\n');
              resultContent = `Search results for "${result.query}":\n\n${formatted}`;
            } else if (result.content) {
              resultContent = `Content from ${result.url}:\n${result.content}`;
            } else {
              resultContent = JSON.stringify(result);
            }

            toolResults.push({ tool: toolName, result: resultContent });
            allActions.push({ type: toolName, result });

            // Add tool result as a message for next turn
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: resultContent
            });

          } catch (err) {
            const errorResult = `Tool execution error: ${err.message}`;
            toolResults.push({ tool: toolName, error: err.message });
            allActions.push({ type: toolName, error: err.message });

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: errorResult
            });
          }
        }

        // Continue loop — model will now see tool results and can respond
      }

      // If we exited due to max turns, use last reply
      if (turnCount >= MAX_TURNS) {
        finalReply = 'I apologies, I hit the maximum number of tool-use turns. Please try a more specific question.';
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
