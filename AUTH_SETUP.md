# LOOT MARKET 認証セットアップ

LOOT MARKET のユーザー認証・図鑑保存は Cloudflare 内で完結させる。

## 構成

- フロント: Cloudflare Workers Static Assets
- API: Cloudflare Workers
- 商品 / ダンジョン / ユーザー / セッション / 図鑑: Cloudflare D1 (`loot-market-db`)
- 画像: Cloudflare R2 (`loot-market-assets`)
- 認証: Better Auth 1.7.2

Supabase は使用しない。

## 本番反映前に必要な設定

### 1. D1 migration

本番 D1 に次を順番に適用する。

- `0002_better_auth_core.sql`
- `0003_user_collection.sql`

`0002` は Better Auth 1.7.2 の Cloudflare D1 programmatic migration から実際に生成・検証した schema。

### 2. Worker secrets / vars

必須:

- `BETTER_AUTH_SECRET`: 十分に長いランダム secret
- `BETTER_AUTH_URL`: 本番ゲームの origin。例 `https://loot-market.example.com`

必要に応じて:

- `AUTH_TRUSTED_ORIGINS`: カンマ区切りの許可 origin
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Google の2項目が未設定なら、画面では Google ログインを自動的に隠し、メール/パスワードだけ有効にする。

## Google OAuth

Google Provider を使う場合、Google Cloud Console 側の Authorized redirect URI に次を登録する。

`<BETTER_AUTH_URL>/api/auth/callback/google`

## ゲスト → ログイン

未ログインでもゲームは遊べる。

- 発見図鑑だけ localStorage に一時保存
- 欲しい / 持ってる / あとで見るはログインを案内
- ログイン後、ゲスト発見データを `/api/me/collection/merge` でD1へ統合
- 統合成功後にゲスト localStorage を削除

## ユーザーAPI

- `GET /api/auth-check`
- `GET /api/me/collection`
- `POST /api/me/collection/merge`
- `PUT /api/me/items/:itemId`
- `GET /api/me/recommendation`

`user_id` はクライアント入力を信用せず、Worker が Better Auth のセッションから取得する。

## ローカル検証

GitHub Actions `Cloudflare Auth Integration` で以下を自動確認する。

1. 未ログインの個人APIが401
2. メール新規登録
3. Cookieセッション成立
4. 発見 / 欲しい / あとで見る保存
5. 欲しいカテゴリからおすすめダンジョン取得
6. ログアウト
7. Workers Static Assets のトップ画面配信
