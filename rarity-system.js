(function(){
'use strict';

const RARITY_DROP_WEIGHTS={1:55,2:27,3:12,4:5,5:1};

function chooseWeightedRarityItem(pool,minRarity=1){
  const valid=(pool||[]).filter(Boolean);
  if(!valid.length)return null;
  const groups=[];
  let total=0;
  for(let rarity=Math.max(1,Number(minRarity)||1);rarity<=5;rarity++){
    const items=valid.filter(x=>rank(x.rarity)===rarity);
    if(!items.length)continue;
    const weight=RARITY_DROP_WEIGHTS[rarity]||0;
    if(weight<=0)continue;
    groups.push({items,weight});
    total+=weight;
  }
  if(!groups.length)return pick(valid);
  let roll=Math.random()*total;
  for(const group of groups){
    roll-=group.weight;
    if(roll<=0)return pick(group.items);
  }
  return pick(groups[groups.length-1].items);
}

// Normal loot uses rarity-band odds rather than item-count odds.
// Guaranteed minimum-rarity rewards keep their minimum and renormalize inside the eligible bands.
dropItem=function(min=1){
  const items=selectedStage?.items||[];
  const used=new Set(run?.loot||[]);
  let pool=items.filter(x=>rank(x.rarity)>=min&&!used.has(x.id));
  if(!pool.length)pool=items.filter(x=>rank(x.rarity)>=min);
  if(!pool.length)pool=items;
  return chooseWeightedRarityItem(pool,min);
};

function sparkleMarkup(count){
  return `<div class="raritySparkles" aria-hidden="true">${Array.from({length:count},(_,i)=>`<i style="--i:${i}">✦</i>`).join('')}</div>`;
}

function decorateLoot(x){
  const rarity=rank(x?.rarity);
  if(rarity<4)return;
  const card=document.querySelector('#lootState .lootCard');
  if(!card)return;
  card.classList.remove('lootRarity4','lootRarity5');
  card.classList.add(rarity>=5?'lootRarity5':'lootRarity4');
  if(!card.querySelector('.raritySparkles'))card.insertAdjacentHTML('afterbegin',sparkleMarkup(rarity>=5?16:8));
  const rar=card.querySelector('.rar');
  if(rar)rar.insertAdjacentHTML('beforeend',` <span class="rarityStars">${'★'.repeat(rarity)}</span>`);
}

function decorateDetail(id){
  const x=item(id),rarity=rank(x?.rarity);
  const sheet=document.querySelector('#itemModal .itemSheet');
  if(!sheet)return;
  sheet.classList.remove('detailRarity4','detailRarity5');
  sheet.querySelector('.raritySparkles')?.remove();
  if(rarity<4)return;
  sheet.classList.add(rarity>=5?'detailRarity5':'detailRarity4');
  sheet.insertAdjacentHTML('afterbegin',sparkleMarkup(rarity>=5?14:7));
}

const baseShowLoot=showLoot;
showLoot=function(x,boss){
  const result=baseShowLoot(x,boss);
  decorateLoot(x);
  return result;
};

if(typeof openItemDetail==='function'){
  const baseOpenItemDetail=openItemDetail;
  openItemDetail=function(id){
    const result=baseOpenItemDetail(id);
    decorateDetail(id);
    return result;
  };
}

window.LOOT_RARITY_ODDS={...RARITY_DROP_WEIGHTS};
})();
