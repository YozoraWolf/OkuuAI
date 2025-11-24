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

## 🚀 General Setup

Follow these steps to get OkuuAI up and running:

### Step 1: Install Dependencies

Make sure you have `docker` installed and that you can [run it without sudo](https://docs.docker.com/engine/install/linux-postinstall/).

Install Node.js dependencies:

```bash
npm install
```

### Step 2: Configure Environment

**Option A: Quick Setup (Recommended)**

Copy the example environment file and edit it with your preferences:

```bash
cp .env.example .env
```

Then edit `.env` and set your required values:
- `API_KEY` - Set a secure API key for authentication
- `PORT` - Choose a port (default: 3009)
- `REDIS_PWD` - Set a secure Redis password
- Other optional settings (Discord, Tavily, Ngrok, etc.)

**Option B: Interactive Configuration**

Run the interactive config script to set up your environment:

```bash
npm run config
```

This will guide you through setting up all required environment variables.

### Step 3: Start the Backend

Start the OkuuAI backend server:

```bash
npm start
```

Or with Ngrok tunnel for remote access:

```bash
./start --tunnel
```

The program will automatically download and install necessary models on first run.

### Step 4: Start the Frontend (Optional)

To run the web interface:

```bash
cd src-site/okuu-control-center && npm run dev
```

The frontend will be available at `http://localhost:5173` (or the port shown in the terminal).

### Step 5: Enable Integrations (Optional)

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
REDIS_PORT=6009 # Port for the Redis server
REDIS_PWD=admin1234 # Password for the Redis server. (Change this)

# Ollama
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