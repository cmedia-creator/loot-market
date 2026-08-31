(function(){
'use strict';

const baseOpenItemDetail=openItemDetail;
openItemDetail=function(id){
  baseOpenItemDetail(id);
  const x=item(id),body=document.getElementById('itemModalBody');
  if(!x||!body||document.getElementById('itemUserActions'))return;
  const box=document.createElement('div');
  box.id='itemUserActions';box.className='lootActions';box.style.marginTop='12px';
  box.innerHTML=`<button class="action ${mem.w.has(id)?'on':''}" id="detailWish" type="button">♡ 欲しい</button><button class="action ${mem.o.has(id)?'on':''}" id="detailOwn" type="button">✓ 持ってる</button><button class="action ${mem.s?.has(id)?'on':''}" id="detailLater" type="button">🔖 あとで見る</button>`;
  const affiliate=body.querySelector('.affiliateNotice,.itemNoLink');
  if(affiliate)body.insertBefore(box,affiliate);else body.appendChild(box);
  const wish=document.getElementById('detailWish'),own=document.getElementById('detailOwn'),later=document.getElementById('detailLater');
  wish.onclick=()=>tog('w',id,wish);
  own.onclick=()=>tog('o',id,own);
  later.onclick=()=>tog('s',id,later);
};

function topWantedCategory(){
  const counts=new Map();
  for(const id of mem.w){const x=item(id);const c=String(x?.category||'').trim();if(c)counts.set(c,(counts.get(c)||0)+1)}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
}
function recommendedStage(category){
  let best=null,bestScore=0;
  for(const s of catalog||[]){const score=(s.items||[]).filter(x=>String(x.category||'').trim()===category).length;if(score>bestScore){best=s;bestScore=score}}
  return bestScore?{stage:best,score:bestScore}:null;
}
function addRecommendation(){
  document.getElementById('wishRecommendation')?.remove();
  if(!window.LootAuth?.user||!mem.w.size)return;
  const category=topWantedCategory();if(!category)return;
  const rec=recommendedStage(category);if(!rec)return;
  const root=document.getElementById('stageList');if(!root)return;
  const note=document.createElement('div');note.id='wishRecommendation';note.className='mission';note.style.gridColumn='1 / -1';
  note.innerHTML=`<div class="k">FOR YOU / WISHLIST</div><b>「${esc(category)}」が気になっているなら ${esc(rec.stage.name)}</b><div class="sub">欲しい登録の傾向から提案。該当商品 ${rec.score}件。</div><button class="btn2" id="wishRecommendationGo" type="button">このダンジョンを見る</button>`;
  root.insertBefore(note,root.firstChild);
  const go=document.getElementById('wishRecommendationGo');
  go.onclick=()=>selectStage(rec.stage.id);
}

const baseRenderStageList=renderStageList;
renderStageList=function(){baseRenderStageList();addRecommendation()};

const baseRender=render;
render=function(){baseRender();if(document.getElementById('stage')?.classList.contains('on'))addRecommendation()};

addRecommendation();
})();
