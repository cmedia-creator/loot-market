(function(){
'use strict';

const SPECIAL_META={
  revive:{name:'復活のダイス',icon:'🪽'},
  gamble:{name:'ギャンブルダイス',icon:'🎯'},
  triple:{name:'ゾロ目ダイス',icon:'🎰'},
  death:{name:'デスダイス',icon:'☠️'}
};

function heldDiceSummary(){
  const bag=run?.specialDice||{};
  const entries=Object.entries(SPECIAL_META).map(([key,meta])=>({key,...meta,count:Number(bag[key]||0)}));
  return{entries,total:entries.reduce((sum,x)=>sum+x.count,0)};
}

function updateHeldDiceToggle(){
  const btn=document.getElementById('heldDiceToggle');
  if(!btn)return;
  const {entries,total}=heldDiceSummary();
  const active=entries.filter(x=>x.count>0);
  const icons=active.length?active.map(x=>`<span>${x.icon}<b>×${x.count}</b></span>`).join(''):'<span class="heldDiceEmpty">なし</span>';
  btn.innerHTML=`<span class="heldDiceToggleLabel">🎒 保持ダイス <b>${total}</b></span><span class="heldDiceToggleIcons">${icons}</span>`;
  btn.classList.toggle('hasDice',total>0);
}

function ensureHeldDiceDialog(){
  let dlg=document.getElementById('heldDiceDialog');
  if(dlg)return dlg;
  dlg=document.createElement('dialog');
  dlg.id='heldDiceDialog';
  dlg.className='heldDiceDialog';
  dlg.innerHTML=`<div class="heldDiceSheet"><div class="heldDiceSheetHead"><div><small>SPECIAL DICE</small><b>保持ダイス</b><span>ステージ終了で消滅</span></div><button type="button" id="heldDiceClose" aria-label="閉じる">×</button></div><div id="heldDiceDialogBody"></div></div>`;
  document.body.appendChild(dlg);
  document.getElementById('heldDiceClose').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
  dlg.addEventListener('cancel',()=>dlg.close());
  dlg.addEventListener('click',e=>{if(e.target.closest('[data-special-die]'))setTimeout(()=>{if(dlg.open)dlg.close()},80)});
  return dlg;
}

function compactHeldDiceUi(){
  const zone=document.querySelector('.actionZone');
  const roll=document.getElementById('roll');
  const bar=document.getElementById('specialDiceBar');
  if(!zone||!roll||!bar)return false;

  const dlg=ensureHeldDiceDialog();
  const body=document.getElementById('heldDiceDialogBody');
  if(bar.parentElement!==body)body.appendChild(bar);
  bar.classList.add('heldDicePanel');

  let quick=document.getElementById('battleQuickRow');
  if(!quick){
    quick=document.createElement('div');
    quick.id='battleQuickRow';
    quick.className='battleQuickRow';
    quick.innerHTML='<button type="button" id="heldDiceToggle" class="heldDiceToggle"></button>';
    roll.insertAdjacentElement('afterend',quick);
    document.getElementById('heldDiceToggle').onclick=()=>{updateHeldDiceToggle();dlg.showModal()};
  }

  const escape=document.getElementById('escapeBattle');
  if(escape&&escape.parentElement!==quick)quick.appendChild(escape);
  document.querySelector('.battleSubActions')?.classList.add('heldDiceLegacyActions');

  const root=document.getElementById('specialDiceButtons');
  if(root&&!root.dataset.compactObserved){
    root.dataset.compactObserved='1';
    new MutationObserver(updateHeldDiceToggle).observe(root,{childList:true,subtree:true,characterData:true});
  }
  updateHeldDiceToggle();
  return true;
}

function showSpecialAcquireFx(banner){
  if(!banner||banner.dataset.acquireFxShown)return;
  banner.dataset.acquireFxShown='1';
  const icon=banner.querySelector(':scope > span')?.textContent?.trim()||'🎲';
  const name=banner.querySelector('b')?.textContent?.replace(/\s*を獲得\s*$/,'').trim()||'スペシャルダイス';
  document.querySelector('.specialAcquireFx')?.remove();
  const fx=document.createElement('div');
  fx.className='specialAcquireFx';
  fx.innerHTML=`<div class="specialAcquireBurst"><i>✦</i><i>✧</i><i>✦</i><div class="specialAcquireIcon">${icon}</div><small>SPECIAL DICE GET!</small><strong>${name}</strong><span>保持ダイスに追加</span></div>`;
  document.body.appendChild(fx);
  requestAnimationFrame(()=>fx.classList.add('on'));
  const toggle=document.getElementById('heldDiceToggle');
  if(toggle){toggle.classList.remove('acquired');void toggle.offsetWidth;toggle.classList.add('acquired')}
  setTimeout(()=>{fx.classList.remove('on');setTimeout(()=>fx.remove(),260)},1350);
}

function observeSpecialDrops(){
  const inspect=node=>{
    if(!(node instanceof Element))return;
    if(node.matches('.specialDropBanner'))showSpecialAcquireFx(node);
    node.querySelectorAll?.('.specialDropBanner').forEach(showSpecialAcquireFx);
  };
  document.querySelectorAll('.specialDropBanner').forEach(showSpecialAcquireFx);
  new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(inspect))).observe(document.body,{childList:true,subtree:true});
}

function showDiceDamageFx(amount,label){
  const n=Math.max(0,Math.round(Number(amount)||0));
  if(!n)return;
  const arena=document.querySelector('.arena');
  if(!arena)return;
  const fx=document.createElement('div');
  fx.className='diceDamageFx';
  fx.innerHTML=`<b>-${n} HP</b><span>${String(label||'ダイス攻撃').replace(/[<>]/g,'')}</span>`;
  arena.appendChild(fx);
  requestAnimationFrame(()=>fx.classList.add('on'));
  setTimeout(()=>fx.remove(),820);
}

function installDiceDamageGuard(){
  if(typeof applyPlayerDamage!=='function'||applyPlayerDamage.__diceDamageGuard)return;
  const core=applyPlayerDamage;
  const guarded=async function(base,label='攻撃'){
    const before=Number(ehp);
    const isDice=/ダイス/.test(String(label||''));
    const result=await core(base,label);
    let after=Number(ehp);

    if(isDice&&!isBoss&&before>0&&after===before&&Number(base)>0){
      const fallback=Math.max(0,Number(result)||Number(base)||0);
      ehp=Math.max(0,before-fallback);
      if(typeof ui==='function')ui();
      after=Number(ehp);
    }

    if(isDice&&before>after)showDiceDamageFx(before-after,label);
    return result;
  };
  guarded.__diceDamageGuard=true;
  applyPlayerDamage=guarded;
}

function boot(){
  installDiceDamageGuard();
  if(!compactHeldDiceUi())setTimeout(compactHeldDiceUi,80);
  observeSpecialDrops();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
