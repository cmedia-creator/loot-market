const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders, ...extra }
  });
}

function adminAuthorized(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  return request.headers.get("Authorization") === `Bearer ${env.ADMIN_TOKEN}`;
}

function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return json({ ok: false, error: "Admin writes are disabled until ADMIN_TOKEN is configured." }, 503);
  }
  if (!adminAuthorized(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  return null;
}

async function readJson(request) {
  try { return await request.json(); }
  catch { throw new Error("Invalid JSON body"); }
}

const SPECS = {
  stages: {
    table: "stages",
    prefix: "stg",
    order: "sort_order ASC, created_at ASC",
    fields: ["slug","name","description","image_key","sort_order","is_active"],
    required: ["slug","name"],
    defaults: { description:"", image_key:null, sort_order:0, is_active:1 },
    filters: ["is_active","slug"]
  },
  enemies: {
    table: "enemies",
    prefix: "enm",
    order: "stage_id ASC, sort_order ASC, created_at ASC",
    fields: ["stage_id","name","image_key","hp","attack_min","attack_max","spawn_weight","sort_order","is_active"],
    required: ["stage_id","name","hp","attack_min","attack_max"],
    defaults: { image_key:null, spawn_weight:1, sort_order:0, is_active:1 },
    filters: ["stage_id","is_active"]
  },
  bosses: {
    table: "bosses",
    prefix: "bos",
    order: "stage_id ASC, is_rare ASC, sort_order ASC, created_at ASC",
    fields: ["stage_id","name","image_key","hp","attack_min","attack_max","is_rare","encounter_rate","min_loot_rarity","sort_order","is_active"],
    required: ["stage_id","name","hp","attack_min","attack_max"],
    defaults: { image_key:null, is_rare:0, encounter_rate:1, min_loot_rarity:3, sort_order:0, is_active:1 },
    filters: ["stage_id","is_rare","is_active"]
  },
  items: {
    table: "items",
    prefix: "itm",
    order: "stage_id ASC, created_at DESC",
    fields: ["stage_id","name","category","provider","affiliate_url","affiliate_source_html","image_url","image_key","price_yen","rarity","weirdness","usefulness","gift_power","description","is_active"],
    required: ["stage_id","name","provider","rarity","weirdness","usefulness","gift_power"],
    defaults: { category:"", affiliate_url:"", affiliate_source_html:"", image_url:"", image_key:null, price_yen:null, description:"", is_active:1 },
    filters: ["stage_id","provider","rarity","is_active"]
  },
  conditions: {
    table: "stage_conditions",
    prefix: "con",
    order: "stage_id ASC, sort_order ASC, created_at ASC",
    fields: ["stage_id","type","label","target_value","sort_order","is_active"],
    required: ["stage_id","type","label","target_value"],
    defaults: { sort_order:0, is_active:1 },
    filters: ["stage_id","type","is_active"]
  }
};

const INT_FIELDS = new Set([
  "sort_order","is_active","hp","attack_min","attack_max","spawn_weight","is_rare",
  "min_loot_rarity","price_yen","rarity","weirdness","usefulness","gift_power","target_value"
]);
const REAL_FIELDS = new Set(["encounter_rate"]);
const STAGE_RULE_ALLOWED = {
  disabled_turn_dice: new Set(["explosion","lucky","drain","minus","negative","revenge"]),
  disabled_special_dice: new Set(["revive","gamble","triple","death"]),
  disabled_combo_skills: new Set(["rescue","beloved","blessing","theory","first"])
};

function normalizeValue(field, value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") {
    if (["image_key","price_yen"].includes(field)) return null;
    if (["affiliate_url","affiliate_source_html","image_url","category","description"].includes(field)) return "";
  }
  if (INT_FIELDS.has(field)) {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new Error(`${field} must be an integer`);
    return n;
  }
  if (REAL_FIELDS.has(field)) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
    return n;
  }
  return typeof value === "string" ? value.trim() : value;
}

function validateRanges(resource, row) {
  const starFields = ["rarity","weirdness","usefulness","gift_power","min_loot_rarity"];
  for (const f of starFields) {
    if (row[f] !== undefined && row[f] !== null && (row[f] < 1 || row[f] > 5)) throw new Error(`${f} must be 1-5`);
  }
  if (row.hp !== undefined && row.hp <= 0) throw new Error("hp must be greater than 0");
  if (row.attack_min !== undefined && row.attack_min < 0) throw new Error("attack_min must be 0 or greater");
  if (row.attack_max !== undefined && row.attack_max < 0) throw new Error("attack_max must be 0 or greater");
  if (row.attack_min !== undefined && row.attack_max !== undefined && row.attack_min > row.attack_max) throw new Error("attack_min cannot exceed attack_max");
  if (row.encounter_rate !== undefined && (row.encounter_rate < 0 || row.encounter_rate > 1)) throw new Error("encounter_rate must be between 0 and 1");
  if (row.target_value !== undefined && row.target_value <= 0) throw new Error("target_value must be greater than 0");
  if (resource === "items" && row.provider !== undefined && !["rakuten","mercari","other"].includes(row.provider)) throw new Error("provider must be rakuten, mercari, or other");
}

function normalizeCreate(resource, body) {
  const spec = SPECS[resource];
  const row = { ...spec.defaults };
  for (const field of spec.fields) {
    if (body[field] !== undefined) row[field] = normalizeValue(field, body[field]);
  }
  for (const field of spec.required) {
    if (row[field] === undefined || row[field] === null || row[field] === "") throw new Error(`${field} is required`);
  }
  validateRanges(resource, row);
  return row;
}

function normalizeUpdate(resource, body) {
  const spec = SPECS[resource];
  const row = {};
  for (const field of spec.fields) {
    if (body[field] !== undefined) row[field] = normalizeValue(field, body[field]);
  }
  if (!Object.keys(row).length) throw new Error("No updatable fields supplied");
  validateRanges(resource, row);
  return row;
}

function selectColumns(resource, includeAdmin) {
  if (resource !== "items" || includeAdmin) return "*";
  return "id,stage_id,name,category,provider,affiliate_url,image_url,image_key,price_yen,rarity,weirdness,usefulness,gift_power,description,is_active,created_at,updated_at";
}

async function listResource(request, env, resource, url) {
  const spec = SPECS[resource];
  const clauses = [];
  const values = [];
  for (const field of spec.filters) {
    if (url.searchParams.has(field)) {
      clauses.push(`${field} = ?`);
      values.push(normalizeValue(field, url.searchParams.get(field)));
    }
  }
  const q = url.searchParams.get("q")?.trim();
  if (q && spec.fields.includes("name")) {
    clauses.push("name LIKE ?");
    values.push(`%${q}%`);
  }
  const sql = `SELECT ${selectColumns(resource, adminAuthorized(request, env))} FROM ${spec.table}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY ${spec.order}`;
  const stmt = env.DB.prepare(sql).bind(...values);
  const result = await stmt.all();
  return json({ ok: true, data: result.results || [] });
}

async function getResource(request, env, resource, id) {
  const spec = SPECS[resource];
  const row = await env.DB.prepare(`SELECT ${selectColumns(resource, adminAuthorized(request, env))} FROM ${spec.table} WHERE id = ?`).bind(id).first();
  if (!row) return json({ ok:false, error:"Not found" }, 404);
  return json({ ok:true, data:row });
}

async function createResource(request, env, resource) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const body = await readJson(request);
  const spec = SPECS[resource];
  const row = normalizeCreate(resource, body);
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `${spec.prefix}_${crypto.randomUUID()}`;
  const cols = ["id", ...Object.keys(row)];
  const placeholders = cols.map(() => "?").join(",");
  await env.DB.prepare(`INSERT INTO ${spec.table} (${cols.join(",")}) VALUES (${placeholders})`).bind(id, ...Object.values(row)).run();
  return getResource(request, env, resource, id);
}

async function updateResource(request, env, resource, id) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const body = await readJson(request);
  const spec = SPECS[resource];
  const row = normalizeUpdate(resource, body);
  const entries = Object.entries(row);
  const set = entries.map(([k]) => `${k} = ?`).join(", ");
  const result = await env.DB.prepare(`UPDATE ${spec.table} SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(...entries.map(([,v])=>v), id).run();
  if (!result.meta?.changes) return json({ ok:false, error:"Not found" }, 404);
  return getResource(request, env, resource, id);
}

async function deleteResource(request, env, resource, id) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const spec = SPECS[resource];
  const result = await env.DB.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).bind(id).run();
  if (!result.meta?.changes) return json({ ok:false, error:"Not found" }, 404);
  return json({ ok:true, deleted:id });
}

function parseRuleArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}

function normalizeRuleArray(field, value) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const allowed = STAGE_RULE_ALLOWED[field];
  const result = [];
  for (const raw of value) {
    const key = String(raw || "").trim();
    if (!allowed.has(key)) throw new Error(`Unknown ${field} value: ${key}`);
    if (!result.includes(key)) result.push(key);
  }
  return result;
}

function rulePayload(row = {}) {
  return {
    disabled_turn_dice: parseRuleArray(row.disabled_turn_dice),
    disabled_special_dice: parseRuleArray(row.disabled_special_dice),
    disabled_combo_skills: parseRuleArray(row.disabled_combo_skills)
  };
}

async function listStageRules(request, env) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const result = await env.DB.prepare(`
    SELECT s.id AS stage_id, s.name, s.slug, s.is_active,
      COALESCE(r.disabled_turn_dice, '[]') AS disabled_turn_dice,
      COALESCE(r.disabled_special_dice, '[]') AS disabled_special_dice,
      COALESCE(r.disabled_combo_skills, '[]') AS disabled_combo_skills,
      r.updated_at
    FROM stages s
    LEFT JOIN stage_game_rules r ON r.stage_id = s.id
    ORDER BY s.sort_order, s.created_at
  `).all();
  return json({ ok:true, data:(result.results || []).map(row => ({ ...row, ...rulePayload(row) })) });
}

async function upsertStageRules(request, env, stageId) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const stage = await env.DB.prepare("SELECT id FROM stages WHERE id = ?").bind(stageId).first();
  if (!stage) return json({ ok:false, error:"Stage not found" }, 404);
  const body = await readJson(request);
  const turn = normalizeRuleArray("disabled_turn_dice", body.disabled_turn_dice || []);
  const special = normalizeRuleArray("disabled_special_dice", body.disabled_special_dice || []);
  const combo = normalizeRuleArray("disabled_combo_skills", body.disabled_combo_skills || []);
  await env.DB.prepare(`
    INSERT INTO stage_game_rules (stage_id, disabled_turn_dice, disabled_special_dice, disabled_combo_skills)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(stage_id) DO UPDATE SET
      disabled_turn_dice = excluded.disabled_turn_dice,
      disabled_special_dice = excluded.disabled_special_dice,
      disabled_combo_skills = excluded.disabled_combo_skills,
      updated_at = CURRENT_TIMESTAMP
  `).bind(stageId, JSON.stringify(turn), JSON.stringify(special), JSON.stringify(combo)).run();
  const row = await env.DB.prepare("SELECT * FROM stage_game_rules WHERE stage_id = ?").bind(stageId).first();
  return json({ ok:true, data:{ stage_id:stageId, ...rulePayload(row), updated_at:row?.updated_at || null } });
}

async function catalog(env) {
  const statements = [
    env.DB.prepare("SELECT * FROM stages WHERE is_active = 1 ORDER BY sort_order, created_at"),
    env.DB.prepare("SELECT * FROM enemies WHERE is_active = 1 ORDER BY stage_id, sort_order, created_at"),
    env.DB.prepare("SELECT * FROM bosses WHERE is_active = 1 ORDER BY stage_id, is_rare, sort_order, created_at"),
    env.DB.prepare("SELECT id,stage_id,name,category,provider,affiliate_url,image_url,image_key,price_yen,rarity,weirdness,usefulness,gift_power,description,is_active,created_at,updated_at FROM items WHERE is_active = 1 ORDER BY stage_id, created_at DESC"),
    env.DB.prepare("SELECT * FROM stage_conditions WHERE is_active = 1 ORDER BY stage_id, sort_order, created_at")
  ];
  const [stages,enemies,bosses,items,conditions] = await env.DB.batch(statements);
  let ruleRows = [];
  try {
    const rules = await env.DB.prepare("SELECT * FROM stage_game_rules").all();
    ruleRows = rules.results || [];
  } catch (error) {
    if (!/no such table: stage_game_rules/i.test(String(error?.message || error))) throw error;
  }
  const ruleMap = new Map(ruleRows.map(row => [row.stage_id, rulePayload(row)]));
  const stageRows = stages.results || [];
  const byStage = new Map(stageRows.map(s => [s.id, { ...s, rules:ruleMap.get(s.id) || rulePayload(), enemies:[], bosses:[], items:[], conditions:[] }]));
  for (const row of enemies.results || []) byStage.get(row.stage_id)?.enemies.push(row);
  for (const row of bosses.results || []) byStage.get(row.stage_id)?.bosses.push(row);
  for (const row of items.results || []) byStage.get(row.stage_id)?.items.push(row);
  for (const row of conditions.results || []) byStage.get(row.stage_id)?.conditions.push(row);
  return json({ ok:true, data:[...byStage.values()] });
}

function mediaKeyUrl(origin, key) {
  return `${origin}/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function uploadMedia(request, env, url) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return json({ ok:false, error:"file is required" }, 400);
  const allowed = new Set(["image/webp","image/jpeg","image/png","image/avif"]);
  if (!allowed.has(file.type)) return json({ ok:false, error:"Unsupported image type" }, 415);
  if (file.size > 2_000_000) return json({ ok:false, error:"Image is too large. Compress it below 2 MB before upload." }, 413);
  const folderRaw = String(form.get("folder") || "misc").toLowerCase();
  const folder = folderRaw.replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "misc";
  const ext = ({"image/webp":"webp","image/jpeg":"jpg","image/png":"png","image/avif":"avif"})[file.type];
  const date = new Date().toISOString().slice(0,7);
  const key = `${folder}/${date}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType:file.type, cacheControl:"public, max-age=31536000, immutable" },
    customMetadata: { uploadedAt:new Date().toISOString(), originalName:String(file.name || "") }
  });
  return json({ ok:true, key, url:mediaKeyUrl(url.origin, key), bytes:file.size, contentType:file.type }, 201);
}

async function serveMedia(env, key) {
  const object = await env.MEDIA.get(key);
  if (!object) return json({ ok:false, error:"Media not found" }, 404);
  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function deleteMedia(request, env, key) {
  const denied = requireAdmin(request, env); if (denied) return denied;
  await env.MEDIA.delete(key);
  return json({ ok:true, deleted:key });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status:204, headers:corsHeaders });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health" || url.pathname === "/api/health") {
        return json({ ok:true, service:"loot-market-api", bindings:{ DB:Boolean(env.DB), MEDIA:Boolean(env.MEDIA) }, adminWrites:Boolean(env.ADMIN_TOKEN) });
      }
      if (!env.DB || !env.MEDIA) return json({ ok:false, error:"Required Cloudflare bindings are missing" }, 503);
      if (url.pathname === "/api/catalog" && request.method === "GET") return catalog(env);
      if (url.pathname === "/api/stage-rules" && request.method === "GET") return listStageRules(request, env);
      if (url.pathname.startsWith("/api/stage-rules/")) {
        const stageId = decodeURIComponent(url.pathname.slice("/api/stage-rules/".length));
        if (!stageId) return json({ ok:false, error:"Stage id is required" }, 400);
        if (request.method === "PUT" || request.method === "PATCH") return upsertStageRules(request, env, stageId);
      }
      if (url.pathname === "/api/media" && request.method === "POST") return uploadMedia(request, env, url);
      if (url.pathname.startsWith("/api/media/")) {
        const key = decodeURIComponent(url.pathname.slice("/api/media/".length));
        if (!key) return json({ ok:false, error:"Media key is required" }, 400);
        if (request.method === "GET") return serveMedia(env, key);
        if (request.method === "DELETE") return deleteMedia(request, env, key);
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "api" && SPECS[parts[1]]) {
        const resource = parts[1];
        const id = parts[2];
        if (!id && request.method === "GET") return listResource(request, env, resource, url);
        if (!id && request.method === "POST") return createResource(request, env, resource);
        if (id && request.method === "GET") return getResource(request, env, resource, id);
        if (id && (request.method === "PUT" || request.method === "PATCH")) return updateResource(request, env, resource, id);
        if (id && request.method === "DELETE") return deleteResource(request, env, resource, id);
      }
      return json({ ok:false, error:"Not found" }, 404);
    } catch (error) {
      const message = String(error?.message || error);
      const status = /UNIQUE constraint failed/i.test(message) ? 409 : /required|must be|cannot exceed|Invalid JSON|No updatable|Unknown disabled_/i.test(message) ? 400 : 500;
      return json({ ok:false, error:message }, status);
    }
  }
};