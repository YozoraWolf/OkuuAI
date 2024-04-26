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
```
# The url of your .gguf file, to be downloaded
MODEL_URL=MODEL_URL=https://huggingface.co/MaziyarPanahi/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q6_K.gguf?download=true
# The path where you want the .gguf file to be saved in, make sure it exists!
MODEL_PATH=/usr/share/ollama/.ollama/models/mymodelfolder
```

You will need to provide adequate permissions to that folder so that ollama can access it.

To install the dependencies, run the following command:

```
npm install
```

The program will automatically download and install necessary models.

You will also need a `system.json` to provide a custom System prompt for ollama to use. You can make on on the root dir of the project and use this as template:

```
{
    "system": "You are an amazing AI assitant."
}
```

Then just run it using:

```
nodemon
```