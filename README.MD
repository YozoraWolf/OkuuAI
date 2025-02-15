# ☢️ OkuuAI ☢️

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

OkuuAI is a project built using LLM (Language Model) technology. It aims to provide advanced AI capabilities for assisting in multiple tasks, including programming, providing context using vision and more!

OkuuAI runs locally using your CPU + GPU, providing full privacy.

Currently runs on **Linux** only.

## 📝 Dependencies

- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docs.docker.com/get-docker/)

### 🚀 Installation using Docker

Make sure you have `docker` installed and that you can [run it without sudo](https://docs.docker.com/engine/install/linux-postinstall/).

---

To install the project dependencies, run the following command:

```
npm install
```

Before running it for the first time, please execute the config script to set all env variables properly. Feel free to choose any port you want, other than that make sure you set the rest properly to avoid errors.

```
npm run config
```

Then just run it using:

```
npm start
```

or

```
./start [--tunnel]
```

The `--tunnel` flag is optional and is used to start the Ngrok tunnel for remote access.

The program will automatically download and install necessary models.

### .env file template
```python

# Main
API_KEY=123456 # API Key for the assitant, make sure to use something other than this. It's just a placeholder.
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
PROXY_EMAIL= # Email for the Nginx Proxy Manager
PROXY_PWD= # Password for the Nginx Proxy Manager (to update the redirect URL to the Ngrok one)
PROXY_FWD= # Web URL for the server / Ngrok URL / Nginx Proxy Manager Redirect Host URL
```

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

# Frontend 🆕

To manually run the frontend, you can use the following commands:

```
cd src-site/okuu-control-center && npm run dev
```

# ⌨️ Commands

For now OkuuAI runs in pure nodejs, so I implemented some commands to work on her on runtime:

```
/help - Displays this help output with all available commands
/sessions - Lists all available memory sessions
/switch new - Creates a new memory session (if none available it will create one)
/switch <index> - Switches between memory sessions based on their index
/exit - Exit OkuuAI
```