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

Asegúrese de tener `docker` instalado y que pueda [ejecutarlo sin sudo](https://docs.docker.com/engine/install/linux-postinstall/).

---

Para instalar las dependencias del proyecto, ejecute el siguiente comando:

```
npm install
```

Antes de ejecutarlo por primera vez, ejecute el script de configuración para establecer correctamente todas las variables de entorno. Siéntase libre de elegir cualquier puerto, asegúrese de configurar el resto correctamente para evitar errores.

```
npm run config
```

Luego, simplemente ejecútelo utilizando:

```
npm start
```

o

```
./start [--tunnel]
```

El flag `--tunnel` es opcional y se utiliza para iniciar el túnel Ngrok para acceso remoto.

El programa descargará e instalará automáticamente los modelos necesarios.

### Plantilla de archivo .env
```python

# Principal
API_KEY=123456 # Clave API para el asistente, asegúrese de usar algo diferente a esto. Es solo un marcador de posición.
PORT=3009 # Puerto para ejecutar el servidor
SRV_URL=http://localhost # Lista blanca probablemente? WIP.

# Redis
REDIS_PORT=6009 # Puerto para el servidor Redis
REDIS_PWD=admin1234 # Contraseña para el servidor Redis. (Cambie esto)

# Ollama
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
