const BOSS_SKILLS={
  reflect:{name:'リフレクト',mark:'↩',desc:'次のプレイヤーターン、通常サイコロの出目が6ならプレイヤー自身が6ダメージを受ける。',tone:'reflect'},
  candle:{name:'命のともしび',mark:'♨',desc:'次のプレイヤーターン中、ボスHPが0以下になるダメージを受けてもHP1で耐える。',tone:'candle'},
  devil:{name:'悪魔の微笑み',mark:'☾',desc:'次のプレイヤーターンで通常サイコロが1なら、その次の通常サイコロは4以下になる。',tone:'devil'},
  iron:{name:'鉄壁',mark:'◆',desc:'次のプレイヤーターンでプレイヤースキルが発動した場合、そのターン中にボスが受けるダメージを半減する。',tone:'iron'},
  hado:{name:'覇道',mark:'♜',desc:'毎ボスターン0.01%で発動。2ターンの間、プレイヤーの通常サイコロの出目を2に固定する。',tone:'hado'},
  death:{name:'デスロード',mark:'☠',desc:'毎ボスターン0.02%で発動。次の2回のボス反撃ダメージが6/5倍になる。',tone:'death'},
  cap:{name:'悪魔の微笑み・呪い',mark:'⌄',desc:'次の通常サイコロは必ず4以下になる。',tone:'devil'}
};
const COMMON_BOSS_SKILL_RATE=.24;

function ensureBossFx(){
  if(!run)return null;
  if(!run.bossFx||run.bossFxBossId!==run.boss?.id){
    run.bossFxBossId=run.boss?.id||null;
    run.bossFx={reflectReady:false,candleReady:false,devilReady:false,ironReady:false,hadoTurns:0,deathTurns:0,capNext:false,turn:null,candleSaved:false};
  }
  return run.bossFx;
}
function injectBossSkillUi(){
  const combo=$('.comboHud');
  if(combo&&!$('#bossSkillHud'))combo.insertAdjacentHTML('afterend','<div id="bossSkillHud" class="bossSkillHud hide"><div class="bossSkillLabel">BOSS SKILL / ACTIVE</div><div id="bossSkillChips" class="bossSkillChips"></div></div>');
  if(!$('#bossSkillDialog'))document.body.insertAdjacentHTML('beforeend','<dialog id="bossSkillDialog" class="bossSkillDialog"><button type="button" class="bossSkillClose" aria-label="閉じる">×</button><div id="bossSkillDialogMark" class="bossSkillDialogMark"></div><div id="bossSkillDialogName" class="bossSkillDialogName"></div><div id="bossSkillDialogDesc" class="bossSkillDialogDesc"></div><button type="button" class="btn2 bossSkillOk">閉じる</button></dialog>');
  const dlg=$('#bossSkillDialog');
  if(dlg){$('.bossSkillClose').onclick=()=>dlg.close();$('.bossSkillOk').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()})}
}
function bossActiveEntries(){
  if(!isBoss||!run)return[];
  const fx=ensureBossFx(),out=[];
  if(fx.reflectReady)out.push(['reflect','NEXT']);
  if(fx.candleReady)out.push(['candle','NEXT']);
  if(fx.devilReady)out.push(['devil','NEXT']);
  if(fx.ironReady)out.push(['iron','NEXT']);
  if(fx.hadoTurns>0)out.push(['hado',`${fx.hadoTurns}T`]);
  if(fx.deathTurns>0)out.push(['death',`${fx.deathTurns}T`]);
  if(fx.capNext)out.push(['cap','NEXT']);
  if(fx.turn?.reflect)out.push(['reflect','NOW']);
  if(fx.turn?.candle)out.push(['candle','NOW']);
  if(fx.turn?.devil)out.push(['devil','NOW']);
  if(fx.turn?.iron)out.push(['iron','NOW']);
  return out.filter((x,i,a)=>a.findIndex(y=>y[0]===x[0]&&y[1]===x[1])===i);
}
function updateBossSkillHud(){
  injectBossSkillUi();
  const hud=$('#bossSkillHud'),chips=$('#bossSkillChips');
  if(!hud||!chips)return;
  const entries=bossActiveEntries();
  hud.classList.toggle('hide',!isBoss||!entries.length);
  chips.innerHTML=entries.map(([key,badge])=>{const s=BOSS_SKILLS[key];return `<button type="button" class="bossSkillChip ${s.tone}" data-boss-skill="${key}"><span>${s.mark} ${s.name}</span><b>${badge}</b></button>`}).join('');
  $$('#bossSkillChips [data-boss-skill]').forEach(btn=>btn.onclick=()=>openBossSkillDetail(btn.dataset.bossSkill));
}
function openBossSkillDetail(key){
  const s=BOSS_SKILLS[key];if(!s)return;injectBossSkillUi();
  $('#bossSkillDialog').className=`bossSkillDialog ${s.tone}`;
  $('#bossSkillDialogMark').textContent=s.mark;
  $('#bossSkillDialogName').textContent=s.name;
  $('#bossSkillDialogDesc').textContent=s.desc;
  $('#bossSkillDialog').showModal();
}
async function showBossSkill(key){
  const s=BOSS_SKILLS[key];if(!s)return;
  setArena('skillState');
  $('#skillState').innerHTML=`<div class="skillPanel bossCast ${s.tone}"><div class="skillMark">${s.mark}</div><div class="skillMini">BOSS SKILL ACTIVATED</div><div class="skillName">${s.name}</div><div class="skillDesc">${s.desc}</div></div>`;
  await wait(1250);
}
async function showBossTrigger(key,text){
  const s=BOSS_SKILLS[key];if(!s)return;
  setArena('skillState');
  $('#skillState').innerHTML=`<div class="skillPanel bossTrigger ${s.tone}"><div class="skillMark">${s.mark}</div><div class="skillMini">BOSS SKILL TRIGGER</div><div class="skillName">${s.name}</div><div class="skillDesc">${esc(text||s.desc)}</div></div>`;
  await wait(850);
}
function beginBossPlayerTurn(){
  if(!isBoss)return null;
  const fx=ensureBossFx();
  fx.turn={reflect:fx.reflectReady,candle:fx.candleReady,devil:fx.devilReady,iron:fx.ironReady,ironTriggered:false};
  fx.reflectReady=fx.candleReady=fx.devilReady=fx.ironReady=false;
  fx.candleSaved=false;
  updateBossSkillHud();
  return fx;
}
function finishBossPlayerTurn(){
  if(!isBoss||!run)return;
  const fx=ensureBossFx();fx.turn=null;fx.candleSaved=false;updateBossSkillHud();
}
function bossRollValue(){
  if(!isBoss)return ri(1,6);
  const fx=ensureBossFx();
  const hadCap=fx.capNext;
  fx.capNext=false;
  let n;
  if(fx.hadoTurns>0){n=2;fx.hadoTurns--}
  else n=ri(1,hadCap?4:6);
  updateBossSkillHud();
  return n;
}
function predictPlayerSkill(firstAttack,n,sequenceSkill){return Boolean(sequenceSkill||(firstAttack&&n>=5))}
async function rollBossSkillLottery(){
  if(!isBoss||!run||ehp<=0)return;
  const fx=ensureBossFx();
  const r=Math.random();
  let key=null;
  if(r<.0001)key='hado';
  else if(r<.0003)key='death';
  else if(r<.0003+COMMON_BOSS_SKILL_RATE){
    const pool=['reflect','candle','devil','iron'].filter(k=>!fx[`${k}Ready`]);
    if(pool.length)key=pick(pool);
  }
  if(!key)return;
  if(key==='hado')fx.hadoTurns=2;
  else if(key==='death')fx.deathTurns=2;
  else fx[`${key}Ready`]=true;
  updateBossSkillHud();
  await showBossSkill(key);
  setArena('enemyState');
  $('#msg').textContent=`${enemy.name} が「${BOSS_SKILLS[key].name}」を発動。効果は上のBOSS SKILLから確認できる。`;
  await wait(300);
}

const coreSpawn=spawn;
spawn=function(){
  coreSpawn();
  if(isBoss){ensureBossFx();updateBossSkillHud()}
  else if($('#bossSkillHud'))$('#bossSkillHud').classList.add('hide');
};

applyPlayerDamage=async function(base,label='攻撃'){
  const result=consumePower(base);
  let damage=result.damage;
  const fx=isBoss?ensureBossFx():null;
  if(fx?.turn?.iron&&fx.turn.ironTriggered)damage=Math.max(1,Math.ceil(damage/2));
  ehp-=damage;
  if(fx?.turn?.candle&&ehp<=0){ehp=1;fx.candleSaved=true}
  setArena('enemyState');
  $('#enemyState').className='state enemyState on enemyHit';
  $('#msg').textContent=`${label} ${damage}ダメージ${result.boosted?'！ POWER ×2':''}${fx?.turn?.iron&&fx.turn.ironTriggered?' / 鉄壁で半減':''}`;
  ui();await wait(330);$('#enemyState').className='state enemyState on';
  return damage;
};

const coreUi=ui;
ui=function(){coreUi();updateBossSkillHud()};

rollDice=async function(){
  if(locked||run.hp<=0||ehp<=0)return;
  locked=true;$('#roll').disabled=true;
  const fx=isBoss?beginBossPlayerTurn():null;
  const firstAttack=run.enemyRolls===0;run.enemyRolls++;
  const n=isBoss?bossRollValue():ri(1,6);
  await showSingleRoll(n);
  run.history.push(n);if(run.history.length>12)run.history.shift();updateComboHud();
  const sequenceSkill=detectSequenceSkill();
  if(fx?.turn?.iron)fx.turn.ironTriggered=predictPlayerSkill(firstAttack,n,sequenceSkill);
  await applyPlayerDamage(n,`🎲 ${n}`);
  if(sequenceSkill)await resolveSequenceSkill(sequenceSkill);

  if(fx?.turn?.reflect&&n===6){
    await showBossTrigger('reflect','出目6を反射。プレイヤーに6ダメージ。');
    run.hp-=6;ui();$('#msg').textContent='リフレクト！ プレイヤーに6ダメージ。';await wait(320);
  }
  if(fx?.turn?.devil&&n===1){
    fx.capNext=true;await showBossTrigger('devil','出目1を捕捉。次の通常サイコロは4以下になる。');
    updateBossSkillHud();$('#msg').textContent='悪魔の微笑み。次の出目は4以下に封じられた。';await wait(280);
  }
  if(fx?.candleSaved){await showBossTrigger('candle','致死ダメージを耐え、HP1で踏みとどまった。');$('#msg').textContent='命のともしび。ボスはHP1で耐えた。';await wait(260)}

  finishBossPlayerTurn();
  if(run.hp<=0){gameOver();return}
  if(ehp<=0){$('#msg').textContent=`${enemy.name} を撃破！`;ui();await wait(420);showDefeat();return}
  if(firstAttack&&n>=5){await showSkill('first');$('#msg').textContent='先手必勝！ 反撃前にもう一度振れる。';setArena('enemyState');locked=false;$('#roll').disabled=false;ui();return}

  await wait(260);
  let d=ri(Number(enemy.attack_min),Number(enemy.attack_max));
  if(isBoss){
    const bfx=ensureBossFx();
    if(bfx.deathTurns>0){d=Math.ceil(d*6/5);bfx.deathTurns--;updateBossSkillHud();$('#msg').textContent=`デスロード。ボスの反撃が増幅され ${d}ダメージ。`}
    else $('#msg').textContent=`敵の反撃。${d}ダメージ。`;
  }else $('#msg').textContent=`敵の反撃。${d}ダメージ。`;
  run.hp-=d;ui();await wait(420);
  if(run.hp<=0){gameOver();return}
  if(isBoss)await rollBossSkillLottery();
  setArena('enemyState');locked=false;$('#roll').disabled=false;ui();
};

injectBossSkillUi();
$('#roll').onclick=rollDice;
