(function(){
'use strict';

if(!mem.s) mem.s=new Set();

function readSet(key){try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch{return new Set()}}
function writeSet(key,set){try{localStorage.setItem(key,JSON.stringify([...set]))}catch{}}
function clearGuestLocal(){try{['loot-d','loot-w','loot-o','loot-s'].forEach(k=>localStorage.removeItem(k))}catch{}}

const legacy={
  d:readSet('loot-d'),
  w:readSet('loot-w'),
  o:readSet('loot-o'),
  s:readSet('loot-s')
};

let authUser=null;
let authOptions={email:true,google:false};
let recommendationData=null;
let busy=false;
let authMessage='';

function identity(){return authUser?.name||authUser?.email||'ログイン中'}
function guestMode(){mem.d=readSet('loot-d');mem.w=new Set();mem.o=new Set();mem.s=new Set()}

async function api(path,opt={}){
  const res=await fetch(path,{credentials:'same-origin',...opt,headers:{...(opt.body?{'content-type':'application/json'}:{}),...(opt.headers||{})}});
  let body=null;try{body=await res.json()}catch{body={}}
  if(!res.ok)throw new Error(body?.message||body?.error||`HTTP ${res.status}`);
  return body;
}

function toast(text,type='ok'){
  let el=document.getElementById('authToast');
  if(!el){el=document.createElement('div');el.id='authToast';el.className='authToast';document.body.appendChild(el)}
  el.textContent=text;el.dataset.type=type;el.classList.add('on');
  clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('on'),2400);
}

function ensureUi(){
  const top=document.querySelector('.top');
  const badge=document.getElementById('bookBadge');
  if(top&&badge&&!document.getElementById('authButton')){
    const wrap=document.createElement('div');wrap.className='accountStack';
    badge.parentNode.insertBefore(wrap,badge);wrap.appendChild(badge);
    const b=document.createElement('button');b.id='authButton';b.type='button';b.className='accountButton';b.addEventListener('click',()=>openAuth());wrap.appendChild(b);
  }
  const area=document.getElementById('collectionArea');
  if(area&&!document.getElementById('collectionAuth')){
    const bar=document.createElement('div');bar.id='collectionAuth';bar.className='collectionAuth';area.insertBefore(bar,area.firstChild);
  }
  if(!document.getElementById('authModal')){
    const modal=document.createElement('div');modal.id='authModal';modal.className='authModal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="authSheet"><div class="authHead"><div><div class="k">ACCOUNT / COLLECTION SAVE</div><div class="authTitle">図鑑を保存する</div></div><button class="authClose" id="authClose" type="button" aria-label="閉じる">×</button></div><div class="authMessage" id="authMessage"></div><div id="authOut"><button class="authGoogle" id="authGoogle" type="button">G　Googleで続ける</button><div class="authDivider" id="authDivider"><span>または</span></div><label class="authLabel">メールアドレス<input class="authInput" id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></label><label class="authLabel">パスワード<input class="authInput" id="authPassword" type="password" autocomplete="current-password" minlength="8" placeholder="8文字以上"></label><div class="authActions"><button class="authPrimary" id="authSignIn" type="button">ログイン</button><button class="authSecondary" id="authSignUp" type="button">新規登録</button></div><div class="authNote">ゲームはログインなしで遊べます。発見図鑑はこの端末に一時保存し、ログイン時に引き継ぎます。</div></div><div id="authIn" class="authHidden"><div class="authProfile"><div class="authAvatar">👤</div><div><b id="authIdentity"></b><div class="sub">Cloudflare D1 / Better Auth</div></div></div><button class="authSecondary full" id="authSignOut" type="button">この端末からログアウト</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('authClose').addEventListener('click',closeAuth);
    modal.addEventListener('click',e=>{if(e.target===modal)closeAuth()});
    document.getElementById('authGoogle').addEventListener('click',googleLogin);
    document.getElementById('authSignIn').addEventListener('click',emailLogin);
    document.getElementById('authSignUp').addEventListener('click',emailSignup);
    document.getElementById('authSignOut').addEventListener('click',logout);
  }
}

function openAuth(text=''){
  ensureUi();if(text)authMessage=text;drawAuth();
  document.getElementById('authModal').classList.add('on');document.body.style.overflow='hidden';
}
function closeAuth(){document.getElementById('authModal')?.classList.remove('on');document.body.style.overflow=''}

function drawAuth(){
  ensureUi();
  const button=document.getElementById('authButton');
  const bar=document.getElementById('collectionAuth');
  if(button){button.textContent=authUser?'👤 '+identity():'ログイン';button.classList.toggle('signed',!!authUser)}
  if(bar){
    bar.innerHTML=authUser?`<div><b>☁️ ${esc(identity())}</b><div class="sub">図鑑・欲しい・持ってる・あとで見るをD1へ保存。</div></div><span class="syncPill">SYNC ON</span>`:`<div><b>ゲスト図鑑</b><div class="sub">発見商品はこの端末に一時保存。ログイン時に引き継ぎます。</div></div><button class="collectionLogin" id="collectionLogin" type="button">図鑑を保存</button>`;
    document.getElementById('collectionLogin')?.addEventListener('click',()=>openAuth('いまの発見図鑑をログイン後のアカウントへ引き継ぎます。'));
  }
  const out=document.getElementById('authOut'),inside=document.getElementById('authIn'),msg=document.getElementById('authMessage');
  if(out)out.classList.toggle('authHidden',!!authUser);if(inside)inside.classList.toggle('authHidden',!authUser);
  const ident=document.getElementById('authIdentity');if(ident)ident.textContent=identity();
  if(msg){msg.textContent=authMessage||(authUser?'クラウド図鑑に接続済み。':'ゲストプレイ中。');msg.classList.toggle('warn',false)}
  const google=document.getElementById('authGoogle'),divider=document.getElementById('authDivider');
  if(google){google.classList.toggle('authHidden',!authOptions.google);google.disabled=busy}
  if(divider)divider.classList.toggle('authHidden',!authOptions.google);
  ['authSignIn','authSignUp'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=busy||!authOptions.email});
}

async function loadAuthOptions(){
  try{const j=await api('/api/auth-options');authOptions={email:j.email!==false,google:Boolean(j.google)}}catch{authOptions={email:true,google:false}}
  drawAuth();
}

function guestPayload(){
  return{
    discovered:[...new Set([...legacy.d,...readSet('loot-d')])],
    wanted:[...new Set([...legacy.w,...readSet('loot-w')])],
    owned:[...new Set([...legacy.o,...readSet('loot-o')])],
    saved:[...new Set([...legacy.s,...readSet('loot-s')])]
  };
}

async function mergeGuest(){
  const payload=guestPayload();
  if(!payload.discovered.length&&!payload.wanted.length&&!payload.owned.length&&!payload.saved.length)return;
  await api('/api/me/collection/merge',{method:'POST',body:JSON.stringify(payload)});
  clearGuestLocal();Object.values(legacy).forEach(set=>set.clear());
}

async function loadRemote(){
  const j=await api('/api/me/collection');
  mem.d=new Set();mem.w=new Set();mem.o=new Set();mem.s=new Set();
  for(const row of j.data||[]){if(row.discovered_at)mem.d.add(row.item_id);if(Number(row.wanted))mem.w.add(row.item_id);if(Number(row.owned))mem.o.add(row.item_id);if(Number(row.saved))mem.s.add(row.item_id)}
}

async function loadRecommendation(){
  if(!authUser){recommendationData=null;return}
  try{const j=await api('/api/me/recommendation');recommendationData=j.data||null}catch{recommendationData=null}
}

async function refreshSession(showSuccess=false){
  try{
    const j=await api('/api/auth-check');
    if(j.authenticated&&j.user){
      authUser=j.user;
      await mergeGuest();await loadRemote();await loadRecommendation();
      if(showSuccess)toast('ログイン完了。図鑑を同期しました。');
    }else{authUser=null;recommendationData=null;guestMode()}
  }catch(e){console.error(e);authUser=null;recommendationData=null;guestMode();authMessage='認証状態を確認できませんでした。'}
  render();renderStageList();drawAuth();
}

function credentials(){
  return{
    email:String(document.getElementById('authEmail')?.value||'').trim(),
    password:String(document.getElementById('authPassword')?.value||'')
  };
}
async function emailLogin(){
  const c=credentials();if(!c.email||c.password.length<8){authMessage='メールアドレスと8文字以上のパスワードを入力してください。';drawAuth();return}
  busy=true;authMessage='ログイン中…';drawAuth();
  try{await api('/api/auth/sign-in/email',{method:'POST',body:JSON.stringify({...c,rememberMe:true})});authMessage='';closeAuth();await refreshSession(true)}catch(e){authMessage=e.message;toast('ログインできませんでした。','error')}finally{busy=false;drawAuth()}
}
async function emailSignup(){
  const c=credentials();if(!c.email||c.password.length<8){authMessage='メールアドレスと8文字以上のパスワードを入力してください。';drawAuth();return}
  busy=true;authMessage='登録中…';drawAuth();
  try{const name=c.email.split('@')[0]||'LOOT PLAYER';await api('/api/auth/sign-up/email',{method:'POST',body:JSON.stringify({...c,name})});authMessage='';closeAuth();await refreshSession(true)}catch(e){authMessage=e.message;toast('登録できませんでした。','error')}finally{busy=false;drawAuth()}
}
async function googleLogin(){
  busy=true;authMessage='Googleログインへ移動します…';drawAuth();
  try{
    const j=await api('/api/auth/sign-in/social',{method:'POST',body:JSON.stringify({provider:'google',callbackURL:location.href})});
    if(j.url){location.assign(j.url);return}
    throw new Error('GoogleログインURLを取得できませんでした。');
  }catch(e){busy=false;authMessage=e.message;toast('Googleログインを開始できませんでした。','error');drawAuth()}
}
async function logout(){
  busy=true;drawAuth();
  try{await api('/api/auth/sign-out',{method:'POST',body:JSON.stringify({})});authUser=null;recommendationData=null;guestMode();authMessage='';closeAuth();render();renderStageList();toast('ログアウトしました。')}catch(e){authMessage=e.message;toast('ログアウトできませんでした。','error')}finally{busy=false;drawAuth()}
}

async function persistState(itemId,changes){
  if(!authUser)throw new Error('ログインが必要です。');
  return api('/api/me/items/'+encodeURIComponent(itemId),{method:'PUT',body:JSON.stringify(changes)});
}

save=function(){
  if(!authUser)writeSet('loot-d',mem.d);
};

tog=function(key,id,el){
  if(!authUser){openAuth('「欲しい」「持ってる」「あとで見る」はログインすると保存できます。');return}
  if(!mem[key])mem[key]=new Set();
  const was=mem[key].has(id);was?mem[key].delete(id):mem[key].add(id);if(el)el.classList.toggle('on',!was);render();
  const field=key==='w'?'wanted':key==='o'?'owned':'saved';
  persistState(id,{[field]:!was}).then(async()=>{await loadRecommendation();renderStageList();toast('保存しました。')}).catch(e=>{was?mem[key].add(id):mem[key].delete(id);render();console.error(e);toast('保存に失敗しました。','error')});
};

const baseRender=render;
render=function(){
  if(!mem.s)mem.s=new Set();baseRender();
  bookBadge.textContent=(authUser?'図鑑 ':'仮図鑑 ')+mem.d.size+' / '+allItems.length;
  if(!authUser&&tab!=='d'){
    collection.innerHTML='<div class="collectionGate"><b>ログイン後に使えます。</b><div class="sub">欲しい・持ってる・あとで見るはアカウントに保存します。</div><button class="collectionLogin" id="gateLogin" type="button">ログイン</button></div>';
    document.getElementById('gateLogin')?.addEventListener('click',()=>openAuth('この機能はログイン後に利用できます。'));
  }
  drawAuth();
};

function addRecommendationCard(){
  document.getElementById('wishRecommendation')?.remove();
  if(!authUser||!recommendationData?.stage)return;
  const root=document.getElementById('stageList');if(!root)return;
  const d=recommendationData;
  const node=document.createElement('div');node.id='wishRecommendation';node.className='recommendationCard';
  node.innerHTML=`<div class="k">FOR YOU / WISHLIST</div><b>「${esc(d.category)}」が気になっているなら ${esc(d.stage.name)}</b><div class="sub">欲しい登録 ${Number(d.preference_score)||0}件の傾向から提案。該当商品 ${Number(d.stage.matching_items)||0}件。</div><button class="btn2" id="wishRecommendationGo" type="button">このダンジョンを見る</button>`;
  root.insertBefore(node,root.firstChild);
  document.getElementById('wishRecommendationGo')?.addEventListener('click',()=>selectStage(d.stage.id));
}

const baseRenderStageList=renderStageList;
renderStageList=function(){baseRenderStageList();addRecommendationCard()};

const baseShowLoot=showLoot;
showLoot=function(x,boss){
  baseShowLoot(x,boss);
  const actions=document.querySelector('#lootState .lootActions');
  if(actions&&!document.getElementById('later')){
    const b=document.createElement('button');b.id='later';b.type='button';b.className='action '+(mem.s.has(x.id)?'on':'');b.textContent='🔖 あとで見る';b.addEventListener('click',()=>tog('s',x.id,b));actions.appendChild(b);
  }
  if(authUser)persistState(x.id,{discovered:true}).catch(e=>{console.error(e);toast('発見図鑑の同期に失敗しました。','error')});
};

const baseOpenItemDetail=openItemDetail;
openItemDetail=function(id){
  baseOpenItemDetail(id);
  const body=document.getElementById('itemModalBody');if(!body||document.getElementById('itemUserActions'))return;
  const box=document.createElement('div');box.id='itemUserActions';box.className='lootActions detailUserActions';
  box.innerHTML=`<button class="action ${mem.w.has(id)?'on':''}" data-user-action="w" type="button">♡ 欲しい</button><button class="action ${mem.o.has(id)?'on':''}" data-user-action="o" type="button">✓ 持ってる</button><button class="action ${mem.s.has(id)?'on':''}" data-user-action="s" type="button">🔖 あとで見る</button>`;
  const target=body.querySelector('.affiliateNotice,.itemNoLink');if(target)body.insertBefore(box,target);else body.appendChild(box);
  box.querySelectorAll('[data-user-action]').forEach(btn=>btn.addEventListener('click',()=>tog(btn.dataset.userAction,id,btn)));
};

window.LootAccount={open:openAuth,get user(){return authUser},refresh:refreshSession};
ensureUi();guestMode();render();loadAuthOptions();refreshSession(false);
})();
