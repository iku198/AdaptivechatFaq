/**
 * DECA サポートチャット 中継（Node 版：Vercel / Lambda / 任意のNodeサーバ）
 * Cloudflare Worker版と同等。`node server.js` でローカル検証も可（PORT=8788）。
 * 環境変数: SF_LOGIN_URL / SF_CLIENT_ID / SF_CLIENT_SECRET / ALLOWED_ORIGIN
 */
const http = require('http');

let _tok = { access: null, instance: null, exp: 0 };

async function getToken() {
  if (_tok.access && Date.now() < _tok.exp) return _tok;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
  });
  const r = await fetch(process.env.SF_LOGIN_URL + '/services/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('OAuth失敗: ' + JSON.stringify(j));
  _tok = { access: j.access_token, instance: j.instance_url || process.env.SF_LOGIN_URL, exp: Date.now() + 25 * 60 * 1000 };
  return _tok;
}
async function callApex(action, q) {
  const t = await getToken();
  const r = await fetch(t.instance + '/services/apexrest/kbagent', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + t.access, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, q }),
  });
  return await r.json();
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}
const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let raw = '';
  req.on('data', c => raw += c);
  req.on('end', async () => {
    const path = req.url.replace(/\?.*$/, '').replace(/\/+$/, '');
    let p = {}; try { p = JSON.parse(raw || '{}'); } catch (e) {}
    try {
      if (path.endsWith('/knowledge')) { const d = await callApex('knowledge', p.q || ''); return res.end(JSON.stringify({ articles: d.articles || [] })); }
      if (path.endsWith('/search'))    { const d = await callApex('generate',  p.q || ''); return res.end(JSON.stringify({ text: d.text || '' })); }
      if (path.endsWith('/log') || path.endsWith('/feedback')) return res.end(JSON.stringify({ ok: true }));
      res.writeHead(404); res.end(JSON.stringify({ error: 'not found' }));
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: String(e) })); }
  });
});
server.listen(process.env.PORT || 8788, () => console.log('bridge on :' + (process.env.PORT || 8788)));
