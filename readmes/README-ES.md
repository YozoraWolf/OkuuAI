# ☢️ OkuuAI ☢️

[🇺🇸 English](../README.md) | [🇯🇵 日本語](README-JP.md) | [🇫🇷 Français](README-FR.md) | [🇲🇽 Español](README-ES.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

OkuuAI es un proyecto construido utilizando la tecnología LLM (Large Language Model). Su objetivo es proporcionar capacidades avanzadas de IA para asistir en múltiples tareas, incluyendo chat, programación, proporcionar contexto utilizando visión (próximamente) ¡y más!

OkuuAI se ejecuta localmente utilizando su CPU + GPU, proporcionando privacidad total.

### ¡Ahora también funciona en Windows! 🆕 🎉

## 📝 Dependencias

- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docs.docker.com/get-docker/)

### 🚀 Instalación utilizando Docker

Docker es opcional, pero se recomienda para ejecutar Redis localmente.

Para instalar las dependencias del proyecto, ejecute:

```
npm install
```

Copie el archivo de entorno de ejemplo y edítelo:

```
cp .env.example .env
```

Como mínimo, configure `API_KEY`, `JWT_SECRET`, `REDIS_PWD`, `LLM_PROVIDER`, `LLM_BASE_URL` y `LLM_MODEL`.

OkuuAI no descarga modelos automáticamente. Los modelos son administrados por el backend de inferencia que elija.

Para un endpoint compatible con OpenAI, como `llama.cpp`, LM Studio, vLLM u OpenRouter:

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_MODEL=local-model
```

Para Ollama:

```bash
LLM_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434
LLM_MODEL=llama3
```

Inicie Redis con Docker:

```bash
docker compose up -d redis
```

Ollama es opcional en Docker Compose:

```bash
docker compose --profile local-llm up -d
```

Luego ejecute el backend:

```
npm start
```

o

```
./start [--tunnel]
```

El flag `--tunnel` es opcional y se utiliza para iniciar el túnel Ngrok para acceso remoto.

Para desarrollo local con Redis, backend, frontend y un endpoint `llama.cpp` local:

```bash
npm run dev
```

La memoria semántica está desactivada por defecto para no requerir un modelo de embeddings separado:

```bash
EMBEDDING_PROVIDER=none
```

Para usar un servidor de embeddings compatible con OpenAI, por ejemplo `llama.cpp --embedding`:

```bash
EMBEDDING_PROVIDER=openai-compatible
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024
```

### Plantilla de archivo .env
```python

# Principal
API_KEY=123456 # Clave API para el asistente, asegúrese de usar algo diferente a esto. Es solo un marcador de posición.
PORT=3009 # Puerto para ejecutar el servidor
SRV_URL=http://localhost # Lista blanca probablemente? WIP.

# Redis
REDIS_HOST=127.0.0.1 # Host de Redis cuando el backend se ejecuta fuera de Docker
REDIS_PORT=6009 # Puerto para el servidor Redis
REDIS_PWD=admin1234 # Contraseña para el servidor Redis. (Cambie esto)
# REDIS_URL=redis://default:admin1234@127.0.0.1:6009/0 # URL completa opcional de Redis

# Inferencia LLM
LLM_PROVIDER=openai-compatible # openai-compatible u ollama
LLM_BASE_URL=http://127.0.0.1:8080/v1 # Endpoint compatible con llama.cpp/LM Studio/vLLM/OpenRouter
LLM_MODEL=local-model # Nombre del modelo enviado al endpoint de inferencia
LLM_TOOL_MODEL=local-model # Modelo opcional separado para prompts de selección de herramientas
LLM_API_KEY= # Token bearer opcional para proveedores remotos compatibles con OpenAI

# Embeddings / memoria semántica
EMBEDDING_PROVIDER=none # none, openai-compatible u ollama. none evita requerir un modelo local de embeddings.
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1 # Endpoint de embeddings compatible con OpenAI
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024 # Qwen3-Embedding-0.6B y bge-m3 usan 1024 dimensiones. nomic-embed-text usa 768.
EMBEDDING_API_KEY= # Token bearer opcional para proveedores remotos de embeddings

# Ollama (opcional)
OLLAMA_HOST=http://127.0.0.1:7009 # Usado solo con LLM_PROVIDER=ollama o EMBEDDING_PROVIDER=ollama
OLLAMA_PORT=7009 # Puerto para el servidor Ollama
OLLAMA_DEFAULT_MODEL=llama3 # Modelo predeterminado para Ollama si no se especifica ninguno durante la configuración

# Red (Opcional - Para acceso remoto)
WEB_URL=http://nginxproxymanager.com # URL web para la interfaz del administrador de proxy nginx
PROXY_URL= # Si se especifica, no actualizará nada en el administrador de proxy nginx y simplemente iniciará nginx con la URL de proxy existente (SE UTILIZARÁ PARA EL FRONTEND)
PROXY_EMAIL= # Correo electrónico para el administrador de proxy Nginx
PROXY_PWD= # Contraseña para el administrador de proxy Nginx (para actualizar la URL de redirección a la de Ngrok)
PROXY_FWD= # URL web para el servidor / URL de Ngrok / URL de redirección del administrador de proxy Nginx
```

# 🔌 Configuración del proxy Ngrok + Nginx Proxy Manager (Opcional)

Si desea acceder al servidor de forma remota, puede utilizar Ngrok o Nginx Proxy Manager, en caso de que no pueda abrir los puertos de su enrutador.

Para esto, instale:
- [Ngrok](https://ngrok.com/download)
- [Nginx Proxy Manager](https://nginxproxymanager.com/)

Después de instalar Ngrok y Nginx Proxy Manager, puede ejecutar el siguiente comando para iniciar el túnel Ngrok:

```npm run start-tunnel```

Esto iniciará el túnel Ngrok y actualizará la URL de redirección del administrador de proxy Nginx a la de Ngrok (a través de la API del administrador de proxy Nginx). Luego, si tiene éxito, puede acceder al servidor de forma remota.

Si `PROXY_URL` está especificado, no actualizará nada en el administrador de proxy nginx y simplemente iniciará nginx con la URL de proxy existente (SE UTILIZARÁ PARA EL FRONTEND).

# ⚙️ Configuración

Si cree que ha configurado incorrectamente su archivo .env o su archivo de asistente, siempre puede volver a ejecutar el script de configuración para restablecer todo.

```npm run config```

### settings.json

El archivo `settings.json` se utiliza para guardar la configuración actual de la aplicación, como la sesión de memoria actual, el registro y más. Edítelo si desea desactivar el registro o cambiar la sesión de memoria actual para el terminal.

# Frontend 🆕

Para ejecutar manualmente el frontend, puede utilizar los siguientes comandos:

```
cd src-site/okuu-control-center && npm run dev
```

# ⌨️ Comandos

Por ahora, OkuuAI se ejecuta en puro nodejs, por lo que he implementado algunos comandos para trabajar en tiempo de ejecución:

```
/help - Muestra esta ayuda con todos los comandos disponibles
/sessions - Lista todas las sesiones de memoria disponibles
/switch new - Crea una nueva sesión de memoria (si no hay ninguna disponible, crea una)
/switch <index> - Cambia entre sesiones de memoria según su índice
/exit - Salir de OkuuAI
```
