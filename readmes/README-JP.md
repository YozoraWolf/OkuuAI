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

`docker`がインストールされており、[sudoなしで実行できる](https://docs.docker.com/engine/install/linux-postinstall/)ことを確認してください。

---

プロジェクトの依存関係をインストールするには、次のコマンドを実行します：

```
npm install
```

初めて実行する前に、すべての環境変数を適切に設定するためにconfigスクリプトを実行してください。エラーを避けるために、他のポートを選択することをお勧めします。

```
npm run config
```

その後、次のコマンドで実行します：

```
npm start
```

または

```
./start [--tunnel]
```

`--tunnel`フラグはオプションで、リモートアクセス用のNgrokトンネルを開始するために使用されます。

プログラムは必要なモデルを自動的にダウンロードしてインストールします。

### .envファイルテンプレート
```python

# メイン
API_KEY=123456 # アシスタントのAPIキー、これはプレースホルダーです。別のものを使用してください。
PORT=3009 # サーバーが実行されるポート
SRV_URL=http://localhost # ホワイトリスト？ WIP。

# Redis
REDIS_PORT=6009 # Redisサーバーのポート
REDIS_PWD=admin1234 # Redisサーバーのパスワード。（これを変更してください）

# Ollama
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
