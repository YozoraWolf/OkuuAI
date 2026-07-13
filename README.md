# ☢️ OkuuAI ☢️

[🇺🇸 English](README.md) | [🇯🇵 日本語](readmes/README-JP.md) | [🇫🇷 Français](readmes/README-FR.md) | [🇲🇽 Español](readmes/README-ES.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

OkuuAI is a project built using LLM (Large Language Model) technology. It aims to provide advanced AI capabilities for assisting in multiple tasks, including plain chatting, programming, providing context using vision (coming soon) and more!

OkuuAI runs locally using your CPU + GPU, providing full privacy.

### Now works on Windows as well! 🆕 🎉

## 📝 Dependencies

- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docs.docker.com/get-docker/)

---

## 🚀 Quick Start

OkuuAI connects to an inference server; it does not download or run a model itself. Start your OpenAI-compatible LLM at `http://127.0.0.1:8080/v1`, then choose one runtime:

### Host Development

```bash
cp .env.example .env
npm run setup
npm run dev
```

`npm run dev` starts Redis, the backend, and the frontend together. Open `http://localhost:9000` locally or use the server's private-network hostname from another device.

### Docker Application Stack

```bash
cp .env.example .env
docker compose --profile app up --build -d
```

The frontend is available at `http://localhost:9000` and proxies API and WebSocket traffic to the backend. Stop the host-based `npm run dev` stack first, or set `FRONTEND_PORT` to use a different port.

### Private-Network HTTPS

Browser screen capture requires a trusted HTTPS origin. OkuuAI includes an optional TLS proxy backed by a private certificate authority for private DNS, LAN, Meshnet, Tailscale, and similar VPN networks. It does not expose OkuuAI to the public internet.

Generate a certificate for the hostname used to reach the server. Including its private IP is optional but allows access by either name or address:

```bash
./scripts/setup-private-https.sh okuu.home.arpa 100.64.0.10
```

The generated files are stored under the ignored `storage/private-https/` directory. Keep `ca.key` and `server.key` private. Install only `storage/private-https/ca.crt` as a trusted root certificate on each personal client device:

Linux (Debian/Ubuntu):

```bash
sudo cp ca.crt /usr/local/share/ca-certificates/okuuai-meshnet.crt
sudo update-ca-certificates
```

macOS:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ca.crt
```

Windows (Administrator PowerShell):

```powershell
certutil -addstore -f Root ca.crt
```

Restart the browser after trusting the CA, then start the HTTPS profile:

Docker application stack:

```bash
docker compose --profile app --profile private-https up --build -d
```

Host development with `npm run dev`:

```bash
docker compose --profile private-https-dev up -d private-https-dev
npm run dev
```

The development profile uses host networking so the proxy can reach Quasar without opening the Docker bridge in the host firewall. Do not run `private-https` and `private-https-dev` simultaneously because they use the same HTTPS port.

Open `https://okuu.home.arpa:9443`, replacing the example with the hostname used when generating the certificate. Set `PRIVATE_HTTPS_PORT=443` in `.env` if port 443 is available and you prefer a URL without an explicit port. The original HTTP endpoint remains available unless disabled separately.

Docker containers cannot reach a host LLM through `127.0.0.1`; the Compose profile uses `http://host.docker.internal:8080/v1`. Override that endpoint for another host or machine with `DOCKER_LLM_BASE_URL`:

```bash
DOCKER_LLM_BASE_URL=http://192.168.1.10:8080/v1 docker compose --profile app up --build -d
```

## Detailed Setup

At minimum, set these in `.env` before starting OkuuAI:

- `API_KEY` - Set a secure API key for authentication
- `JWT_SECRET` - Set a secure JWT secret
- `REDIS_PWD` - Set a secure Redis password
- `LLM_PROVIDER`, `LLM_BASE_URL`, and `LLM_MODEL` - Point OkuuAI at your inference server

OkuuAI supports OpenAI-compatible endpoints such as `llama.cpp`, LM Studio, vLLM, and OpenRouter. For Ollama, set `LLM_PROVIDER=ollama`, `OLLAMA_HOST=http://127.0.0.1:11434`, and `LLM_MODEL=llama3`.

To run Ollama with Compose instead of a separate host process:

```bash
docker compose --profile local-llm up -d
```

For separate service control, use `docker compose up -d redis`, `npm run dev:backend`, and `npm run dev:frontend`.

### Semantic Memory

Semantic memory is disabled by default so users do not need a separate embedding model:

```bash
EMBEDDING_PROVIDER=none
```

To enable semantic memory later, configure a separate embedding backend and model. Chat models are usually not good embedding models, so a dedicated embedding model is recommended.

For a local `llama.cpp` Qwen3 embedding sidecar:

```bash
EMBEDDING_PROVIDER=openai-compatible
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024
```

### Enable Integrations (Optional)

After basic setup, you can enable optional integrations:
- **Discord Bot** - See [Discord Integration](#discord-bot-) section below
- **Tavily Search** - See [Tavily Search](#tavily-search-) section below
- **Ngrok Proxy** - See [Ngrok Setup](#-ngrok--nginx-proxy-manager-proxy-setup-optional) section below

---

## 📋 Environment Variables Reference

### .env file template
```python

# Main
API_KEY=123456 # API Key for the assistant, make sure to use something other than this. It's just a placeholder.
PORT=3009 # Port for the server to run on
SRV_URL=http://localhost # Whitelist probably? WIP.

# Redis
REDIS_HOST=127.0.0.1 # Host for Redis when the backend runs outside Docker
REDIS_PORT=6009 # Port for the Redis server
REDIS_PWD=admin1234 # Password for the Redis server. (Change this)
# REDIS_URL=redis://default:admin1234@127.0.0.1:6009/0 # Optional full Redis URL override

# LLM inference
LLM_PROVIDER=openai-compatible # openai-compatible or ollama
LLM_BASE_URL=http://127.0.0.1:8080/v1 # llama.cpp/LM Studio/vLLM/OpenRouter-compatible endpoint
LLM_MODEL=local-model # Model name sent to the configured inference endpoint
LLM_TOOL_MODEL=local-model # Optional separate model for tool-selection prompts
LLM_API_KEY= # Optional bearer token for remote OpenAI-compatible providers

# Embeddings / semantic memory
EMBEDDING_PROVIDER=none # none, openai-compatible, or ollama. none avoids requiring a local embedding model.
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1 # OpenAI-compatible embedding endpoint, for example llama.cpp --embedding
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024 # Qwen3-Embedding-0.6B and bge-m3 use 1024 dimensions. nomic-embed-text uses 768.
EMBEDDING_API_KEY= # Optional bearer token for remote embedding providers

# Ollama (optional)
OLLAMA_HOST=http://127.0.0.1:7009 # Used only when LLM_PROVIDER=ollama or EMBEDDING_PROVIDER=ollama
OLLAMA_PORT=7009 # Port for the Ollama server
OLLAMA_DEFAULT_MODEL=llama3 # Default model for Ollama if none is specified during config

# Network (Optional - For remote access)
WEB_URL=http://nginxproxymanager.com # Web URL for the nginx proxy manager interface
PROXY_URL= # If specified, it won't update anything in the nginx proxy manager and just start nginx with the existing proxy URL (WILL BE USED FOR FRONTEND)
PROXY_EMAIL= # Email for the Nginx Proxy Manager
PROXY_PWD= # Password for the Nginx Proxy Manager (to update the redirect URL to the Ngrok one)
PROXY_FWD= # Web URL for the server / Ngrok URL / Nginx Proxy Manager Redirect Host URL

# Discord Integration (Optional)
DISCORD_TOKEN= # Your Discord bot token

# Tavily Search (Optional)
TAVILY_API_KEY= # Your Tavily API key for AI-powered web search
```

> 💡 **Tip**: Copy `.env.example` to `.env` and fill in your values, or use `npm run config` to set up your environment interactively.

# 🔌 Ngrok + Nginx Proxy Manager Proxy Setup (Optional)

If you want to access the server remotely, you can use Ngrok or Nginx Proxy Manager, in case you cannot open ports on your router.

For this please install:
- [Ngrok](https://ngrok.com/download)
- [Nginx Proxy Manager](https://nginxproxymanager.com/)

After installing Ngrok and Nginx Proxy Manager, you can run the following command to start the Ngrok tunnel:

```npm run start-tunnel```

This will start the Ngrok tunnel and update the Nginx Proxy Manager redirect URL to the Ngrok one (via the Nginx Proxy Manager's API). Then if successful you can access the server remotely.

# ⚙️ Config

If you feel you messed up your env file or assitant file, you can always rerun the config script to reset everything.

```npm run config```

### settings.json

The `settings.json` file is used to save current application settings, such as the current memory session, logging, and more. Edit if you want to turn off logging or change the current memory session for terminal.

# 🔗 Integrations

OkuuAI supports several optional integrations to extend its functionality.

---

## Discord Bot 🤖

Interact with Okuu through Discord! The Discord integration supports direct messages, server mentions, and rich embeds.

### Features

- **Message Queue System**: Handles multiple concurrent Discord messages with configurable limits (default: 3 concurrent requests)
- **DM & Mention Support**: Responds to direct messages and mentions in server channels
- **Username Awareness**: Properly recognizes Discord usernames and display names
- **Rich Embeds**: Automatically creates embeds for image results from:
  - **Danbooru searches**: Color-coded by rating (Safe/Questionable/Explicit) with artist and character information
  - **Generic web search images**: Displays images from Tavily search results
- **Session Persistence**: Maintains separate conversation contexts per Discord channel

### Setup

#### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Navigate to the "Bot" section and click "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - Message Content Intent
   - Server Members Intent (optional, but recommended)
5. Copy the bot token

#### 2. Configure Environment

Add your Discord bot token to your `.env` file:

```bash
DISCORD_TOKEN=your_discord_bot_token_here
```

#### 3. Invite the Bot

1. In the Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: Read Messages, Send Messages, Embed Links, Attach Files, Read Message History
4. Copy the generated URL and open it to invite the bot to your server

#### 4. Start OkuuAI

```bash
npm start
```

The Discord bot will automatically initialize if `DISCORD_TOKEN` is present.

### Usage

**In Server Channels** - Mention the bot:
```
@OkuuBot Hello! How are you?
```

**In Direct Messages** - Simply send a message:
```
What's the weather like today?
```

**Image Searches** - Images display as rich embeds:
```
@OkuuBot find some touhou art
```

### Troubleshooting

- **Bot doesn't respond**: Verify `DISCORD_TOKEN` is set, bot has channel permissions, and "Message Content Intent" is enabled
- **Images not showing**: Check "Embed Links" permission and verify image URLs are accessible
- **Bot appears offline**: Confirm OkuuAI server is running and network allows WebSocket connections

---

## Tavily Search 🔍

Enhanced web search powered by AI! [Tavily](https://tavily.com/) provides accurate, real-time search results optimized for LLMs.

### Features

- **AI-Generated Answers**: Direct answers to queries, reducing manual summarization
- **Structured Results**: Organized search results with titles, URLs, and content snippets
- **Image Search**: Retrieves relevant images for visual queries
- **Fallback to DuckDuckGo**: Automatically falls back if Tavily is unavailable
- **LLM Optimized**: Better context and relevance compared to traditional search engines

### Setup

#### 1. Get a Tavily API Key

This is optional, but recommended for better search results.

1. Visit [Tavily](https://tavily.com/) and sign up
2. Navigate to your dashboard and generate an API key
3. Copy the API key

> **Note**: Tavily offers a free tier with 1,000 searches per month.

#### 2. Configure Environment

Add your Tavily API key to your `.env` file:

```bash
TAVILY_API_KEY=your_tavily_api_key_here
```

#### 3. Start OkuuAI

```bash
npm start
```

OkuuAI will automatically use Tavily for web searches.

### Usage

**Web Search**:
```
What's the latest news about AI?
```

**Image Search**:
```
Show me pictures of cherry blossoms
```

### How It Works

1. Query sent to Tavily API
2. Tavily's AI generates a direct answer (when possible)
3. Returns top results with titles, URLs, and content
4. Includes relevant images if requested
5. Falls back to DuckDuckGo if Tavily fails

### Comparison: Tavily vs DuckDuckGo

| Feature | Tavily | DuckDuckGo |
|---------|--------|------------|
| **AI Answers** | ✅ Yes | ❌ No |
| **API Key Required** | ✅ Yes | ❌ No |
| **Image Search** | ✅ Yes | ⚠️ Limited |
| **Rate Limits** | ✅ Generous free tier | ✅ No limits |
| **LLM Optimized** | ✅ Yes | ❌ No |
| **Cost** | 💰 Free tier available | 🆓 Free |

### Troubleshooting

- **Searches use DuckDuckGo**: Verify `TAVILY_API_KEY` is set and valid in your [Tavily dashboard](https://tavily.com/dashboard)
- **Rate Limits (429 error)**: Check usage on dashboard or upgrade plan; will auto-fallback to DuckDuckGo
- **Poor results**: Use more specific queries or consider Danbooru search for anime/manga content

### Disabling Tavily

Remove or comment out `TAVILY_API_KEY` from `.env` to use only DuckDuckGo.

# ⌨️ Commands

For now OkuuAI runs in pure nodejs, so I implemented some commands to work on her on runtime:

```
/help - Displays this help output with all available commands
/sessions - Lists all available memory sessions
/switch new - Creates a new memory session (if none available it will create one)
/switch <index> - Switches between memory sessions based on their index
/exit - Exit OkuuAI
```
