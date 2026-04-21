const toolRegistry = require('../services/toolRegistry');
const agentService = require('../services/agentService');

async function listTools(req, res) {
  try {
    const tools = toolRegistry.list();
    const definitions = toolRegistry.getDefinitions();
    res.json({ tools, definitions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function executeTool(req, res) {
  try {
    const { user_id, tool_name, params } = req.body;

    if (!tool_name) {
      return res.status(400).json({ error: 'tool_name required' });
    }

    // Flatten params if wrapped (API passes {params: {...}})
    const flatParams = params || {};

    const result = await agentService.executeTool(
      user_id || 'anonymous',
      tool_name,
      flatParams
    );

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function loadSkill(req, res) {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'name and code required' });
    }

    const result = await toolRegistry.saveSkill(name, code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function registerTool(req, res) {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'name and code required' });
    }

    const result = await toolRegistry.loadSkill(name, code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listTools,
  executeTool,
  loadSkill,
  registerTool
};
