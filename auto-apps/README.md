# ひまつぶし自動アプリ生成

テンプレート方式で、1日1本のミニゲームを自動生成し、Netlify に公開してひまつぶしルーム（Firestore）へ登録します。

## できること

- `prompts/queue.json` の pending を1件処理
- `templates/*` に設定を流し込んで `apps/{slug}/` を生成
- GitHub Actions が毎日 10:00 JST に実行
- 公開URL確認後、Firebase Admin SDK でルームへ登録
- 失敗時は GitHub Issue を自動作成

## ディレクトリ

```text
auto-apps/
├── apps/                 生成された公開アプリ
├── prompts/
│   ├── queue.json        作成キュー
│   └── done/             生成記録
├── templates/
│   ├── memory/           神経衰弱
│   ├── quiz/             クイズ
│   ├── clicker/          タップ
│   ├── reaction/         反応速度
│   └── sort/             並べ替え
├── scripts/              生成・登録スクリプト
├── index.html            ホストトップ
└── netlify.toml
```

## 初回セットアップ

### 1. Netlify（apps ホスト）

1. このリポジトリ（`himatsubushi-room`）を Netlify に **別サイト** として追加するか、Publish directory を `auto-apps` にしたサイトを作る
2. Publish directory: `auto-apps`
3. Build command: 空でOK（`netlify.toml` に echo あり）
4. 独自ドメイン `apps.himatsubushiroom.com` を追加
5. Netlify DNS に CNAME（または同アカウントならUI案内どおり）を設定

公開後のURL例:

```text
https://apps.himatsubushiroom.com/apps/フルーツ神経衰弱のslug/
```

### 2. Firebase サービスアカウント

1. Firebase Console → プロジェクト設定 → サービスアカウント
2. 新しい秘密鍵を生成（JSON）
3. GitHub リポジトリ → Settings → Secrets and variables → Actions

Secrets:

| Name | 内容 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | サービスアカウントJSONの全文 |
| `FIREBASE_PROJECT_ID` | 例: `himatubusi-7cb7d` |

任意 Variables:

| Name | 内容 |
|---|---|
| `APPS_BASE_URL` | 例: `https://apps.himatsubushiroom.com` |

### 3. 依存関係

```bash
cd auto-apps
npm install
```

## ローカル実行

```bash
cd auto-apps
npm run validate-queue
npm run generate
```

登録だけ試す場合（公開URLが既にある前提）:

```bash
# Windows PowerShell 例
$env:FIREBASE_PROJECT_ID="himatubusi-7cb7d"
$env:GOOGLE_APPLICATION_CREDENTIALS=".\service-account.json"
$env:APPS_BASE_URL="https://apps.himatsubushiroom.com"
$env:SKIP_PUBLISH_WAIT="1"
$env:DAILY_MODE="register"
node scripts/run-daily.mjs
```

## GitHub Actions

ワークフロー: [`.github/workflows/daily-auto-apps.yml`](../.github/workflows/daily-auto-apps.yml)

- 毎日 01:00 UTC（日本時間 10:00）
- 手動実行: Actions → Daily auto app → Run workflow

処理順:

1. queue 検証
2. 1件生成（`status: generated`）
3. commit & push → Netlify 自動デプロイ
4. URL疎通待ち
5. Firestore 登録（`status: done`）
6. queue 更新を commit

## プロンプトの書き方

`prompts/queue.json` に追加:

```json
{
  "id": "2026-09-10-memory-xxx",
  "status": "pending",
  "template": "memory",
  "name": "アプリ名",
  "description": "説明文",
  "tags": ["パズル"],
  "config": { "pairs": 8, "theme": "fruits" }
}
```

### テンプレ別 config

- **memory**: `pairs` (4-10), `theme` (`fruits|animals|sweets|space|default`)
- **quiz**: `topic` (`japan|animals|food|truefalse`) または `questions` 配列, `count`
- **clicker**: `durationSec`, `buttonLabel`, `goal`
- **reaction**: `minDelayMs`, `maxDelayMs`
- **sort**: `preset` (`numbers|week|rainbow|size|steps`) または `items`, `count`

## 運用

- 週1で [管理画面](https://himatsubushiroom.com/admin.html) を点検し、不要アプリを削除
- pending が尽きたら queue に追加
- 失敗時は Issue と `status: failed` を確認し、必要なら `pending` に戻して再実行

## コスト目安

テンプレ方式のため LLM 課金なし。GitHub Actions / Netlify 無料枠内なら **月0〜500円程度** が目安です。

## 注意

- 自動量産しすぎると内容が似てSEO的に不利になることがあります。まずは1日1本を維持してください。
- `service-account.json` は絶対に commit しないでください。
