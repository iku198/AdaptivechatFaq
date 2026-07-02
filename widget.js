/*!
 * DECA サポートチャット ウィジェット ローダー
 * GTMやサイトに <script src=".../widget.js" data-src="..." data-endpoint="..."> で設置。
 *  - data-src      : 埋め込みチャットページ(deca-react-live.html)のURL（CDN/Pages配信）
 *  - data-endpoint : 中継API(サーバレス)のベースURL（/search・/knowledge・/log を持つ）
 * iframe で隔離 → 設置先サイトのCSSと衝突しません。開閉でサイズ自動調整。
 */
(function () {
  if (window.__DECA_WIDGET__) return; window.__DECA_WIDGET__ = true;
  var cs = document.currentScript || (function(){ var s=document.getElementsByTagName('script'); return s[s.length-1]; })();
  var src = (cs && cs.getAttribute('data-src')) || '';
  var endpoint = (cs && cs.getAttribute('data-endpoint')) || '';
  if (!src) { console.error('[DECA widget] data-src が未設定です'); return; }
  var d0 = new Date();  // 日次キャッシュバスター（CDNのブラウザキャッシュ7日を最大1日に短縮）
  var ver = d0.getFullYear() * 10000 + (d0.getMonth() + 1) * 100 + d0.getDate();
  var url = '';
  function buildUrl(base) {
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'embed=1' + '&v=' + ver
         + (endpoint ? '&endpoint=' + encodeURIComponent(endpoint) : '');
  }

  function mount() {
    var f = document.createElement('iframe');
    f.id = 'deca-chat-frame';
    f.title = 'DECA サポートチャット';
    f.setAttribute('allow', 'clipboard-write');
    f.setAttribute('allowtransparency', 'true');
    f.src = url;
    f.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px',
      'width:336px', 'height:96px', 'max-width:100vw', 'max-height:100vh',
      'border:0', 'background:transparent', 'z-index:2147483000',
      'box-shadow:none', 'transition:width .25s ease,height .25s ease'
    ].join(';');
    document.body.appendChild(f);

    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.deca !== 'resize') return;
      var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
      if (d.expanded) {
        // 拡張時は全画面
        f.style.top = '0'; f.style.left = '0'; f.style.right = '0'; f.style.bottom = '0';
        f.style.transform = 'none';
        f.style.width = '100vw'; f.style.height = '100vh';
      } else {
        // 通常/閉は右下に固定サイズ
        f.style.top = 'auto'; f.style.left = 'auto'; f.style.transform = 'none';
        f.style.right = '16px'; f.style.bottom = '16px';
        if (d.w) f.style.width = Math.min(d.w, vw - 32) + 'px';
        if (d.h) f.style.height = Math.min(d.h, vh - 32) + 'px';
      }
    });
  }
  function ready() {
    if (document.body) mount();
    else window.addEventListener('DOMContentLoaded', mount);
  }
  // jsDelivrの @main→コミット解決キャッシュ(最大12h)を回避：最新コミットSHA固定URLで読み込む
  var gh = src.match(/^(https:\/\/cdn\.jsdelivr\.net\/gh\/)([^\/@]+\/[^\/@]+)@main(\/.+)$/);
  if (gh) {
    fetch('https://api.github.com/repos/' + gh[2] + '/commits/main')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        url = buildUrl(j && j.sha ? gh[1] + gh[2] + '@' + String(j.sha).slice(0, 10) + gh[3] : src);
        ready();
      })
      .catch(function () { url = buildUrl(src); ready(); });
  } else { url = buildUrl(src); ready(); }
})();
