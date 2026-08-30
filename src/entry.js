import app from "./index.js";

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const response = await app.fetch(request, env, ctx);
    if (request.method !== "GET" || url.pathname !== "/api/catalog" || !response.ok) return response;
    try {
      const payload = await response.clone().json();
      if (!payload?.ok || !Array.isArray(payload.data)) return response;
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
