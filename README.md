# 天気予報アプリ

OpenWeatherMap APIと連携した天気予報Webアプリです。都市名(または現在地)を指定すると、5日間の天気予報をカレンダー形式で確認できます。

## 機能

- 都市名検索、または現在地(ブラウザの位置情報)による天気取得
- 選択した日の気温(最高/最低)・天気・湿度・降水確率を表示
- 5日分の日付を選んで予報を切り替えられるカレンダーUI
- 3時間ごとの詳細な気温推移
- APIキーはサーバー側の環境変数のみで管理し、クライアントに露出しない

## セットアップ

1. 依存パッケージをインストール

   ```bash
   npm install
   ```

2. プロジェクト直下に `.env.local` を作成し、OpenWeatherMapのAPIキーを設定

   ```
   OPENWEATHER_API_KEY=あなたのAPIキー
   ```

   (`.env.local.example` をコピーして書き換えてもOKです)

3. 開発サーバーを起動

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) を開いて確認してください。

## 技術構成

- Next.js (App Router) / React
- Tailwind CSS
- `app/api/weather/route.js`: OpenWeatherMapのGeocoding API・5日間/3時間ごと予報APIをサーバー側で呼び出すAPIルート(APIキーはここでのみ使用)
- `lib/forecast.js`: 3時間ごとの予報データを日付ごとに集計するロジック

## Vercelへのデプロイ

1. GitHubにこのリポジトリをpush
2. [Vercel](https://vercel.com) でリポジトリをインポート
3. Vercelの Project Settings → Environment Variables に `OPENWEATHER_API_KEY` を設定(値はOpenWeatherMapのAPIキー)
4. Deploy

`.env.local` はGit管理対象外(`.gitignore`で除外)のため、必ずVercel側の環境変数として設定してください。
