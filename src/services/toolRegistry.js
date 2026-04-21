const fs = require('fs');
const path = require('path');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.toolsDir = path.join(__dirname, '../tools');
    this.skillsDir = path.join(__dirname, '../skills');
  }

  async loadTools() {
    // Load base tools
    if (fs.existsSync(this.toolsDir)) {
      const files = fs.readdirSync(this.toolsDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        try {
          const tool = require(path.join(this.toolsDir, file));
          const name = file.replace('.js', '');
          this.register(name, tool);
          console.log(`Loaded tool: ${name}`);
        } catch (err) {
          console.error(`Failed to load tool ${file}:`, err.message);
        }
      }
    }
  }

  register(name, fn) {
    this.tools.set(name, fn);
  }

  async execute(toolName, params) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    // Unwrap params to positional args
    const args = typeof params === 'object' && params !== null
      ? Object.values(params)
      : [params];
    return tool(...args);
  }

  list() {
    return Array.from(this.tools.keys());
  }

  getDefinitions() {
    const definitions = [];
    for (const [name] of this.tools) {
      definitions.push({
        type: 'function',
        function: {
          name,
          description: `${name} tool`,
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Input for the tool' }
            }
          }
        }
      });
    }
    return definitions;
  }

  // Dynamic skill loading
  async loadSkill(skillName, skillCode) {
    try {
      const fn = new Function('params', skillCode);
      this.register(skillName, fn);
      return { success: true, message: `Skill ${skillName} loaded` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Save skill to file (as .md)
  async saveSkill(skillName, skillCode) {
    const filePath = path.join(this.skillsDir, `${skillName}.md`);
    fs.writeFileSync(filePath, skillCode);
    return { success: true, message: `Skill ${skillName} saved as .md` };
  }
}

module.exports = new ToolRegistry();
