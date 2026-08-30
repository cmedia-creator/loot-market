const AFFILIATE_DISCLOSURE='このリンクはアフィリエイトリンクです。リンク経由の購入等により当サイトに報酬が発生する場合があります。';

function providerLabel(v){return({rakuten:'楽天',mercari:'メルカリ',other:'その他'})[String(v||'').toLowerCase()]||String(v||'')}
function yen(v){const n=Number(v);return Number.isFinite(n)&&n>0?`¥${Math.round(n).toLocaleString('ja-JP')}`:''}

function ensureItemModal(){
  if(document.getElementById('itemModal'))return;
  const modal=document.createElement('div');
  modal.id='itemModal';
  modal.className='itemModal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','itemModalName');
  modal.innerHTML='<div class="itemSheet"><div class="itemModalTop"><div class="itemModalLabel">DISCOVERED ITEM / DETAIL</div><button class="itemClose" id="itemModalClose" type="button" aria-label="閉じる">×</button></div><div id="itemModalBody"></div></div>';
  document.body.appendChild(modal);
  document.getElementById('itemModalClose').addEventListener('click',closeItemDetail);
  modal.addEventListener('click',e=>{if(e.target===modal)closeItemDetail()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('on'))closeItemDetail()});
}

function closeItemDetail(){
  const modal=document.getElementById('itemModal');
  if(!modal)return;
  modal.classList.remove('on');
  document.body.style.overflow='';
}

function openItemDetail(id){
  ensureItemModal();
  const x=item(id);
  if(!x)return;
  const src=imgSrc(x),shop=safeUrl(x.affiliate_url),rarity=RARITY[rank(x.rarity)]||'UNKNOWN';
  const price=yen(x.price_yen),provider=providerLabel(x.provider),category=String(x.category||'').trim();
  const body=document.getElementById('itemModalBody');
  body.innerHTML=`
    <div class="itemHero">${src?`<img src="${esc(src)}" alt="${esc(x.name)}">`:'<div class="itemHeroFallback">📦</div>'}</div>
    <span class="itemDetailRarity">${esc(rarity)}</span>
    <div class="itemDetailName" id="itemModalName">${esc(x.name)}</div>
    <div class="itemDetailMeta">${category?`<span class="itemMetaChip">${esc(category)}</span>`:''}${provider?`<span class="itemMetaChip">${esc(provider)}</span>`:''}</div>
    <div class="itemDetailDesc">${esc(x.description||'この戦利品の説明はまだ登録されていません。')}</div>
    <div class="itemDetailMetrics">
      <div class="itemDetailMetric"><small>意味不明</small><strong>${stars(x.weirdness)}</strong></div>
      <div class="itemDetailMetric"><small>実用性</small><strong>${stars(x.usefulness)}</strong></div>
      <div class="itemDetailMetric"><small>プレゼント力</small><strong>${stars(x.gift_power)}</strong></div>
    </div>
    ${price?`<div class="itemPrice">参考価格 ${esc(price)}</div>`:''}
    ${shop?`<div class="affiliateNotice"><strong>PR / アフィリエイトリンク</strong><br>${esc(AFFILIATE_DISCLOSURE)}</div><a class="itemAffiliateButton" href="${esc(shop)}" target="_blank" rel="nofollow sponsored noopener">実物を見る ↗</a>`:'<div class="itemNoLink">現在、購入リンクは登録されていません。</div>'}
  `;
  const modal=document.getElementById('itemModal');
  modal.classList.add('on');
  document.body.style.overflow='hidden';
  document.getElementById('itemModalClose').focus();
}

render=function(){
  bookBadge.textContent='図鑑 '+mem.d.size+' / '+allItems.length;
  const arr=[...mem[tab]].map(item).filter(Boolean);
  collection.innerHTML=arr.length?arr.map(x=>{
    const src=imgSrc(x),rarity=RARITY[rank(x.rarity)]||'UNKNOWN';
    return `<div class="mini"><button class="miniTap" type="button" data-item-id="${esc(x.id)}" aria-label="${esc(x.name)}の詳細を見る"><div class="miniPic">${src?`<img src="${esc(src)}" alt="">`:'📦'}</div><div class="miniBody">${esc(x.name)}<div class="sub">${rarity} / 意味不明★${Number(x.weirdness)||0}</div><div class="miniHint">タップして詳細を見る ›</div></div></button></div>`;
  }).join(''):'<div class="empty">まだ何もない。</div>';
};

showLoot=function(x,boss){
  run.loot.push(x.id);mem.d.add(x.id);save();render();
  const src=imgSrc(x),shop=safeUrl(x.affiliate_url),rarity=RARITY[rank(x.rarity)]||'UNKNOWN';
  $('#lootState').innerHTML=`<div class="lootCard"><div class="lootTop"><div class="lootIcon">${src?`<img src="${esc(src)}" alt="">`:'📦'}</div><div class="lootInfo"><span class="rar">${rarity}${boss?' ・ BOSS LOOT':''}</span><div class="iname">${esc(x.name)}</div><div class="lootDesc">${esc(x.description||x.category||x.provider||'実在商品')}</div></div></div><div class="metrics"><div class="metric"><small>意味不明</small><strong>${stars(x.weirdness)}</strong></div><div class="metric"><small>実用性</small><strong>${stars(x.usefulness)}</strong></div><div class="metric"><small>プレゼント力</small><strong>${stars(x.gift_power)}</strong></div></div><div class="lootActions"><button class="action ${mem.w.has(x.id)?'on':''}" id="wish">♡ 欲しい</button><button class="action ${mem.o.has(x.id)?'on':''}" id="own">✓ 持ってる</button></div>${shop?`<div class="affiliateNotice"><strong>PR / アフィリエイトリンク</strong><br>${esc(AFFILIATE_DISCLOSURE)}</div><a class="shopLink" href="${esc(shop)}" target="_blank" rel="nofollow sponsored noopener">実物を見る ↗</a>`:''}<button class="btn2" id="lootDetail" type="button">アイテム詳細を見る</button><button class="btn2" id="nextLoot">${boss?'クリア結果へ':'次へ'}</button></div>`;
  setArena('lootState');
  $('#wish').onclick=()=>tog('w',x.id,$('#wish'));
  $('#own').onclick=()=>tog('o',x.id,$('#own'));
  $('#lootDetail').onclick=()=>openItemDetail(x.id);
  $('#nextLoot').onclick=boss?clearStage:cont;
  $('#msg').textContent='戦利品を獲得。';
};

ensureItemModal();
collection.addEventListener('click',e=>{const b=e.target.closest('[data-item-id]');if(b)openItemDetail(b.dataset.itemId)});
render();
