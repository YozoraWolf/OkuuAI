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

Assurez-vous d'avoir `docker` installé et que vous pouvez [l'exécuter sans sudo](https://docs.docker.com/engine/install/linux-postinstall/).

---

Pour installer les dépendances du projet, exécutez la commande suivante :

```
npm install
```

Avant de l'exécuter pour la première fois, veuillez exécuter le script de configuration pour définir correctement toutes les variables d'environnement. N'hésitez pas à choisir n'importe quel port, assurez-vous de bien configurer le reste pour éviter les erreurs.

```
npm run config
```

Ensuite, exécutez-le simplement en utilisant :

```
npm start
```

ou

```
./start [--tunnel]
```

Le flag `--tunnel` est optionnel et est utilisé pour démarrer le tunnel Ngrok pour un accès à distance.

Le programme téléchargera et installera automatiquement les modèles nécessaires.

### Modèle de fichier .env
```python

# Principal
API_KEY=123456 # Clé API pour l'assistant, assurez-vous d'utiliser autre chose que cela. C'est juste un espace réservé.
PORT=3009 # Port pour exécuter le serveur
SRV_URL=http://localhost # Liste blanche probablement ? WIP.

# Redis
REDIS_PORT=6009 # Port pour le serveur Redis
REDIS_PWD=admin1234 # Mot de passe pour le serveur Redis. (Changez cela)

# Ollama
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
