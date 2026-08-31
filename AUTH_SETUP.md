# LOOT MARKET 認証セットアップ

## 構成

- 商品・敵・ボス・ダンジョン: 既存 Cloudflare D1
- 商品画像: 既存 Cloudflare R2
- ログイン: Supabase Auth
- ユーザー図鑑: Supabase Postgres `public.user_item_states`
- 未ログイン: ゲームは通常プレイ可能。発見図鑑だけ localStorage に一時保存
- ログイン時: ゲスト発見データを Supabase に自動マージ

## Supabase 側

1. LOOT MARKET 専用 Supabase プロジェクトを作成する。
2. `supabase/0001_user_item_states.sql` を適用する。
3. Authentication で Email を有効にする。
4. Google ログインを使う場合は Google Provider を有効化し、Google OAuth Client ID / Secret を登録する。
5. Authentication の Site URL / Redirect URLs に公開URLを追加する。
6. Project URL と Publishable key (`sb_publishable_...`) を `auth-config.js` に設定する。

`service_role` / secret key はブラウザに置かない。

## フロントの挙動

### ゲスト
- 戦闘: 可
- 商品詳細 / ショップ: 可
- 発見図鑑: 端末一時保存
- 欲しい / 持ってる / あとで見る: ログインを案内

### ログイン後
- 発見図鑑 / 欲しい / 持ってる / あとで見るをクラウド保存
- 既存ゲスト図鑑を初回ログイン時にマージ
- ログアウト後は他ユーザーのクラウド図鑑を端末上に残さない

## セキュリティ

`user_item_states` は RLS を有効化し、`auth.uid() = user_id` のユーザーだけが SELECT / INSERT / UPDATE / DELETE できる。
