import app from "./index.js";
import { createAuth } from "./auth.js";
import { handleUserApi } from "./user-api.js";
import { getBuiltinMedia } from "./builtin-media.js";

let midnightDungeonEnsured = false;

function mediaUrl(origin, key) {
  if (!key) return "";
  return `${origin}/api/media/${String(key).split("/").map(encodeURIComponent).join("/")}`;
}

function attachImageUrls(data, origin) {
  for (const stage of data || []) {
    if (stage.image_key && !stage.image_url) stage.image_url = mediaUrl(origin, stage.image_key);
    for (const enemy of stage.enemies || []) {
      if (enemy.image_key && !enemy.image_url) enemy.image_url = mediaUrl(origin, enemy.image_key);
    }
    for (const boss of stage.bosses || []) {
      if (boss.image_key && !boss.image_url) boss.image_url = mediaUrl(origin, boss.image_key);
    }
    for (const item of stage.items || []) {
      if (item.image_key && !item.image_url) item.image_url = mediaUrl(origin, item.image_key);
    }
  }
  return data;
}

function itemScore(item) {
  return Number(item.rarity || 0) * 3 + Number(item.weirdness || 0) * 2 + Number(item.gift_power || 0) * 2;
}

function attachMidnightItemPool(data) {
  const stages = Array.isArray(data) ? data : [];
  const midnight = stages.find((stage) => stage.id === "stage-02");
  if (!midnight) return stages;

  const source = stages
    .filter((stage) => stage.id !== "stage-02")
    .flatMap((stage) => stage.items || []);
  const preferred = source.filter((item) =>
    Number(item.rarity) >= 3 || Number(item.weirdness) >= 4 || Number(item.gift_power) >= 4
  );
  const pool = (preferred.length >= 4 ? preferred : source)
    .slice()
    .sort((a, b) => itemScore(b) - itemScore(a) || String(a.id).localeCompare(String(b.id)))
    .slice(0, 12);

  midnight.items = pool;
  return stages;
}

async function ensureMidnightDungeon(env) {
  if (midnightDungeonEnsured || !env.DB) return;
  const ready = await env.DB.prepare(`
    SELECT s.id
      FROM stages s
     WHERE s.id = 'stage-02'
       AND (SELECT COUNT(*) FROM enemies e WHERE e.stage_id = s.id) >= 5
       AND (SELECT COUNT(*) FROM bosses b WHERE b.stage_id = s.id) >= 2
       AND (SELECT COUNT(*) FROM stage_conditions c WHERE c.stage_id = s.id) >= 3
  `).first();
  if (ready) {
    midnightDungeonEnsured = true;
    return;
  }

  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO stages (id,slug,name,description,image_key,sort_order,is_active)
      VALUES ('stage-02','midnight-impulse-graveyard','午前2時の衝動買い墓場','深夜テンションでカートに放り込まれた、妙にレアで妙に欲しくなる品々が漂着するネオン廃モール。ここではやり直しが効かない。','builtin/stage-02/background.svg',2,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO enemies (id,stage_id,name,image_key,hp,attack_min,attack_max,spawn_weight,sort_order,is_active)
      VALUES ('enemy-cart-ghost','stage-02','カートノコシ','builtin/stage-02/cart-ghost.svg',10,1,3,3,1,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO enemies (id,stage_id,name,image_key,hp,attack_min,attack_max,spawn_weight,sort_order,is_active)
      VALUES ('enemy-coupon-bat','stage-02','クーポンコウモリ','builtin/stage-02/coupon-bat.svg',9,1,3,3,2,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO enemies (id,stage_id,name,image_key,hp,attack_min,attack_max,spawn_weight,sort_order,is_active)
      VALUES ('enemy-shipping-slime','stage-02','送料無料スライム','builtin/stage-02/shipping-slime.svg',12,2,3,2,3,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO enemies (id,stage_id,name,image_key,hp,attack_min,attack_max,spawn_weight,sort_order,is_active)
      VALUES ('enemy-review-zombie','stage-02','★1レビュー亡者','builtin/stage-02/review-zombie.svg',13,2,4,2,4,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO enemies (id,stage_id,name,image_key,hp,attack_min,attack_max,spawn_weight,sort_order,is_active)
      VALUES ('enemy-checkout-golem','stage-02','決済ゴーレム','builtin/stage-02/checkout-golem.svg',15,2,4,1,5,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO bosses (id,stage_id,name,image_key,hp,attack_min,attack_max,is_rare,encounter_rate,min_loot_rarity,sort_order,is_active)
      VALUES ('boss-nemurenine','stage-02','深夜通販王 ネムレナイン','builtin/stage-02/nemurenine.svg',34,3,5,0,0.94,3,1,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO bosses (id,stage_id,name,image_key,hp,attack_min,attack_max,is_rare,encounter_rate,min_loot_rarity,sort_order,is_active)
      VALUES ('boss-deadline-reaper','stage-02','返品期限の死神 シメキリ','builtin/stage-02/deadline-reaper.svg',40,3,6,1,0.06,4,2,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO stage_conditions (id,stage_id,type,label,target_value,sort_order,is_active)
      VALUES ('cond-midnight-kill-4','stage-02','kill','買う理由を考える前にザコ敵を4体撃破せよ',4,1,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO stage_conditions (id,stage_id,type,label,target_value,sort_order,is_active)
      VALUES ('cond-midnight-kill-6','stage-02','kill','カートを守り抜きザコ敵を6体撃破せよ',6,2,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO stage_conditions (id,stage_id,type,label,target_value,sort_order,is_active)
      VALUES ('cond-midnight-kill-8','stage-02','kill','午前2時の正気を証明しザコ敵を8体撃破せよ',8,3,1)`),
    env.DB.prepare(`INSERT OR IGNORE INTO stage_game_rules (stage_id,disabled_turn_dice,disabled_special_dice,disabled_combo_skills)
      VALUES ('stage-02','[]','["revive"]','[]')`),
  ]);
  midnightDungeonEnsured = true;
}

function builtinMediaResponse(url) {
  if (!url.pathname.startsWith("/api/media/")) return null;
  const key = decodeURIComponent(url.pathname.slice("/api/media/".length));
  const media = getBuiltinMedia(key);
  if (!media) return null;
  return new Response(media.body, {
    headers: {
      "content-type": media.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const builtin = builtinMediaResponse(url);
      if (builtin) return builtin;
    }

    if (url.pathname === "/api/auth-options" && request.method === "GET") {
      return json({
        email: true,
        google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      });
    }

    if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
      return createAuth(env).handler(request);
    }

    if (url.pathname === "/api/auth-check") {
      const session = await createAuth(env).api.getSession({ headers: request.headers });
      return json({
        ok: true,
        authenticated: Boolean(session?.user),
        user: session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email } : null,
      });
    }

    if (url.pathname === "/api/me" || url.pathname.startsWith("/api/me/")) {
      const handled = await handleUserApi(request, env, url);
      if (handled) return handled;
      return json({ ok: false, error: "Not found" }, 404);
    }

    if (request.method === "GET" && url.pathname === "/api/catalog") {
      await ensureMidnightDungeon(env);
    }

    const response = await app.fetch(request, env, ctx);
    if (request.method !== "GET" || url.pathname !== "/api/catalog" || !response.ok) return response;
    try {
      const payload = await response.clone().json();
      if (!payload?.ok || !Array.isArray(payload.data)) return response;
      payload.data = attachMidnightItemPool(payload.data);
      payload.data = attachImageUrls(payload.data, url.origin);
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      headers.set("cache-control", "no-store");
      return new Response(JSON.stringify(payload), { status: response.status, headers });
    } catch {
      return response;
    }
  }
};
