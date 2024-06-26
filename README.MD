# ☢️ OkuuAI ☢️

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Description

OkuuAI is a project built using LLM (Language Model) technology. It aims to provide advanced AI capabilities for assisting in multiple tasks, including programming, providing context using vision and more!

OkuuAI runs locally using your CPU + GPU, providing full privacy.

Currently runs on **Linux** only.

## Dependencies

### Ollama

This project relies on Ollama for backend LLM communication services. [Please install](https://ollama.com) it before continuing.

Note: Please make sure you are running the Ollama service and that the service has permissions to access and write to the folder specified in `MODEL_PATH` (in the env file)

## Installation

You will have to create a `.env` file in the src directory to specify some required data.

### .env file template
```python
# The url of your .gguf file, to be downloaded
MODEL_URL=MODEL_URL=https://huggingface.co/MaziyarPanahi/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q6_K.gguf?download=true

# The path where you want the .gguf file to be saved in, make sure it exists!
MODEL_PATH=/usr/share/ollama/.ollama/models/mymodelfolder

# This can be any port you choose, I chose 3009 because... 
# (お空　009, nine in Japanese can be read as 'Kuu')
PORT=3009
# ChromaDB related
# Chroma credentials (set to any you want, but change this)
CHROMA_USER=username # change this, please
CHROMA_PWD=password # change this, please
CHROMA_PORT=3010 # Okuu chromadb port, set it to what you want
# Redis related
REDIS_PORT=6009 # Okuu redis port, set it to what you want
REDIS_PWD=passwd # change this, please.
```

You will need to provide adequate permissions to that folder so that ollama can access it.

---

### Docker

Make sure you have `docker` installed and that you can [run it without sudo](https://docs.docker.com/engine/install/linux-postinstall/).

---

To install the dependencies, run the following command:

```
npm install
```

Before running it for the first time, please execute the config script to set all env variables properly. Feel free to choose any port you want, other than that make sure you set the rest properly to avoid errors.

```
npm run config
```

You will also need a `system.json` to provide a custom System prompt for ollama to use. So just edit the one provided by the config script.

```
{
    "system": "You are an amazing AI assitant."
}
```

Then just run it using:

```
npm start
```

The program will automatically download and install necessary models.

# Commands

For now OkuuAI runs in pure nodejs, so I implemented some commands to work on her on runtime:

```
/help - Displays this help output with all available commands
/sessions - Lists all available memory sessions
/switch new - Creates a new memory session (if none available it will create one)
/switch <index> - Switches between memory sessions based on their index
/exit - Exit OkuuAI
```