(function(){
'use strict';

const cfg=window.LOOT_MARKET_AUTH||{};
const configured=Boolean(cfg.supabaseUrl&&cfg.supabasePublishableKey);
if(!mem.s)mem.s=new Set();

function readSet(k){try{return new Set(JSON.parse(localStorage.getItem(k)||'[]'))}catch{return new Set()}}
function writeSet(k,set){try{localStorage.setItem(k,JSON.stringify([...set]))}catch{}}
function clearGuest(){try{['loot-d','loot-w','loot-o','loot-s'].forEach(k=>localStorage.removeItem(k))}catch{}}
const legacy={d:new Set(mem.d),w:new Set(mem.w),o:new Set(mem.o),s:readSet('loot-s')};

let sb=null,user=null,busy=false,syncTimer=null,message='';

function ensureUi(){
  const top=document.querySelector('.top');
  if(top&&!document.getElementById('authButton')){
    const badge=document.getElementById('bookBadge');
    const wrap=document.createElement('div');wrap.className='accountStack';
    badge.parentNode.insertBefore(wrap,badge);wrap.appendChild(badge);
    const b=document.createElement('button');b.id='authButton';b.type='button';b.className='accountButton';b.onclick=()=>openAuth();wrap.appendChild(b);
  }
  const area=document.getElementById('collectionArea');
  if(area&&!document.getElementById('collectionAuth')){
    const bar=document.createElement('div');bar.id='collectionAuth';bar.className='collectionAuth';area.insertBefore(bar,area.firstChild);
  }
  if(!document.getElementById('authModal')){
    const m=document.createElement('div');m.id='authModal';m.className='authModal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
    m.innerHTML=`<div class="authSheet"><div class="authHead"><div><div class="k">ACCOUNT / COLLECTION SAVE</div><div class="authTitle">図鑑を保存する</div></div><button class="authClose" id="authClose" type="button">×</button></div><div class="authMessage" id="authMessage"></div><div id="authOut"><button class="authGoogle" id="authGoogle" type="button">G　Googleで続ける</button><div class="authDivider"><span>または</span></div><label class="authLabel">メールアドレス<input class="authInput" id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></label><label class="authLabel">パスワード<input class="authInput" id="authPassword" type="password" autocomplete="current-password" minlength="6" placeholder="6文字以上"></label><div class="authActions"><button class="authPrimary" id="authSignIn" type="button">ログイン</button><button class="authSecondary" id="authSignUp" type="button">新規登録</button></div><div class="authNote">ゲームはログインなしで遊べます。ログインすると図鑑・欲しい・持ってる・あとで見るを保存します。</div></div><div id="authIn" class="authHidden"><div class="authProfile"><div class="authAvatar">👤</div><div><b id="authIdentity"></b><div class="sub">Supabase Auth</div></div></div><button class="authSecondary full" id="authSignOut" type="button">この端末からログアウト</button></div></div>`;
    document.body.appendChild(m);
    authClose.onclick=closeAuth;m.onclick=e=>{if(e.target===m)closeAuth()};
    authGoogle.onclick=googleLogin;authSignIn.onclick=emailLogin;authSignUp.onclick=emailSignup;authSignOut.onclick=logout;
  }
}
function identity(){return user?.email||user?.user_metadata?.full_name||'ログイン中'}
function openAuth(text=''){ensureUi();if(text)message=text;drawAuth();authModal.classList.add('on');document.body.style.overflow='hidden'}
function closeAuth(){const m=document.getElementById('authModal');if(m)m.classList.remove('on');document.body.style.overflow=''}
function toast(t,type='ok'){let x=document.getElementById('authToast');if(!x){x=document.createElement('div');x.id='authToast';x.className='authToast';document.body.appendChild(x)}x.textContent=t;x.dataset.type=type;x.classList.add('on');clearTimeout(x._t);x._t=setTimeout(()=>x.classList.remove('on'),2400)}
function drawAuth(){
  ensureUi();
  authButton.textContent=user?'👤 '+identity():'ログイン';authButton.classList.toggle('signed',!!user);
  collectionAuth.innerHTML=user?`<div><b>☁️ ${esc(identity())}</b><div class="sub">図鑑・欲しい・持ってる・あとで見るを同期中。</div></div><span class="syncPill">SYNC ON</span>`:`<div><b>ゲスト図鑑</b><div class="sub">発見商品はこの端末に一時保存。ログイン時に引き継ぎます。</div></div><button class="collectionLogin" id="collectionLogin" type="button">図鑑を保存</button>`;
  const c=document.getElementById('collectionLogin');if(c)c.onclick=()=>openAuth('いま発見済みの商品をログイン後の図鑑へ引き継ぎます。');
  authOut.classList.toggle('authHidden',!!user);authIn.classList.toggle('authHidden',!user);authIdentity.textContent=identity();
  authMessage.textContent=message||(!configured?'Supabase接続設定待ち。ゲストプレイは利用できます。':user?'クラウド図鑑に接続済み。':'ゲストプレイ中。');authMessage.classList.toggle('warn',!configured);
  [authGoogle,authSignIn,authSignUp].forEach(b=>b.disabled=busy||!configured);
}
function guestLoad(){mem.d=readSet('loot-d');mem.w=new Set();mem.o=new Set();mem.s=new Set()}
function guestSave(){writeSet('loot-d',mem.d);try{['loot-w','loot-o','loot-s'].forEach(k=>localStorage.removeItem(k))}catch{}}
function ids(){return [...new Set([...mem.d,...mem.w,...mem.o,...mem.s])]}
function row(id){return{user_id:user.id,item_id:id,discovered_at:mem.d.has(id)?new Date().toISOString():null,wanted:mem.w.has(id),owned:mem.o.has(id),saved:mem.s.has(id),updated_at:new Date().toISOString()}}
async function syncAll(){if(!sb||!user)return;const list=ids();if(!list.length)return;const {error}=await sb.from('user_item_states').upsert(list.map(row),{onConflict:'user_id,item_id'});if(error)throw error}
async function loadRemote(){const {data,error}=await sb.from('user_item_states').select('item_id,discovered_at,wanted,owned,saved').eq('user_id',user.id);if(error)throw error;mem.d=new Set();mem.w=new Set();mem.o=new Set();mem.s=new Set();(data||[]).forEach(r=>{if(r.discovered_at)mem.d.add(r.item_id);if(r.wanted)mem.w.add(r.item_id);if(r.owned)mem.o.add(r.item_id);if(r.saved)mem.s.add(r.item_id)})}
async function mergeGuest(){
  const d=new Set([...legacy.d,...readSet('loot-d')]),w=new Set([...legacy.w,...readSet('loot-w')]),o=new Set([...legacy.o,...readSet('loot-o')]),s=new Set([...legacy.s,...readSet('loot-s')]);
  const all=[...new Set([...d,...w,...o,...s])];if(!all.length)return;
  const now=new Date().toISOString();const rows=all.map(id=>({user_id:user.id,item_id:id,discovered_at:d.has(id)?now:null,wanted:w.has(id),owned:o.has(id),saved:s.has(id),updated_at:now}));
  const {error}=await sb.from('user_item_states').upsert(rows,{onConflict:'user_id,item_id'});if(error)throw error;clearGuest();Object.values(legacy).forEach(x=>x.clear());
}
async function applySession(session,event){user=session?.user||null;try{if(user){await mergeGuest();await loadRemote();if(event==='SIGNED_IN')toast('ログイン完了。ゲスト図鑑も引き継ぎました。')}else guestLoad()}catch(e){console.error(e);message='同期エラー: '+e.message;toast('図鑑の同期に失敗しました。','error')}drawAuth();render()}

const originalSave=save;
save=function(){if(!user){guestSave();return}clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll().catch(e=>{console.error(e);toast('図鑑の同期に失敗しました。','error')}),120)};

const originalRender=render;
render=function(){if(!mem.s)mem.s=new Set();originalRender();bookBadge.textContent=(user?'図鑑 ':'仮図鑑 ')+mem.d.size+' / '+allItems.length;if(!user&&tab!=='d'){collection.innerHTML='<div class="collectionGate"><b>ログイン後に使えます。</b><div class="sub">欲しい・持ってる・あとで見るはアカウントへ保存します。</div><button class="collectionLogin" id="gateLogin" type="button">ログイン</button></div>';gateLogin.onclick=()=>openAuth('この機能はログイン後に保存できます。')}drawAuth()};

tog=function(k,id,el){if(!user){openAuth('「欲しい」「持ってる」「あとで見る」はログイン後に保存できます。');return}if(!mem[k])mem[k]=new Set();const before=new Set(mem[k]);mem[k].has(id)?mem[k].delete(id):mem[k].add(id);if(el)el.classList.toggle('on',mem[k].has(id));render();syncAll().then(()=>toast('保存しました。')).catch(e=>{mem[k]=before;render();console.error(e);toast('保存に失敗しました。','error')})};

const previousShowLoot=showLoot;
showLoot=function(x,boss){previousShowLoot(x,boss);const actions=document.querySelector('#lootState .lootActions');if(actions&&!document.getElementById('later')){const b=document.createElement('button');b.id='later';b.type='button';b.className='action '+(mem.s.has(x.id)?'on':'');b.textContent='🔖 あとで見る';b.onclick=()=>tog('s',x.id,b);actions.appendChild(b)}};

function creds(){return{email:String(authEmail.value||'').trim(),password:String(authPassword.value||'')}}
async function googleLogin(){if(!sb)return;busy=true;message='Googleログインへ移動します…';drawAuth();const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:cfg.redirectTo||(location.origin+location.pathname)}});if(error){busy=false;message=error.message;drawAuth()}}
async function emailLogin(){if(!sb)return;const c=creds();if(!c.email||c.password.length<6){message='メールアドレスと6文字以上のパスワードを入力してください。';drawAuth();return}busy=true;message='ログイン中…';drawAuth();const {error}=await sb.auth.signInWithPassword(c);busy=false;if(error){message=error.message;drawAuth()}}
async function emailSignup(){if(!sb)return;const c=creds();if(!c.email||c.password.length<6){message='メールアドレスと6文字以上のパスワードを入力してください。';drawAuth();return}busy=true;message='登録中…';drawAuth();const {data,error}=await sb.auth.signUp({...c,options:{emailRedirectTo:cfg.redirectTo||(location.origin+location.pathname)}});busy=false;if(error){message=error.message;drawAuth();return}if(!data.session){message='確認メールを送りました。メール内のリンクを開くと登録完了です。';drawAuth()}}
async function logout(){if(!sb)return;busy=true;drawAuth();const {error}=await sb.auth.signOut({scope:'local'});busy=false;if(error){message=error.message;drawAuth()}else closeAuth()}

window.LootAuth={open:openAuth,get user(){return user}};
ensureUi();guestLoad();render();
if(configured&&window.supabase?.createClient){sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});sb.auth.onAuthStateChange((event,session)=>setTimeout(()=>applySession(session,event),0));sb.auth.getSession().then(({data,error})=>{if(error){message=error.message;drawAuth()}else applySession(data.session,'INITIAL_SESSION')})}else{drawAuth()}
})();
