# Dora API 🤖

> Lightweight AI Agent API with persistent memory, web tools, and dynamic skill loading. Built by **Rahaman Leon**.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rahamanleon/Dora-Ai-API)

## Features

- 💬 **AI Chat** - Powered by Groq LLM (free tier available)
- 🧠 **Persistent Memory** - MongoDB-backed user memories
- 🔍 **Web Tools** - Search, fetch URLs, generate images
- ⚡ **Dynamic Skills** - Load custom skills at runtime
- 🌐 **RESTful API** - Easy integration with any platform
- 📱 **WhatsApp Integration** - Use with GoatBot v2

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/rahamanleon/Dora-Ai-API.git
cd Dora-Ai-API
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
GROQ_API_KEY=your_groq_api_key
MONGODB_URI=mongodb://localhost:27017/dora
MAX_HISTORY=20
```

### 3. Get API Keys

| Provider | Link | Notes |
|----------|------|-------|
| **Groq** | https://console.groq.com | Free tier, fast inference |
| **MongoDB Atlas** | https://www.mongodb.com/atlas | Free 512MB cluster |

### 4. Run

```bash
npm start
```

Server starts at `http://localhost:3000`

---

## API Endpoints

### Chat

```bash
# Send a message
POST /chat
Content-Type: application/json

{
  "user_id": "user123",
  "message": "Hello, what's the weather in Tokyo?"
}

# Response
{
  "response": "The weather in Tokyo is...",
  "tools_used": ["webSearch"],
  "memory_updated": true
}
```

### Memory

```bash
# Get all memories for user
GET /chat/memory?user_id=user123

# Save a memory
POST /chat/memory
Content-Type: application/json
{
  "user_id": "user123",
  "key": "favorite_color",
  "value": "blue"
}

# Delete a memory
DELETE /chat/memory?user_id=user123&key=favorite_color

# Get conversation history
GET /chat/history?user_id=user123
```

### Tools

```bash
# List all available tools
GET /tools

# Execute a tool directly
POST /tools/execute
{
  "user_id": "user123",
  "tool_name": "webSearch",
  "params": { "query": "latest AI news" }
}

# Register a skill (in-memory, lost on restart)
POST /tools/register
{
  "name": "calculator",
  "code": "async function(params) { return { result: params.a + params.b }; }"
}

# Load a skill (persistent, stored in DB)
POST /tools/skill
{
  "name": "mySkill",
  "code": "async function(params) { return { data: params }; }"
}
```

### Health Check

```bash
GET /health
# Returns: { "status": "ok", "timestamp": "..." }
```

---

## Built-in Tools

| Tool | Description | API Required |
|------|-------------|--------------|
| `webSearch` | DuckDuckGo search (free) | None |
| `fetchUrl` | Parse web pages | None |
| `generateImage` | Image generation | External API |

---

## Deploy to Render (Free)

### One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rahamanleon/Dora-Ai-API)

### Manual Deploy

1. Push to GitHub
2. Create Web Service on [Render](https://render.com)
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
4. Add environment variables (mark as secret):
   - `GROQ_API_KEY`
   - `MONGODB_URI`
5. Deploy!

> **Note:** Render's free tier spins down after 15 min of inactivity. It wakes on any HTTP request.

---

## Project Structure

```
Dora-Ai-API/
├── src/
│   ├── app.js              # Express server entry
│   ├── config.js           # Environment config loader
│   ├── controllers/
│   │   ├── chatController.js    # Chat & memory endpoints
│   │   └── toolController.js    # Tool management
│   ├── models/
│   │   ├── memoryModel.js      # User memories
│   │   └── conversationModel.js # Chat history
│   ├── routes/             # API route definitions
│   ├── services/
│   │   └── agentService.js     # AI agent logic
│   ├── skills/             # Dynamic skills storage
│   ├── tools/              # Built-in tools
│   │   ├── webSearch.js
│   │   ├── fetchUrl.js
│   │   └── generateImage.js
│   └── utils/              # Helpers
├── .env                    # Your config (gitignored)
├── .env.example            # Template
├── render.yaml             # Render deployment config
├── dora.js                 # WhatsApp bot module
├── package.json
└── README.md
```

---

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
┌──────▼──────┐
│   Express   │
│   Server    │
└──────┬──────┘
       │
┌──────▼──────┐      ┌─────────────┐
│ Controllers │─────►│ ToolRegistry│
└──────┬──────┘      └──────┬──────┘
       │                    │
┌──────▼──────┐      ┌──────▼──────┐
│AgentService │─────►│   Groq LLM  │
└──────┬──────┘      └─────────────┘
       │
┌──────▼──────┐
│  MongoDB    │
│ (Memory &  │
│  History)   │
└─────────────┘
```

---

## WhatsApp Integration

Use Dora API with [GoatBot v2](https://github.com/VectorGoat/GoatBot) WhatsApp bot.

**Usage:**
1. Copy `dora.js` to your GoatBot commands folder
2. Set `DORA_API_URL` to your Dora API server
3. Use `/dora <question>` in WhatsApp

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `GROQ_API_KEY` | Yes | - | Groq API key |
| `MONGODB_URI` | Yes | - | MongoDB connection |
| `MAX_HISTORY` | No | 20 | Conversation history limit |
| `TIMEOUT_MS` | No | 25000 | AI response timeout |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "axios": "^1.6.2",
  "dotenv": "^16.3.1",
  "cheerio": "^1.0.0-rc.12",
  "uuid": "^9.0.1"
}
```

---

## License

MIT License - [Rahaman Leon](https://github.com/rahamanleon)

---

<p align="center">
  Made with ❤️
</p>