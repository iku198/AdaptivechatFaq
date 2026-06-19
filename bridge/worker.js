/**
 * DECA サポートチャット 中継（Cloudflare Worker 版）
 * 役割：ブラウザ(widget) ⇄ Salesforce Apex REST(KbAgentService) の認証付き中継。
 *  - OAuth 2.0 Client Credentials で Salesforce のアクセストークンを取得（メモリにキャッシュ）
 *  - /search → Apex action=generate（Einstein/Gemini生成）
 *  - /knowledge → Apex action=knowledge（SOSL検索）
 *  - /log, /feedback → 受領のみ（必要ならApexにlogアクションを足す）
 * 必要な環境変数(Worker Secrets):
 *  SF_LOGIN_URL   例) https://givery--scpartial.sandbox.my.salesforce.com
 *  SF_CLIENT_ID   Connected App のコンシューマ鍵
 *  SF_CLIENT_SECRET Connected App のコンシューマの秘密
 *  ALLOWED_ORIGIN 例) https://www.example.com（設置サイトのオリジン。* も可だが本番は限定推奨）
 */
let _tok = { access: null, instance: null, exp: 0 };

async function getToken(env) {
  const now = Date.now();
  if (_tok.access && now < _tok.exp) return _tok;
  const id = (env.SF_CLIENT_ID || '').trim();
  const secret = (env.SF_CLIENT_SECRET || '').trim();
  const login = (env.SF_LOGIN_URL || '').trim().replace(/\/+$/, '');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: id,
    client_secret: secret,
  });
  const r = await fetch(login + '/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('OAuth失敗: ' + JSON.stringify(j) + ' [idlen=' + id.length + ' seclen=' + secret.length + ' login=' + login + ']');
  _tok = { access: j.access_token, instance: j.instance_url || login, exp: now + 25 * 60 * 1000 };
  return _tok;
}

async function callApex(env, action, q) {
  const t = await getToken(env);
  const r = await fetch(t.instance + '/services/apexrest/kbagent', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + t.access, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, q }),
  });
  return await r.json();
}

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

export default {
  async fetch(request, env) {
    const headers = cors(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    let payload = {};
    try { payload = await request.json(); } catch (e) {}
    try {
      if (path.endsWith('/knowledge')) {
        const d = await callApex(env, 'knowledge', payload.q || '');
        return new Response(JSON.stringify({ articles: d.articles || [] }), { headers });
      }
      if (path.endsWith('/search')) {
        const d = await callApex(env, 'generate', payload.q || '');
        return new Response(JSON.stringify({ text: d.text || '' }), { headers });
      }
      if (path.endsWith('/log') || path.endsWith('/feedback')) {
        // 必要に応じて Apex に log アクションを追加して転送（現状は受領のみ）
        return new Response(JSON.stringify({ ok: true }), { headers });
      }
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
    }
  },
};
