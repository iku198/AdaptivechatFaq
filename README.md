# AdaptivechatFaq — DECAサポートチャット ウィジェット

GTM/サイトに1行で設置できるサポートチャット（React）。検索・生成はSalesforce(Apex+Knowledge+Einstein)、ブラウザ⇄Salesforceは Cloudflare Worker 中継。

## GTM設置スニペット
```html
<script
  src="https://cdn.jsdelivr.net/gh/iku198/AdaptivechatFaq@main/widget.js"
  data-src="https://cdn.jsdelivr.net/gh/iku198/AdaptivechatFaq@main/deca-react-live.html"
  data-endpoint="https://deca-bridge.ikuya-tanaka.workers.dev"
  defer></script>
```

## 構成
- `widget.js` … ローダー（iframeで隔離設置・開閉でサイズ調整）
- `deca-react-live.html` … チャット本体（`?embed=1&endpoint=` で埋め込み動作）
- `articles.js` … 画像/URL補完用の記事メタ
- `bridge/` … Cloudflare Worker等の中継（OAuth Client Credentials → Apex REST）＋SETUP手順
