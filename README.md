# MA26 Okinawa

Marketing Agenda Okinawa 2026 出張用の個人旅程PWAです。iPhone Safariで開いて「ホーム画面に追加」すると、主要な旅程、フライト、チェックリスト、メモ、手動貼り付けの参加者検索をアプリ風に使えます。

## 機能

- 5日間の概要と当日確認ポイント
- 横スクロール全体表と日別カードのスケジュール表示
- Peach往復フライト情報
- 公式リンク集
- 参加者リストの手動貼り付け、頭文字フィルタ、キーワード検索
- チェックリストと複数メモのlocalStorage保存
- manifest、iOS Safari向けmetaタグ、Service Workerによるオフラインキャッシュ

## セキュリティ

参加者一覧のBasic認証情報は、フロントエンドコード、manifest、Service Worker、localStorage、Git管理対象ファイルに保存しません。参加者一覧はブラウザで認証して表示し、必要なテキストだけをこのPWAへ手動で貼り付けてください。

## 参加者DBの取得

ローカル取得スクリプトで公式参加者ページを読み、公式ページが使っているデータAPIから参加者データを取得します。認証情報は実行時にだけ使い、保存しません。

```bash
npm run fetch:attendees
```

生成される `public/attendees.local.json` と `local-data/` は `.gitignore` 済みです。アプリを起動すると `public/attendees.local.json` があれば自動でIndexedDBに取り込みます。

## セットアップ

```bash
npm install
npm run dev
```

ビルド確認:

```bash
npm run build
```

## iPhoneでホーム画面に追加

1. GitHub PagesなどのHTTPS環境でアプリを開きます。
2. iPhone Safariでアプリを開きます。
3. 共有ボタンから「ホーム画面に追加」を選びます。
4. アプリ名は `MA26 Okinawa` として表示されます。

Service Workerは本番ビルド時に登録されます。開発サーバーでは通常のブラウザ更新を優先するため登録しません。

GitHub Pages URL:

```text
https://ambit1977.github.io/MA26/
```

公開版には `.gitignore` している `public/attendees.local.json` は含めません。参加者名簿を含むPWAを使う場合は、ローカルで `npm run fetch:attendees` を実行してから本番ビルドを配信してください。

VPS URL:

```text
https://ambit.go2020.tokyo/ma26/
```

VPS向けビルド:

```bash
npm run fetch:attendees
npm run build:vps
```
