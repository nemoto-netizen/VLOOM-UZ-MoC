# AI分析レポート作成・チャット MoC

Vercel 用のモック画面です。指定の vloom 系 CSS をベースに、2 カラム＋ヘッダー構成の UI を実装しています。

## GitHub への push

1. [GitHub](https://github.com/new) で新しいリポジトリを作成（README や .gitignore は追加しない）
2. 以下を実行（`USERNAME` / `REPO` は自分のユーザー名とリポジトリ名に置き換え）:

```bash
cd "c:\Users\nemoto\Desktop\cursorテスト"
git remote add origin https://github.com/USERNAME/REPO.git
git branch -M main
git push -u origin main
```

Git のユーザー名・メールが未設定の場合は、先に設定してください:

```bash
git config --global user.name "あなたの名前"
git config --global user.email "your_email@example.com"
```

## セットアップ

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## ビルド

```bash
npm run build
```

静的 export で `out/` に出力されます。

## Vercel へのデプロイ

1. [Vercel](https://vercel.com) にプロジェクトをインポート（Git 連携または `vercel` CLI）
2. ビルドコマンド: `npm run build`（既定）
3. デプロイ後、本番 URL で MoC 画面が表示されます

CLI の場合:

```bash
npm i -g vercel
vercel
```

## 画面構成

- **ヘッダー**: レポート名（緑バー）、検索条件名、作成日・作成者
- **左カラム**: チャット履歴エリア、分析ショートカット（5 種）、プロンプト入力、登録/保存・分析開始ボタン
- **右カラム**: 出力表示エリア（再生成・コピー）、結果を削除・保存・エクスポートボタン

スタイルは `https://prd-001-mng.vloom.jp/css/` の common.css / home.css 等を CDN で参照しています。本番で CORS 等により読めない場合は、同じ CSS を `public/css/` に配置し、`app/layout.tsx` のリンクを `/css/xxx.css` に変更してください。
