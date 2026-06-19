# DECA サポートチャット — 本番(クラウド)構成 セットアップ

```
GitHub → CDN(jsDelivr/Pages) → GTMで widget.js 読み込み
                                   │ fetch
                          中継(サーバレス: Cloudflare Worker / Vercel / Lambda)
                                   │ OAuth(Client Credentials)
                          Salesforce  Apex REST KbAgentService
                                   ├ SOSL検索 (Knowledge__kav 115記事)
                                   └ Einstein/Gemini 生成
```
ローカル(Mac/cloudflared)は不要。データはSalesforce内に留まる。中継はトークンのみ保持。

---
## 0) 現状（sandbox `givery-scpartial` にデプロイ済み）
- ✅ Apex REST `KbAgentService`（SOSL＋Einstein生成）
- ✅ Knowledge `Knowledge__kav` 全115記事（Online）＋ `SourceUrl__c`
- ✅ Connected App **`DECA KB Bridge`**（Client Credentials有効・雛形）
- ✅ 権限セット **`KB Agent Integration`**（Apexクラス＋Knowledge読取）
→ 残りは下記 UI 仕上げ（Run Asユーザー指定・鍵取得・Einstein権限・デプロイ）だけ。

### 残りUI手順（最短）
1. Setup → App Manager → **DECA KB Bridge** → View → **Manage Consumer Details**：Consumer Key / Secret を取得 → 中継の `SF_CLIENT_ID`/`SF_CLIENT_SECRET`
2. 同App → Manage → **Edit Policies → Client Credentials Flow → Run As** に連携ユーザーを指定
3. 連携ユーザーに権限を割当（**この組織で確認済み・空きあり**）：
   - 権限セット **`KB Agent Integration`**（既存：Apexクラス＋Knowledge読取）
   - 権限セット **`PromptTemplatePermSet`**（Einsteinプロンプトテンプレート利用）
   - 権限セットライセンス **`Einstein Prompt Templates`**（18/100121＝空きあり）
   ※ これらでEinstein生成権限が有効化。未付与だと `/search` が失敗
4. 中継(`bridge/worker.js`等)に env を設定してデプロイ → `data-endpoint` に中継URL

---
## 1) Salesforce: Connected App（Client Credentials Flow）※雛形は作成済み。仕上げのみ
Setup → App Manager → New Connected App
- Enable OAuth Settings ✓
- Callback URL: `https://login.salesforce.com/services/oauth2/callback`（使わないがダミー必須）
- OAuth Scopes: `Manage user data via APIs (api)`, `Access content...（必要に応じ）`
- **Enable Client Credentials Flow** ✓
- 保存後 → Manage → Edit Policies → **Client Credentials Flow → Run As** に「連携用ユーザー」を指定
- Consumer Key / Consumer Secret を控える → 中継の `SF_CLIENT_ID` / `SF_CLIENT_SECRET`

## 2) 連携用ユーザー（Run Asユーザー）の権限
権限セット（例：`KB Agent Integration`）を作成し連携ユーザーに割当：
- Apex Class: `KbAgentService` 有効化
- オブジェクト: `Knowledge`(読取) / フィールド `SourceUrl__c`(読取)
- **Einstein Generative AI / Prompt Template User**（生成に必須。これが無いと generate が失敗）
- ※ Einstein権限のあるライセンス/ユーザーが必要（ゲストでは不可）

## 3) 中継(サーバレス)をデプロイ
### Cloudflare Worker（`bridge/worker.js`）
```
npm i -g wrangler
wrangler deploy bridge/worker.js
wrangler secret put SF_LOGIN_URL      # 例 https://givery--scpartial.sandbox.my.salesforce.com
wrangler secret put SF_CLIENT_ID
wrangler secret put SF_CLIENT_SECRET
wrangler secret put ALLOWED_ORIGIN    # 例 https://www.example.com
```
→ 払い出されたURL（例 `https://deca-bridge.xxx.workers.dev`）が `data-endpoint`。

### Node/Vercel（`bridge/server.js`）
同じ環境変数を設定して `node server.js`（Vercelはfunction化）。

## 4) フロント（widget）を GitHub→CDN→GTM
`widget.js` と `deca-react-live.html` を GitHub に置き、GTMのカスタムHTMLタグ:
```html
<script src="https://cdn.jsdelivr.net/gh/<org>/<repo>@v1/widget.js"
        data-src="https://<org>.github.io/<repo>/deca-react-live.html"
        data-endpoint="https://deca-bridge.xxx.workers.dev"
        defer></script>
```

## 動作確認
```
curl -X POST https://deca-bridge.xxx.workers.dev/knowledge -H 'Content-Type: application/json' -d '{"q":"リッチメニュー"}'
curl -X POST https://deca-bridge.xxx.workers.dev/search    -H 'Content-Type: application/json' -d '{"q":"テスト"}'
```

## 補足
- ログ(/log,/feedback)は現状中継で受領のみ。Salesforceに残すなら `KbAgentService` に `action:'log'` を追加し MessagingSession 等へ書込む実装を足す。
- 本番は `ALLOWED_ORIGIN` を設置サイトに限定、中継にレート制限を推奨。
