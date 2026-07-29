# ひまつぶしルーム

インストール不要で遊べるWebアプリを紹介する、静的HTML + Firebase製のアプリ一覧サイトです。

## できること

- アプリ名・説明・タグからキーワード検索
- 複数タグによるOR絞り込み
- 投稿日時の新しい順・古い順切り替え
- 最大4枚の画像ギャラリー
- Googleログインで保護された管理画面
- アプリの追加・編集・削除
- 画像を最大1080×1920pxのWebPへ自動圧縮
- スマートフォン・タブレット・PC対応

## SEO / 公開設定

独自ドメイン: `https://himatsubushiroom.com`

- `robots.txt` … 公開ページを許可、管理ページを除外
- `sitemap.xml` … トップページを登録
- OGP / Twitter Card … SNS共有用メタタグ（`index.html`）
- `assets/favicon.svg` … ファビコン
- `assets/og-image.jpg` … SNS共有画像（1200×630）

Google Search Console で所有権確認後、サイトマップ URL として次を送信してください。

```text
https://himatsubushiroom.com/sitemap.xml
```

## 1. Firebaseプロジェクトを作る

1. [Firebase Console](https://console.firebase.google.com/) で「プロジェクトを追加」を選びます。
2. プロジェクト内の「アプリを追加」から Web（`</>`）を選び、Webアプリを登録します。
3. 表示された `firebaseConfig` の値を控えます。
4. 「Authentication」→「始める」→「ログイン方法」で Google を有効にします。
5. 「Firestore Database」→「データベースの作成」を選びます。ロケーションは利用者に近い場所を選びます。
6. 「Storage」→「始める」を選びます。Firebaseの現在の料金要件によってはBlazeプランが必要です。

## 2. サイトへFirebase設定を入れる

[`js/firebase-config.js`](js/firebase-config.js) を開き、Firebase Consoleで取得した値に置き換えます。

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};

export const adminEmail = "管理者のGoogleメールアドレス";
```

FirebaseのWeb設定値はブラウザで使う公開識別情報であり、パスワードではありません。実際のアクセス制御は次のセキュリティルールで行います。

## 3. 管理者メールとセキュリティルールを設定する

以下3ファイルの `your-google-account@example.com` を、同じ管理者Googleメールへ変更してください。大文字・小文字も正確に合わせます。

- `js/firebase-config.js`
- `firestore.rules`
- `storage.rules`

### Firebase CLIで反映する方法

[Node.js](https://nodejs.org/) をインストール後、このフォルダーで実行します。

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,storage
```

またはFirebase ConsoleのFirestore Database「ルール」とStorage「Rules」へ、それぞれのルールファイル内容を貼り付けて公開できます。

セキュリティルールを公開するまで、管理画面からの登録は成功しません。

## 4. ローカルで確認する

JavaScript Modulesを使うため、HTMLファイルを直接ダブルクリックせずローカルサーバーで開きます。

Pythonがある場合:

```bash
python -m http.server 8888
```

ブラウザで次を開きます。

- 公開ページ: `http://localhost:8888/`
- 管理ページ: `http://localhost:8888/admin.html`

Googleログインでエラーになる場合は、Firebase Consoleの Authentication → Settings → Authorized domains に `localhost` があることを確認してください。

## 5. Netlifyへ公開する

### Git連携

1. このフォルダーをGitHubなどのリポジトリへpushします。
2. Netlifyで「Add new site」→「Import an existing project」を選びます。
3. Build commandは空欄、Publish directoryは `.` を指定してデプロイします。

### 手動デプロイ

NetlifyのSites画面へ、このプロジェクトフォルダーをドラッグ＆ドロップします。

デプロイ後、Firebase Consoleの Authentication → Settings → Authorized domains に、発行された `xxxxx.netlify.app` を追加してください。独自ドメインを使う場合は、そのドメインも追加します。

## 管理画面の使い方

1. `/admin.html` を開き、設定した管理者Googleアカウントでログインします。
2. アプリ名、説明、URL、1個以上のタグを入力します。
3. 必要ならスマートフォン画面の画像を最大4枚選びます。
4. 「アプリを登録」を押すと公開一覧へ反映されます。
5. 右側の登録済みアプリから編集・削除できます。

タグは自由入力です。過去に使ったタグは候補として表示されます。表記の揺れを避けるため、同じ意味のタグは同じ名前を選ぶことをおすすめします。

## データ構造

Firestoreの `apps` コレクションへ次の形式で保存します。

```text
apps/{appId}
  name: string
  description: string
  url: string
  tags: string[]
  images: { url: string, path: string }[]
  searchText: string
  createdAt: timestamp
  updatedAt: timestamp
```

画像本体はFirebase Storageの `apps/{appId}/{imageId}.webp` に保存します。

## 主なファイル

```text
.
├── index.html                 公開アプリ一覧
├── admin.html                 管理画面
├── css/styles.css             全画面のスタイル
├── js/app.js                  検索・絞り込み・一覧・詳細
├── js/admin.js                認証・CRUD・画像処理
├── js/firebase.js             Firebase共通処理
├── js/firebase-config.js      Firebase設定
├── firestore.rules            Firestoreアクセス制御
├── storage.rules              Storageアクセス制御
├── firebase.json              Firebase CLI設定
└── netlify.toml               Netlify設定
```

## トラブルシューティング

- 「Firebaseの初期設定をしてください」: `js/firebase-config.js` にプレースホルダーが残っています。
- `auth/unauthorized-domain`: Firebase AuthenticationのAuthorized domainsへNetlifyドメインを追加します。
- `Missing or insufficient permissions`: 管理者メールが3ファイルで一致しているか、ルールをデプロイ済みか確認します。
- 画像だけ保存できない: Storageを有効化したか、Storageルールをデプロイしたか、料金プラン要件を確認します。
- 一覧が読み込めない: Firestoreを作成済みか、ブラウザの開発者ツールに表示されたエラーを確認します。
