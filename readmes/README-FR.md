# ☢️ OkuuAI ☢️

[🇺🇸 English](../README.md) | [🇯🇵 日本語](README-JP.md) | [🇫🇷 Français](README-FR.md) | [🇲🇽 Español](README-ES.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

OkuuAI est un projet construit en utilisant la technologie LLM (Large Language Model). Il vise à fournir des capacités avancées d'IA pour assister dans de multiples tâches, y compris le chat, la programmation, la fourniture de contexte en utilisant la vision (bientôt disponible) et plus encore !

OkuuAI fonctionne localement en utilisant votre CPU + GPU, offrant une confidentialité totale.

### Fonctionne maintenant également sur Windows ! 🆕 🎉

## 📝 Dépendances

- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docs.docker.com/get-docker/)

### 🚀 Installation en utilisant Docker

Docker est optionnel, mais recommandé pour exécuter Redis localement.

Pour installer les dépendances du projet, exécutez :

```
npm install
```

Copiez le fichier d'environnement d'exemple et modifiez-le :

```
cp .env.example .env
```

Configurez au minimum `API_KEY`, `JWT_SECRET`, `REDIS_PWD`, `LLM_PROVIDER`, `LLM_BASE_URL` et `LLM_MODEL`.

OkuuAI ne télécharge pas les modèles automatiquement. Les modèles sont gérés par le backend d'inférence que vous choisissez.

Pour un endpoint compatible OpenAI, comme `llama.cpp`, LM Studio, vLLM ou OpenRouter :

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_MODEL=local-model
```

Pour Ollama :

```bash
LLM_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434
LLM_MODEL=llama3
```

Démarrez Redis avec Docker :

```bash
docker compose up -d redis
```

Ollama est optionnel dans Docker Compose :

```bash
docker compose --profile local-llm up -d
```

Ensuite, démarrez le backend :

```
npm start
```

ou

```
./start [--tunnel]
```

Le flag `--tunnel` est optionnel et est utilisé pour démarrer le tunnel Ngrok pour un accès à distance.

Pour le développement local avec Redis, backend, frontend et un endpoint `llama.cpp` local :

```bash
npm run dev
```

La mémoire sémantique est désactivée par défaut afin de ne pas nécessiter de modèle d'embeddings séparé :

```bash
EMBEDDING_PROVIDER=none
```

Pour utiliser un serveur d'embeddings compatible OpenAI, par exemple `llama.cpp --embedding` :

```bash
EMBEDDING_PROVIDER=openai-compatible
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024
```

### Modèle de fichier .env
```python

# Principal
API_KEY=123456 # Clé API pour l'assistant, assurez-vous d'utiliser autre chose que cela. C'est juste un espace réservé.
PORT=3009 # Port pour exécuter le serveur
SRV_URL=http://localhost # Liste blanche probablement ? WIP.

# Redis
REDIS_HOST=127.0.0.1 # Hôte Redis lorsque le backend s'exécute hors Docker
REDIS_PORT=6009 # Port pour le serveur Redis
REDIS_PWD=admin1234 # Mot de passe pour le serveur Redis. (Changez cela)
# REDIS_URL=redis://default:admin1234@127.0.0.1:6009/0 # URL Redis complète optionnelle

# Inférence LLM
LLM_PROVIDER=openai-compatible # openai-compatible ou ollama
LLM_BASE_URL=http://127.0.0.1:8080/v1 # Endpoint compatible llama.cpp/LM Studio/vLLM/OpenRouter
LLM_MODEL=local-model # Nom du modèle envoyé à l'endpoint d'inférence
LLM_TOOL_MODEL=local-model # Modèle optionnel séparé pour la sélection d'outils
LLM_API_KEY= # Token bearer optionnel pour les fournisseurs distants compatibles OpenAI

# Embeddings / mémoire sémantique
EMBEDDING_PROVIDER=none # none, openai-compatible ou ollama. none évite de nécessiter un modèle local d'embeddings.
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1 # Endpoint d'embeddings compatible OpenAI
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024 # Qwen3-Embedding-0.6B et bge-m3 utilisent 1024 dimensions. nomic-embed-text utilise 768.
EMBEDDING_API_KEY= # Token bearer optionnel pour les fournisseurs d'embeddings distants

# Ollama (optionnel)
OLLAMA_HOST=http://127.0.0.1:7009 # Utilisé uniquement avec LLM_PROVIDER=ollama ou EMBEDDING_PROVIDER=ollama
OLLAMA_PORT=7009 # Port pour le serveur Ollama
OLLAMA_DEFAULT_MODEL=llama3 # Modèle par défaut pour Ollama si aucun n'est spécifié lors de la configuration

# Réseau (Optionnel - Pour un accès à distance)
WEB_URL=http://nginxproxymanager.com # URL Web pour l'interface du gestionnaire de proxy nginx
PROXY_URL= # Si spécifié, il n'actualisera rien dans le gestionnaire de proxy nginx et démarrera simplement nginx avec l'URL de proxy existante (SERA UTILISÉ POUR LE FRONTEND)
PROXY_EMAIL= # Email pour le gestionnaire de proxy Nginx
PROXY_PWD= # Mot de passe pour le gestionnaire de proxy Nginx (pour mettre à jour l'URL de redirection vers celle de Ngrok)
PROXY_FWD= # URL Web pour le serveur / URL Ngrok / URL de redirection du gestionnaire de proxy Nginx
```

# 🔌 Configuration du proxy Ngrok + Nginx Proxy Manager (Optionnel)

Si vous souhaitez accéder au serveur à distance, vous pouvez utiliser Ngrok ou Nginx Proxy Manager, au cas où vous ne pourriez pas ouvrir les ports de votre routeur.

Pour cela, veuillez installer :
- [Ngrok](https://ngrok.com/download)
- [Nginx Proxy Manager](https://nginxproxymanager.com/)

Après avoir installé Ngrok et Nginx Proxy Manager, vous pouvez exécuter la commande suivante pour démarrer le tunnel Ngrok :

```npm run start-tunnel```

Cela démarrera le tunnel Ngrok et mettra à jour l'URL de redirection du gestionnaire de proxy Nginx vers celle de Ngrok (via l'API du gestionnaire de proxy Nginx). Ensuite, si cela réussit, vous pouvez accéder au serveur à distance.

Si `PROXY_URL` est spécifié, il n'actualisera rien dans le gestionnaire de proxy nginx et démarrera simplement nginx avec l'URL de proxy existante (SERA UTILISÉ POUR LE FRONTEND).

# ⚙️ Configuration

Si vous pensez avoir mal configuré votre fichier .env ou votre fichier assistant, vous pouvez toujours réexécuter le script de configuration pour tout réinitialiser.

```npm run config```

### settings.json

Le fichier `settings.json` est utilisé pour enregistrer les paramètres actuels de l'application, tels que la session de mémoire actuelle, la journalisation, etc. Modifiez-le si vous souhaitez désactiver la journalisation ou changer la session de mémoire actuelle pour le terminal.

# Frontend 🆕

Pour exécuter manuellement le frontend, vous pouvez utiliser les commandes suivantes :

```
cd src-site/okuu-control-center && npm run dev
```

# ⌨️ Commandes

Pour l'instant, OkuuAI fonctionne en pur nodejs, donc j'ai implémenté quelques commandes pour travailler dessus en temps réel :

```
/help - Affiche cette aide avec toutes les commandes disponibles
/sessions - Liste toutes les sessions de mémoire disponibles
/switch new - Crée une nouvelle session de mémoire (si aucune n'est disponible, elle en crée une)
/switch <index> - Bascule entre les sessions de mémoire en fonction de leur index
/exit - Quitter OkuuAI
```
