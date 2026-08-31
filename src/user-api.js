import { createAuth } from "./auth.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function currentUser(request, env) {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  return session?.user || null;
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) return { response: json({ ok: false, error: "Unauthorized" }, 401) };
  return { user };
}

function bool(value) {
  return value === true || value === 1 || value === "1";
}

function cleanIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))].slice(0, 500);
}

async function itemExists(env, itemId) {
  return Boolean(await env.DB.prepare("SELECT id FROM items WHERE id = ? AND is_active = 1").bind(itemId).first());
}

async function getCollection(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  const result = await env.DB.prepare(
    `SELECT item_id, discovered_at, wanted, owned, saved, updated_at
       FROM user_item_states
      WHERE user_id = ?
      ORDER BY updated_at DESC`
  ).bind(auth.user.id).all();
  return json({ ok: true, user: { id: auth.user.id, email: auth.user.email }, data: result.results || [] });
}

async function putItemState(request, env, itemId) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  if (!await itemExists(env, itemId)) return json({ ok: false, error: "Item not found" }, 404);

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }

  const old = await env.DB.prepare(
    "SELECT discovered_at, wanted, owned, saved FROM user_item_states WHERE user_id = ? AND item_id = ?"
  ).bind(auth.user.id, itemId).first();

  const discovered = body.discovered === true
    ? (old?.discovered_at || new Date().toISOString())
    : (old?.discovered_at || null);
  const wanted = body.wanted === undefined ? Number(old?.wanted || 0) : Number(bool(body.wanted));
  const owned = body.owned === undefined ? Number(old?.owned || 0) : Number(bool(body.owned));
  const saved = body.saved === undefined ? Number(old?.saved || 0) : Number(bool(body.saved));

  if (!discovered && !wanted && !owned && !saved) {
    await env.DB.prepare("DELETE FROM user_item_states WHERE user_id = ? AND item_id = ?")
      .bind(auth.user.id, itemId).run();
    return json({ ok: true, deleted: true, item_id: itemId });
  }

  await env.DB.prepare(
    `INSERT INTO user_item_states (user_id, item_id, discovered_at, wanted, owned, saved, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, item_id) DO UPDATE SET
       discovered_at = excluded.discovered_at,
       wanted = excluded.wanted,
       owned = excluded.owned,
       saved = excluded.saved,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(auth.user.id, itemId, discovered, wanted, owned, saved).run();

  return json({ ok: true, data: { item_id: itemId, discovered_at: discovered, wanted, owned, saved } });
}

async function mergeGuestCollection(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }

  const discovered = new Set(cleanIds(body.discovered));
  const wanted = new Set(cleanIds(body.wanted));
  const owned = new Set(cleanIds(body.owned));
  const saved = new Set(cleanIds(body.saved));
  const all = [...new Set([...discovered, ...wanted, ...owned, ...saved])];
  if (!all.length) return json({ ok: true, merged: 0 });

  const now = new Date().toISOString();
  const statements = [];
  for (const itemId of all) {
    if (!await itemExists(env, itemId)) continue;
    statements.push(
      env.DB.prepare(
        `INSERT INTO user_item_states (user_id, item_id, discovered_at, wanted, owned, saved, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, item_id) DO UPDATE SET
           discovered_at = COALESCE(user_item_states.discovered_at, excluded.discovered_at),
           wanted = MAX(user_item_states.wanted, excluded.wanted),
           owned = MAX(user_item_states.owned, excluded.owned),
           saved = MAX(user_item_states.saved, excluded.saved),
           updated_at = CURRENT_TIMESTAMP`
      ).bind(
        auth.user.id,
        itemId,
        discovered.has(itemId) ? now : null,
        Number(wanted.has(itemId)),
        Number(owned.has(itemId)),
        Number(saved.has(itemId)),
      )
    );
  }
  if (statements.length) await env.DB.batch(statements);
  return json({ ok: true, merged: statements.length });
}

async function recommendation(request, env) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const favorite = await env.DB.prepare(
    `SELECT i.category AS category, COUNT(*) AS score
       FROM user_item_states u
       JOIN items i ON i.id = u.item_id
      WHERE u.user_id = ? AND u.wanted = 1 AND i.is_active = 1 AND TRIM(i.category) <> ''
      GROUP BY i.category
      ORDER BY score DESC, i.category ASC
      LIMIT 1`
  ).bind(auth.user.id).first();

  if (!favorite?.category) return json({ ok: true, data: null });

  const stage = await env.DB.prepare(
    `SELECT s.id, s.slug, s.name, s.description, COUNT(i.id) AS matching_items
       FROM stages s
       JOIN items i ON i.stage_id = s.id AND i.is_active = 1
      WHERE s.is_active = 1 AND i.category = ?
      GROUP BY s.id, s.slug, s.name, s.description
      ORDER BY matching_items DESC, s.sort_order ASC
      LIMIT 1`
  ).bind(favorite.category).first();

  return json({
    ok: true,
    data: stage ? { category: favorite.category, preference_score: Number(favorite.score || 0), stage } : null,
  });
}

export async function handleUserApi(request, env, url) {
  if (url.pathname === "/api/me/collection" && request.method === "GET") return getCollection(request, env);
  if (url.pathname === "/api/me/collection/merge" && request.method === "POST") return mergeGuestCollection(request, env);
  if (url.pathname === "/api/me/recommendation" && request.method === "GET") return recommendation(request, env);
  if (url.pathname.startsWith("/api/me/items/") && request.method === "PUT") {
    const itemId = decodeURIComponent(url.pathname.slice("/api/me/items/".length));
    if (!itemId) return json({ ok: false, error: "Item id is required" }, 400);
    return putItemState(request, env, itemId);
  }
  return null;
}
