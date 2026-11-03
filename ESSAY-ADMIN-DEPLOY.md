# ESSAY 管理画面

専用 Worker `youmore-essay-admin` が投稿画面と API を配信します。GitHub Pages の essay-editor.html は下書き用であり、公開 API は提供しません。

## 動作
- Cloudflare Access の署名・issuer・audience・有効期限・本人メールを Worker 内でも検証。
- 下書きは端末保存。公開するまで画像・本文を公開ブランチへ追加しません。
- PNG/JPEG/WebP、1枚4MB、1投稿20画像まで。JSON容量制限と本人単位30回/分の制限。
- 記事、画像、blog.html、index.html、記事メタデータを単一コミットで更新。競合時は最新mainを再取得。通信失敗時の同一原稿再送は重複しません。
- 記事デザインはビルド時の essay-sample.html を使用。本文は許可した構造だけをHTML化します。
- 公開済み記事の編集・削除UIは未実装。公開後に原稿を変更すると別記事になります。

## 最後に必要なアカウント設定
1. GitHub fine-grained tokenを作成。対象は sleeping4439-tech/youmore のみ、Repository permissions の Contents を Read and write。値はチャットに送らず、本リポジトリ Actions secret `ESSAY_GITHUB_TOKEN` に保存。
2. Cloudflare Zero Trust の Access に Self-hosted application を追加。ホストは `youmore-essay-admin.sleeping4439.workers.dev`、全パスを保護。Allow policy は本人メール1件のみ。Everyone/Bypassは使わない。メールOTPなど本人が利用できる認証方式を選択。
3. GitHub Actions Variables に次を保存。
   - `ESSAY_ACCESS_TEAM_DOMAIN`: `https://<team>.cloudflareaccess.com`（末尾スラッシュなし）
   - `ESSAY_ACCESS_AUD`: 上のAccess applicationのAudience (AUD) Tag
   - `ESSAY_OWNER_EMAIL`: 許可した本人メール
4. 既存の `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を使用。Worker編集権限が必要。
5. Actions の Deploy ESSAY admin を Run workflow。設定不足の場合は503となり公開不能のままです。
6. 専用管理画面へ本人としてログイン。最初の実記事で画像・本文・一覧・トップの反映を確認。GitHub Pages反映には数分かかる場合があります。

## 検証
`node scripts/build-essay-admin.mjs && node --test tests/essay.test.mjs`
ローカルブラウザ検証は `node tests/essay-preview.mjs`。これはテスト署名鍵とメモリ内GitHub模擬サーバーを使い、本番リポジトリへ投稿しません。`/mobile` は390px幅の表示確認用です。
本番の本人ログインと実投稿は、上記アカウント設定後に別途確認が必要です。
