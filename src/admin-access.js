import { getAdminAccessState, isAdminSession } from './auth.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-frame-options': 'DENY',
      'referrer-policy': 'same-origin',
    },
  });
}

function shell(title, content, script = '') {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#080b10">
<title>${escapeHtml(title)} | LOOT MARKET</title>
<style>
:root{--bg:#080b10;--panel:#111720;--line:#293446;--text:#f4f7fa;--muted:#8f9bad;--accent:#d8ff3e;--danger:#ff8c98;--good:#79f2a7}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:max(20px,env(safe-area-inset-top)) 14px max(24px,env(safe-area-inset-bottom))}.wrap{width:min(460px,100%);margin:0 auto}.brand{font-size:12px;letter-spacing:.16em;color:var(--accent);font-weight:900;margin:16px 0 8px}.card{border:1px solid var(--line);background:var(--panel);border-radius:22px;padding:20px;box-shadow:0 24px 70px #0008}.title{font-size:27px;font-weight:950;letter-spacing:-.04em;margin:0 0 6px}.sub{color:var(--muted);font-size:13px;line-height:1.65;margin-bottom:18px}.field{display:block;margin:12px 0}.field span{display:block;font-size:11px;color:#aeb8c7;font-weight:850;margin-bottom:6px}.field input{width:100%;font:inherit;font-size:16px;border:1px solid #334158;background:#090f16;color:#fff;border-radius:14px;padding:13px 14px;outline:none}.field input:focus{border-color:var(--accent)}.actions{display:grid;gap:9px;margin-top:16px}.btn{width:100%;border:0;border-radius:14px;padding:13px 15px;font:inherit;font-weight:950;background:var(--accent);color:#090d0a}.btn.secondary{border:1px solid var(--line);background:#171f2b;color:#fff}.btn.danger{border:1px solid #57333a;background:#25151a;color:#ffb0b7}.btn:disabled{opacity:.55}.msg{min-height:20px;font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5}.msg.err{color:var(--danger)}.status{border:1px solid #31543d;background:#0c1811;color:var(--good);border-radius:13px;padding:10px 12px;font-size:12px;margin-bottom:14px}.warn{border:1px solid #5d4d27;background:#1c170c;color:#ffe7a5;border-radius:13px;padding:11px 12px;font-size:12px;line-height:1.55;margin-bottom:14px}.link{display:block;text-align:center;color:#c8d1dd;text-decoration:none;font-size:12px;margin-top:16px;padding:10px}.identity{font-weight:900;word-break:break-all}.tiny{font-size:11px;color:var(--muted);line-height:1.55;margin-top:12px}
</style>
</head>
<body><div class="wrap"><div class="brand">LOOT MARKET / OPERATIONS</div>${content}</div>${script ? `<script>${script}</script>` : ''}</body></html>`;
}

function loginPage() {
  const content = `<section class="card"><h1 class="title">管理者ログイン</h1><div class="sub">ゲームと同じBetter Authアカウントでログインします。管理者登録済みなら、以後ADMIN_TOKENの入力は不要です。</div><label class="field"><span>メールアドレス</span><input id="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"></label><label class="field"><span>パスワード</span><input id="password" type="password" autocomplete="current-password" minlength="8" placeholder="8文字以上"></label><div class="actions"><button class="btn" id="login">ログイン</button><button class="btn secondary" id="signup">新規登録</button></div><div class="msg" id="msg"></div></section><a class="link" href="/">← ゲームへ戻る</a>`;
  const script = `
const msg=document.getElementById('msg');
function show(t,e=false){msg.textContent=t;msg.className='msg'+(e?' err':'')}
function credentials(){return{email:document.getElementById('email').value.trim(),password:document.getElementById('password').value}}
async function post(path,body){const r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.message||j.error||'認証に失敗しました');return j}
async function run(mode){const c=credentials();if(!c.email||c.password.length<8){show('メールアドレスと8文字以上のパスワードを入力してください。',true);return}document.getElementById('login').disabled=true;document.getElementById('signup').disabled=true;show(mode==='login'?'ログイン中…':'登録中…');try{if(mode==='login')await post('/api/auth/sign-in/email',{...c,rememberMe:true});else await post('/api/auth/sign-up/email',{...c,name:c.email.split('@')[0]||'LOOT ADMIN'});location.reload()}catch(e){show(e.message,true);document.getElementById('login').disabled=false;document.getElementById('signup').disabled=false}}
document.getElementById('login').onclick=()=>run('login');document.getElementById('signup').onclick=()=>run('signup');document.getElementById('password').addEventListener('keydown',e=>{if(e.key==='Enter')run('login')});`;
  return shell('管理者ログイン', content, script);
}

function bootstrapPage(state) {
  const identity = escapeHtml(state.user?.email || state.user?.name || 'ログイン中');
  const bridge = state.bridgeReady
    ? '<div class="warn">初回だけ、現在のCloudflare ADMIN_TOKENを入力してこのアカウントを管理者に登録します。登録後はこの入力欄自体が出なくなります。</div>'
    : '<div class="warn">Cloudflare側のADMIN_TOKENが未設定です。サーバー設定を確認してください。</div>';
  const controls = state.bridgeReady ? `<label class="field"><span>ADMIN_TOKEN（初回のみ）</span><input id="token" type="password" autocomplete="off" placeholder="Cloudflare ADMIN_TOKEN"></label><div class="actions"><button class="btn" id="claim">このアカウントを管理者にする</button><button class="btn secondary" id="logout">ログアウト</button></div><div class="msg" id="msg"></div>` : `<div class="actions"><button class="btn secondary" id="logout">ログアウト</button></div>`;
  const content = `<section class="card"><div class="status">Better Auth ログイン済み</div><h1 class="title">初回セットアップ</h1><div class="sub">ログイン中: <span class="identity">${identity}</span></div>${bridge}${controls}<div class="tiny">安全のため「最初の管理者」だけがこの方法で登録できます。管理者が1人でも登録された後は、別ユーザーがADMIN_TOKENだけで管理者を奪うことはできません。</div></section>`;
  const script = `
async function logout(){await fetch('/api/auth/sign-out',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'}).catch(()=>{});sessionStorage.removeItem('loot_admin_token');location.reload()}
document.getElementById('logout').onclick=logout;
const claim=document.getElementById('claim');if(claim)claim.onclick=async()=>{const token=document.getElementById('token').value.trim(),msg=document.getElementById('msg');if(!token){msg.textContent='ADMIN_TOKENを入力してください。';msg.className='msg err';return}claim.disabled=true;msg.textContent='管理者登録中…';msg.className='msg';try{const r=await fetch('/api/admin/bootstrap',{method:'POST',credentials:'same-origin',headers:{Authorization:'Bearer '+token}});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||'登録に失敗しました');sessionStorage.setItem('loot_admin_token','session');location.reload()}catch(e){msg.textContent=e.message;msg.className='msg err';claim.disabled=false}};`;
  return shell('初回セットアップ', content, script);
}

function forbiddenPage(state) {
  const identity = escapeHtml(state.user?.email || state.user?.name || 'ログイン中');
  const content = `<section class="card"><div class="status">Better Auth ログイン済み</div><h1 class="title">管理者権限がありません</h1><div class="sub">ログイン中: <span class="identity">${identity}</span><br>このアカウントは管理画面へアクセスできません。</div><div class="actions"><button class="btn secondary" id="logout">ログアウト</button></div></section>`;
  const script = `document.getElementById('logout').onclick=async()=>{await fetch('/api/auth/sign-out',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'}).catch(()=>{});sessionStorage.removeItem('loot_admin_token');location.reload()};`;
  return shell('アクセス不可', content, script);
}

function bridgeMissingPage(state) {
  const identity = escapeHtml(state.user?.email || state.user?.name || '管理者');
  const content = `<section class="card"><div class="status">管理者: ${identity}</div><h1 class="title">サーバー設定を確認</h1><div class="sub">管理者セッションは有効ですが、既存管理APIへ橋渡しするCloudflare ADMIN_TOKENがサーバー側にありません。</div><div class="warn">ADMIN_TOKENをCloudflare WorkerのSecretとして設定してください。スマホ側で入力する必要はありません。</div></section>`;
  return shell('サーバー設定', content);
}

function injectSessionAdminUi(source, state) {
  const identity = escapeHtml(state.user?.name || state.user?.email || 'ADMIN');
  const email = escapeHtml(state.user?.email || '');
  const style = `<style>.auth{display:none!important}.sessionAdmin{margin:14px 0;border:1px solid #31543d;background:#0d1812;border-radius:16px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.sessionAdmin b{font-size:13px}.sessionAdmin .sessionMeta{font-size:10px;color:#9eb0a4;margin-top:3px}.sessionAdmin button{border:1px solid #314038;background:#142019;color:#d8e3dc;border-radius:11px;padding:8px 10px;font-weight:850;font-size:11px}@media(max-width:720px){.sessionAdmin{position:sticky;top:max(6px,env(safe-area-inset-top));z-index:8;box-shadow:0 8px 24px #0008}}</style>`;
  const banner = `<div class="sessionAdmin"><div><div class="k">BETTER AUTH / ADMIN SESSION</div><b>👤 ${identity}</b><div class="sessionMeta">${email} ・ ADMIN_TOKEN入力不要</div></div><button id="adminSessionLogout" type="button">ログアウト</button></div>`;
  let out = source.replace('</head>', `${style}</head>`);
  out = out.replace('<div class="stats">', `${banner}<div class="stats">`);
  out = out.replace('<script>', `<script>sessionStorage.setItem('loot_admin_token','session');`);
  out = out.replace('</body>', `<script>document.getElementById('adminSessionLogout')?.addEventListener('click',async()=>{await fetch('/api/auth/sign-out',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'}).catch(()=>{});sessionStorage.removeItem('loot_admin_token');location.reload()});</script></body>`);
  return out;
}

export async function handleAdminPage(request, env) {
  const state = await getAdminAccessState(request, env);
  if (!state.authenticated) return html(loginPage());
  if (!state.admin) return html(state.needsBootstrap ? bootstrapPage(state) : forbiddenPage(state), state.needsBootstrap ? 200 : 403);
  if (!state.bridgeReady) return html(bridgeMissingPage(state), 503);
  if (!env.ASSETS) return html(shell('管理画面', '<section class="card"><h1 class="title">Static Assets binding がありません</h1></section>'), 503);

  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/admin-console.html';
  assetUrl.search = '';
  const assetRequest = new Request(assetUrl.toString(), { method: 'GET', headers: request.headers });
  const asset = await env.ASSETS.fetch(assetRequest);
  if (!asset.ok) return asset;
  const source = await asset.text();
  const headers = new Headers(asset.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-frame-options', 'DENY');
  return new Response(injectSessionAdminUi(source, state), { status: asset.status, headers });
}

function isAdminApiCandidate(url, method) {
  const path = url.pathname;
  if (path === '/api/stage-rules' || path.startsWith('/api/stage-rules/')) return true;
  if (path === '/api/media' && method === 'POST') return true;
  if (path.startsWith('/api/media/') && method === 'DELETE') return true;
  return /^\/api\/(stages|enemies|bosses|items|conditions)(\/|$)/.test(path);
}

export async function bridgeAdminSession(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_TOKEN || !isAdminApiCandidate(url, request.method)) return request;
  if (!(await isAdminSession(request, env))) return request;
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${env.ADMIN_TOKEN}`);
  return new Request(request, { headers });
}
