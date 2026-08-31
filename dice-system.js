(function(){
'use strict';

const TURN_DICE=[
  {key:'explosion',name:'爆発ダイス',icon:'💥',rate:.10,desc:'4以上で追加ダメージ+2'},
  {key:'lucky',name:'ラッキーダイス',icon:'🍀',rate:.05,desc:'必ず4以上が出る'},
  {key:'drain',name:'ドレインダイス',icon:'🩸',rate:.03,desc:'出目ぶんHP回復'},
  {key:'minus',name:'マイナスダイス',icon:'➖',rate:.01,desc:'攻撃力が出目-1'},
  {key:'negative',name:'ネガティブダイス',icon:'☁️',rate:.01,desc:'30%で攻撃ミス'},
  {key:'revenge',name:'復讐のダイス',icon:'🕷️',rate:.005,desc:'2以下で敵HP+10'}
];
const NORMAL_DIE={key:'normal',name:'ノーマルダイス',icon:'🎲',rate:.795,desc:'通常のサイコロ'};
const SPECIAL_DICE={
  revive:{name:'復活のダイス',icon:'🪽',desc:'次の敵ターンでHP0ならHP10で復活'},
  gamble:{name:'ギャンブルダイス',icon:'🎯',desc:'出目予想的中で1.5倍、外れで攻撃なし'},
  triple:{name:'ゾロ目ダイス',icon:'🎰',desc:'3個ゾロ目なら敵へ合計、失敗なら自分へ合計'},
  death:{name:'デスダイス',icon:'☠️',desc:'HP5以下で非ボス敵を即死'}
};
const SPECIAL_DROP_RATE=.15;
const RARE_ENEMIES=[
  {key:'gold',name:'金色スライム',icon:'🟡',rate:.001,hp:9,attack_min:1,attack_max:2,lootCount:2,minRarity:1,tag:'ULTRA RARE 0.1%',desc:'倒すと商品を2つ確定ドロップ。'},
  {key:'mimic',name:'宝箱ミミック',icon:'🎁',rate:.01,hp:24,attack_min:3,attack_max:5,lootCount:1,minRarity:3,tag:'RARE 1%',desc:'強敵。倒すと★★★以上の商品を確定ドロップ。'},
  {key:'merchant',name:'逃走商人',icon:'🏃',rate:.05,hp:12,attack_min:1,attack_max:2,lootCount:1,minRarity:4,turnLimit:2,tag:'RARE 5%',desc:'2ターン以内に倒すと★★★★以上の商品を確定ドロップ。'}
];

function ensureRunDice(){
  if(!run)return;
  if(!run.specialDice)run.specialDice={revive:0,gamble:0,triple:0,death:0};
  if(!('turnDie' in run))run.turnDie=null;
  if(!('reviveGuard' in run))run.reviveGuard=0;
  if(!('rareEncounter' in run))run.rareEncounter=null;
  if(!('pendingSpecialDrop' in run))run.pendingSpecialDrop=null;
}
function drawTurnDie(){
  const r=Math.random();let c=0;
  for(const d of TURN_DICE){c+=d.rate;if(r<c)return d}
  return NORMAL_DIE;
}
function assignTurnDie(){
  ensureRunDice();if(!run||isBoss&&ehp<=0)return;
  run.turnDie=drawTurnDie();updateDiceSystemUi();
}
function rollRareEnemy(){
  const r=Math.random();let c=0;
  for(const e of RARE_ENEMIES){c+=e.rate;if(r<c)return e}
  return null;
}
function specialDrop(){
  if(Math.random()>=SPECIAL_DROP_RATE)return null;
  const keys=Object.keys(SPECIAL_DICE);return keys[Math.floor(Math.random()*keys.length)];
}
function rareEnemyObject(def){
  return{
    id:`rare-${def.key}`,
    name:def.name,
    hp:def.hp,
    attack_min:def.attack_min,
    attack_max:def.attack_max,
    spawn_weight:1,
    is_rare:1,
    rare_key:def.key,
    rare_icon:def.icon
  };
}
function injectDiceSystemUi(){
  const combo=document.querySelector('.comboHud');
  if(combo&&!document.getElementById('turnDieHud')){
    combo.insertAdjacentHTML('afterend','<div id="turnDieHud" class="turnDieHud"><div class="turnDieLabel">NEXT DICE</div><div id="turnDieValue" class="turnDieValue"></div></div>');
  }
  const zone=document.querySelector('.actionZone');
  if(zone&&!document.getElementById('specialDiceBar')){
    const bar=document.createElement('div');bar.id='specialDiceBar';bar.className='specialDiceBar';
    bar.innerHTML='<div class="specialDiceHead"><b>SPECIAL DICE</b><span>ステージ終了で消滅</span></div><div id="specialDiceButtons" class="specialDiceButtons"></div><div class="battleSubActions"><button id="escapeBattle" class="escapeBattle" type="button">🏃 逃げる</button></div>';
    const roll=document.getElementById('roll');zone.insertBefore(bar,roll);
    document.getElementById('escapeBattle').addEventListener('click',escapeBattle);
  }
  if(!document.getElementById('gambleDialog')){
    const dlg=document.createElement('dialog');dlg.id='gambleDialog';dlg.className='gambleDialog';
    dlg.innerHTML='<div class="gambleTitle">🎯 出目を予測</div><div class="gambleSub">何が出るか選べ。</div><div class="gambleChoices">'+[1,2,3,4,5,6].map(n=>`<button type="button" data-gamble="${n}">${DIE[n]}<b>${n}</b></button>`).join('')+'</div><button type="button" class="btn2" data-gamble-cancel>キャンセル</button>';
    document.body.appendChild(dlg);
  }
}
function updateDiceSystemUi(){
  injectDiceSystemUi();if(!run)return;
  ensureRunDice();
  const d=run.turnDie||NORMAL_DIE;
  const hud=document.getElementById('turnDieValue');
  if(hud)hud.innerHTML=`<b class="die-${d.key}">${d.icon} ${esc(d.name)}</b><span>${esc(d.desc)}</span>`;
  const roll=document.getElementById('roll');
  if(roll&&!locked&&ehp>0)roll.textContent=`${d.icon} ${d.name}を振る`;
  const root=document.getElementById('specialDiceButtons');
  if(root){
    root.innerHTML=Object.entries(SPECIAL_DICE).map(([key,s])=>{
      const count=Number(run.specialDice[key]||0);
      const disabled=!count||locked||run.hp<=0||ehp<=0||(key==='death'&&(run.hp>5||isBoss));
      return `<button type="button" class="specialDieButton" data-special-die="${key}" ${disabled?'disabled':''}><span>${s.icon}</span><b>${esc(s.name)}</b><em>×${count}</em></button>`;
    }).join('');
    root.querySelectorAll('[data-special-die]').forEach(b=>b.addEventListener('click',()=>useSpecialDie(b.dataset.specialDie)));
  }
  const escape=document.getElementById('escapeBattle');
  if(escape){escape.classList.toggle('hide',isBoss||!enemy||ehp<=0);escape.disabled=locked||isBoss||!enemy||ehp<=0}
  let rs=document.getElementById('rareEnemyStatus');
  if(run.rareEncounter){
    if(!rs){rs=document.createElement('div');rs.id='rareEnemyStatus';rs.className='rareEnemyStatus';document.querySelector('.battleMission')?.insertAdjacentElement('afterend',rs)}
    const def=run.rareEncounter.def;
    const turns=def.turnLimit?` / ${run.enemyRolls||0}/${def.turnLimit}ターン`:'';
    rs.innerHTML=`<b>${def.icon} ${esc(def.name)}</b><span>${esc(def.desc)}${turns}</span>`;
  }else rs?.remove();
}
async function escapeBattle(){
  if(locked||isBoss||!enemy||ehp<=0)return;
  locked=true;document.getElementById('roll').disabled=true;updateDiceSystemUi();
  document.getElementById('msg').textContent=`${enemy.name} から逃げた。ペナルティなし。`;
  await wait(450);run.rareEncounter=null;spawn();
}
function awardSpecialDie(){
  ensureRunDice();const key=specialDrop();if(!key)return null;
  run.specialDice[key]=(run.specialDice[key]||0)+1;
  run.pendingSpecialDrop=key;updateDiceSystemUi();return key;
}
function consumeSpecialDie(key){
  ensureRunDice();if(!run.specialDice[key])return false;
  run.specialDice[key]--;run.turnDie=null;updateDiceSystemUi();return true;
}
function showSpecialDropBanner(){
  ensureRunDice();const key=run?.pendingSpecialDrop;if(!key)return;
  const s=SPECIAL_DICE[key],card=document.querySelector('#lootState .lootCard');
  if(card&&!card.querySelector('.specialDropBanner')){
    const el=document.createElement('div');el.className='specialDropBanner';el.innerHTML=`<span>${s.icon}</span><div><small>SPECIAL DICE DROP</small><b>${esc(s.name)} を獲得</b></div>`;
    const next=card.querySelector('#nextLoot');card.insertBefore(el,next||null);
  }
  run.pendingSpecialDrop=null;updateDiceSystemUi();
}
function chooseGamblePrediction(){
  injectDiceSystemUi();const dlg=document.getElementById('gambleDialog');
  return new Promise(resolve=>{
    let done=false;const finish=v=>{if(done)return;done=true;dlg.close();resolve(v)};
    dlg.querySelectorAll('[data-gamble]').forEach(b=>b.onclick=()=>finish(Number(b.dataset.gamble)));
    dlg.querySelector('[data-gamble-cancel]').onclick=()=>finish(null);
    dlg.addEventListener('cancel',e=>{e.preventDefault();finish(null)},{once:true});
    dlg.showModal();
  });
}
async function tryRevive(reason=''){
  if(run.hp>0||!run.reviveGuard)return false;
  run.reviveGuard=0;run.hp=10;ui();
  setArena('skillState');
  document.getElementById('skillState').innerHTML='<div class="skillPanel divine"><div class="skillMark">🪽</div><div class="skillMini">SPECIAL DICE TRIGGER</div><div class="skillName">復活のダイス</div><div class="skillDesc">HP10で復活した。</div></div>';
  await wait(850);setArena('enemyState');document.getElementById('msg').textContent=`復活！${reason?' '+reason:''}`;return true;
}
async function finishEnemyRetaliation(){
  if(run.hp<=0){if(await tryRevive('戦闘を継続する。'))return true;gameOver();return false}
  if(run.reviveGuard>0)run.reviveGuard--;
  return true;
}
function merchantEscapes(){
  const rare=run?.rareEncounter;if(!rare||rare.def.key!=='merchant')return false;
  return run.enemyRolls>=Number(rare.def.turnLimit||2)&&ehp>0;
}
async function resolveMerchantEscape(){
  locked=true;document.getElementById('roll').disabled=true;updateDiceSystemUi();
  setArena('enemyState');document.getElementById('msg').textContent='逃走商人は商品を抱えて逃げ去った。';
  await wait(650);run.rareEncounter=null;spawn();
}
function rareDrops(def){
  const result=[],used=new Set(run.loot);
  for(let i=0;i<def.lootCount;i++){
    let pool=(selectedStage.items||[]).filter(x=>rank(x.rarity)>=def.minRarity&&!used.has(x.id));
    if(!pool.length)pool=(selectedStage.items||[]).filter(x=>rank(x.rarity)>=def.minRarity);
    if(!pool.length)pool=selectedStage.items||[];
    if(!pool.length)break;
    const x=pick(pool);result.push(x);used.add(x.id);
  }
  return result;
}
function showRareLootQueue(items,index=0){
  if(!items.length){cont();return}
  const x=items[index];showLoot(x,false);
  const next=document.getElementById('nextLoot');
  if(!next)return;
  if(index<items.length-1){next.textContent=`次の戦利品へ (${index+2}/${items.length})`;next.onclick=()=>showRareLootQueue(items,index+1)}
  else{next.textContent='次へ';next.onclick=cont}
}
async function standardEnemyRetaliation(){
  await wait(260);
  let d=ri(Number(enemy.attack_min),Number(enemy.attack_max));
  if(isBoss){
    const bfx=ensureBossFx();
    if(bfx.deathTurns>0){d=Math.ceil(d*6/5);bfx.deathTurns--;updateBossSkillHud();document.getElementById('msg').textContent=`デスロード。ボスの反撃が増幅され ${d}ダメージ。`}
    else document.getElementById('msg').textContent=`敵の反撃。${d}ダメージ。`;
  }else document.getElementById('msg').textContent=`敵の反撃。${d}ダメージ。`;
  run.hp-=d;ui();await wait(420);
  if(!await finishEnemyRetaliation())return false;
  if(isBoss)await rollBossSkillLottery();
  return true;
}
function damageForTurnDie(d,n){
  if(d.key==='explosion')return n+(n>=4?2:0);
  if(d.key==='minus')return Math.max(0,n-1);
  return n;
}
async function rollCurrentTurnDie(){
  if(locked||run.hp<=0||ehp<=0)return;
  ensureRunDice();const d=run.turnDie||drawTurnDie();run.turnDie=d;
  locked=true;document.getElementById('roll').disabled=true;updateDiceSystemUi();
  const fx=isBoss?beginBossPlayerTurn():null;
  const firstAttack=run.enemyRolls===0;run.enemyRolls++;
  let n;
  if(d.key==='lucky')n=ri(4,6);
  else if(isBoss&&d.key==='normal')n=bossRollValue();
  else n=ri(1,6);
  await showSingleRoll(n);
  run.history.push(n);if(run.history.length>12)run.history.shift();updateComboHud();
  const missed=d.key==='negative'&&Math.random()<.30;
  const sequenceSkill=missed?null:detectSequenceSkill();
  if(fx?.turn?.iron)fx.turn.ironTriggered=predictPlayerSkill(firstAttack,n,sequenceSkill);
  let damage=0;
  if(missed){setArena('enemyState');document.getElementById('msg').textContent='ネガティブダイス。攻撃は外れた。';await wait(400)}
  else{
    damage=damageForTurnDie(d,n);
    if(damage>0)await applyPlayerDamage(damage,`${d.icon} ${d.name}`);
    else{setArena('enemyState');document.getElementById('msg').textContent='マイナスダイス。攻撃力は0になった。';await wait(320)}
    if(d.key==='drain'){
      const before=run.hp;run.hp=Math.min(GAME.maxHp,run.hp+n);ui();document.getElementById('msg').textContent=`ドレインダイス。${damage}ダメージ / HP${run.hp-before}回復。`;await wait(300)
    }
    if(d.key==='revenge'&&n<=2){
      const before=ehp;ehp=Math.min(Number(enemy.hp),ehp+10);ui();document.getElementById('msg').textContent=`復讐のダイス。敵HPが${ehp-before}回復した。`;await wait(350)
    }
    if(sequenceSkill)await resolveSequenceSkill(sequenceSkill);
  }
  if(fx?.turn?.reflect&&d.key==='normal'&&n===6){await showBossTrigger('reflect','出目6を反射。プレイヤーに6ダメージ。');run.hp-=6;ui();document.getElementById('msg').textContent='リフレクト！ プレイヤーに6ダメージ。';await wait(320)}
  if(fx?.turn?.devil&&d.key==='normal'&&n===1){fx.capNext=true;await showBossTrigger('devil','出目1を捕捉。次の通常サイコロは4以下になる。');updateBossSkillHud();document.getElementById('msg').textContent='悪魔の微笑み。次の通常出目は4以下に封じられた。';await wait(280)}
  if(fx?.candleSaved){await showBossTrigger('candle','致死ダメージを耐え、HP1で踏みとどまった。');document.getElementById('msg').textContent='命のともしび。ボスはHP1で耐えた。';await wait(260)}
  finishBossPlayerTurn();
  if(run.hp<=0){if(!await tryRevive()) {gameOver();return}}
  if(ehp<=0){document.getElementById('msg').textContent=`${enemy.name} を撃破！`;ui();await wait(420);showDefeat();return}
  if(firstAttack&&!missed&&n>=5){await showSkill('first');document.getElementById('msg').textContent='先手必勝！ 反撃前にもう一度振れる。';setArena('enemyState');locked=false;document.getElementById('roll').disabled=false;assignTurnDie();ui();return}
  if(merchantEscapes()){await resolveMerchantEscape();return}
  if(!await standardEnemyRetaliation())return;
  setArena('enemyState');locked=false;document.getElementById('roll').disabled=false;assignTurnDie();ui();
}
async function useSpecialDie(key){
  ensureRunDice();const s=SPECIAL_DICE[key];if(!s||locked||!run.specialDice[key]||run.hp<=0||ehp<=0)return;
  if(key==='death'&&(run.hp>5||isBoss))return;
  let prediction=null;
  if(key==='gamble'){prediction=await chooseGamblePrediction();if(!prediction)return}
  if(!consumeSpecialDie(key))return;
  locked=true;document.getElementById('roll').disabled=true;updateDiceSystemUi();
  const fx=isBoss?beginBossPlayerTurn():null;
  run.enemyRolls++;
  if(key==='death'){
    setArena('skillState');document.getElementById('skillState').innerHTML='<div class="skillPanel rage"><div class="skillMark">☠️</div><div class="skillMini">SPECIAL DICE</div><div class="skillName">デスダイス</div><div class="skillDesc">敵HPを0にする。</div></div>';await wait(700);ehp=0;ui();finishBossPlayerTurn();showDefeat();return;
  }
  if(key==='triple'){
    const r=await showMultiRoll(3,'SPECIAL / TRIPLE ROLL');const allSame=r.values.every(v=>v===r.values[0]);
    if(allSame){await applyPlayerDamage(r.sum,'ゾロ目ダイス');document.getElementById('msg').textContent=`ゾロ目成立！ ${r.sum}ダメージ。`}
    else{run.hp-=r.sum;ui();setArena('enemyState');document.getElementById('msg').textContent=`ゾロ目失敗。自分に${r.sum}ダメージ。`;await wait(400)}
  }else{
    const n=ri(1,6);await showSingleRoll(n);
    if(key==='revive'){run.reviveGuard=1;await applyPlayerDamage(n,'復活のダイス');document.getElementById('msg').textContent=`復活のダイス。${n}ダメージ。次の敵ターンまで復活効果。`}
    if(key==='gamble'){
      if(n===prediction){const dmg=Math.ceil(n*1.5);await applyPlayerDamage(dmg,'ギャンブルダイス');document.getElementById('msg').textContent=`予想的中 ${prediction}！ ${dmg}ダメージ。`}
      else{setArena('enemyState');document.getElementById('msg').textContent=`予想${prediction} / 出目${n}。外れ。攻撃できない。`;await wait(400)}
    }
  }
  finishBossPlayerTurn();
  if(run.hp<=0){if(!await tryRevive()){gameOver();return}}
  if(ehp<=0){document.getElementById('msg').textContent=`${enemy.name} を撃破！`;ui();await wait(350);showDefeat();return}
  if(merchantEscapes()){await resolveMerchantEscape();return}
  if(!await standardEnemyRetaliation())return;
  setArena('enemyState');locked=false;document.getElementById('roll').disabled=false;assignTurnDie();ui();
}

const coreSpawnDice=spawn;
spawn=function(){
  ensureRunDice();run.rareEncounter=null;
  if(!bossQ){
    const def=rollRareEnemy();
    if(def){
      const original=selectedStage.enemies;selectedStage.enemies=[rareEnemyObject(def)];
      try{coreSpawnDice()}finally{selectedStage.enemies=original}
      run.rareEncounter={def};
      const sprite=document.getElementById('sprite');if(sprite)sprite.innerHTML=`<span class="rareEnemyEmoji">${def.icon}</span>`;
      document.getElementById('etag').textContent=def.tag;
      document.getElementById('msg').textContent=`${def.name} が出現！ ${def.desc}`;
      assignTurnDie();updateDiceSystemUi();return;
    }
  }
  coreSpawnDice();assignTurnDie();updateDiceSystemUi();
};

const coreWinDice=win;
win=function(){
  ensureRunDice();
  if(isBoss){coreWinDice();return}
  awardSpecialDie();
  if(run.rareEncounter){
    const def=run.rareEncounter.def;run.kills++;const drops=rareDrops(def);run.rareEncounter=null;ui();showRareLootQueue(drops);return;
  }
  coreWinDice();
};

const coreShowLootDice=showLoot;
showLoot=function(x,boss){coreShowLootDice(x,boss);showSpecialDropBanner();updateDiceSystemUi()};
const coreShowPotionDice=showPotion;
showPotion=function(h){coreShowPotionDice(h);if(run?.pendingSpecialDrop){const key=run.pendingSpecialDrop,s=SPECIAL_DICE[key];document.getElementById('potionState')?.insertAdjacentHTML('beforeend',`<div class="specialDropBanner"><span>${s.icon}</span><div><small>SPECIAL DICE DROP</small><b>${esc(s.name)} を獲得</b></div></div>`);run.pendingSpecialDrop=null}updateDiceSystemUi()};

const coreUiDice=ui;
ui=function(){coreUiDice();updateDiceSystemUi()};
const coreStartDice=start;
start=function(){coreStartDice();ensureRunDice();updateDiceSystemUi()};

rollDice=rollCurrentTurnDie;
injectDiceSystemUi();
document.getElementById('roll').onclick=rollDice;
})();