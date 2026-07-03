# Dora AI API 🤖

> Lightweight AI Agent API with persistent memory, web tools, and dynamic skill loading — powered by Groq LLM.

## Features

- 💬 **AI Chat** — powered by Groq LLM (free tier available)
- 🧠 **Persistent Memory** — MongoDB-backed user memories
- 🔍 **Web Tools** — search, fetch URLs, generate images
- ⚡ **Dynamic Skills** — load new capabilities at runtime
- 🌐 **REST API** — deploy anywhere

## Quick Start

```bash
npm install
cp config.example.json config.json  # edit with your API keys
npm start
```

## Configuration

Edit `config.json` with your:
- Groq API key
- MongoDB connection string

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Send a message |
| `/memory` | GET/POST | Manage memory |
| `/skills` | GET | List active skills |

## Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## License

MIT &mdash; see [LICENSE](LICENSE).
