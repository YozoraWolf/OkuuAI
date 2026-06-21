# ☢️ OkuuAI ☢️

[🇺🇸 English](../README.md) | [🇯🇵 日本語](README-JP.md) | [🇫🇷 Français](README-FR.md) | [🇲🇽 Español](README-ES.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

OkuuAIは、LLM（Large Language Model）技術を使用して構築されたプロジェクトです。チャット、プログラミング、ビジョンを使用したコンテキスト提供（近日公開）など、複数のタスクを支援するための高度なAI機能を提供することを目的としています！

OkuuAIは、CPU + GPUを使用してローカルで実行され、完全なプライバシーを提供します。

### Windowsでも動作可能！ 🆕 🎉

## 📝 依存関係

- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docs.docker.com/get-docker/)

### 🚀 Dockerを使用したインストール

Dockerは任意ですが、ローカルでRedisを実行する場合は推奨です。

プロジェクトの依存関係をインストールするには、次のコマンドを実行します：

```
npm install
```

サンプルの環境ファイルをコピーして編集します：

```
cp .env.example .env
```

最低限、`API_KEY`、`JWT_SECRET`、`REDIS_PWD`、`LLM_PROVIDER`、`LLM_BASE_URL`、`LLM_MODEL`を設定してください。

OkuuAIはモデルを自動ダウンロードしません。モデルは選択した推論バックエンド側で管理します。

`llama.cpp`、LM Studio、vLLM、OpenRouterなどのOpenAI互換エンドポイントを使う場合：

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_MODEL=local-model
```

Ollamaを使う場合：

```bash
LLM_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434
LLM_MODEL=llama3
```

DockerでRedisを起動します：

```bash
docker compose up -d redis
```

Docker Compose内のOllamaは任意です：

```bash
docker compose --profile local-llm up -d
```

その後、バックエンドを起動します：

```
npm start
```

または

```
./start [--tunnel]
```

`--tunnel`フラグはオプションで、リモートアクセス用のNgrokトンネルを開始するために使用されます。

Redis、バックエンド、フロントエンド、ローカルの`llama.cpp`エンドポイントを使う開発環境：

```bash
npm run dev
```

別のembeddingモデルを必須にしないため、セマンティックメモリはデフォルトで無効です：

```bash
EMBEDDING_PROVIDER=none
```

`llama.cpp --embedding`などのOpenAI互換embeddingサーバーを使う場合：

```bash
EMBEDDING_PROVIDER=openai-compatible
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024
```

### .envファイルテンプレート
```python

# メイン
API_KEY=123456 # アシスタントのAPIキー、これはプレースホルダーです。別のものを使用してください。
PORT=3009 # サーバーが実行されるポート
SRV_URL=http://localhost # ホワイトリスト？ WIP。

# Redis
REDIS_HOST=127.0.0.1 # バックエンドをDocker外で実行する場合のRedisホスト
REDIS_PORT=6009 # Redisサーバーのポート
REDIS_PWD=admin1234 # Redisサーバーのパスワード。（これを変更してください）
# REDIS_URL=redis://default:admin1234@127.0.0.1:6009/0 # 任意の完全なRedis URL

# LLM推論
LLM_PROVIDER=openai-compatible # openai-compatible または ollama
LLM_BASE_URL=http://127.0.0.1:8080/v1 # llama.cpp/LM Studio/vLLM/OpenRouter互換エンドポイント
LLM_MODEL=local-model # 推論エンドポイントに送るモデル名
LLM_TOOL_MODEL=local-model # ツール選択プロンプト用の任意の別モデル
LLM_API_KEY= # リモートOpenAI互換プロバイダー用の任意のBearerトークン

# Embeddings / セマンティックメモリ
EMBEDDING_PROVIDER=none # none、openai-compatible、ollama。noneはローカルembeddingモデルを不要にします。
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1 # OpenAI互換embeddingエンドポイント
EMBEDDING_MODEL=qwen3-embedding-0.6b
EMBEDDING_DIM=1024 # Qwen3-Embedding-0.6Bとbge-m3は1024次元。nomic-embed-textは768次元。
EMBEDDING_API_KEY= # リモートembeddingプロバイダー用の任意のBearerトークン

# Ollama（任意）
OLLAMA_HOST=http://127.0.0.1:7009 # LLM_PROVIDER=ollama または EMBEDDING_PROVIDER=ollama の場合のみ使用
OLLAMA_PORT=7009 # Ollamaサーバーのポート
OLLAMA_DEFAULT_MODEL=llama3 # 設定中に指定されていない場合のデフォルトモデル

# ネットワーク（オプション - リモートアクセス用）
WEB_URL=http://nginxproxymanager.com # nginxプロキシマネージャーインターフェースのWeb URL
PROXY_URL= # 指定されている場合、nginxプロキシマネージャーの設定は更新されず、既存のプロキシURLでnginxが起動します（フロントエンドで使用されます）
PROXY_EMAIL= # Nginxプロキシマネージャーのメール
PROXY_PWD= # Nginxプロキシマネージャーのパスワード（NgrokのリダイレクトURLを更新するため）
PROXY_FWD= # サーバーのWeb URL / Ngrok URL / NginxプロキシマネージャーのリダイレクトホストURL
```

# 🔌 Ngrok + Nginxプロキシマネージャープロキシ設定（オプション）

サーバーにリモートでアクセスしたい場合は、NgrokまたはNginxプロキシマネージャーを使用できます。ルーターのポートを開くことができない場合に便利です。

これには以下をインストールしてください：
- [Ngrok](https://ngrok.com/download)
- [Nginxプロキシマネージャー](https://nginxproxymanager.com/)

NgrokとNginxプロキシマネージャーをインストールした後、次のコマンドを実行してNgrokトンネルを開始します：

```npm run start-tunnel```

これにより、Ngrokトンネルが開始され、NginxプロキシマネージャーのリダイレクトURLがNgrokのものに更新されます（NginxプロキシマネージャーのAPIを介して）。成功すると、リモートでサーバーにアクセスできます。

`PROXY_URL`が指定されている場合、Nginxプロキシマネージャーの設定は更新されず、既存のプロキシURLでnginxが起動します（フロントエンドで使用されます）。

# ⚙️ 設定

.envファイルやアシスタントファイルを誤って設定した場合は、configスクリプトを再実行してすべてをリセットできます。

```npm run config```

### settings.json

`settings.json`ファイルは、現在のアプリケーション設定（現在のメモリセッション、ログ記録など）を保存するために使用されます。ログ記録をオフにしたり、ターミナルの現在のメモリセッションを変更したりする場合は、編集してください。

# フロントエンド 🆕

フロントエンドを手動で実行するには、次のコマンドを使用します：

```
cd src-site/okuu-control-center && npm run dev
```

# ⌨️ コマンド

現在、OkuuAIは純粋なnodejsで動作しているため、ランタイムで作業するためのいくつかのコマンドを実装しました：

```
/help - 利用可能なすべてのコマンドを表示するヘルプ出力を表示します
/sessions - 利用可能なすべてのメモリセッションを一覧表示します
/switch new - 新しいメモリセッションを作成します（利用可能なセッションがない場合は作成します）
/switch <index> - インデックスに基づいてメモリセッションを切り替えます
/exit - OkuuAIを終了します
```
