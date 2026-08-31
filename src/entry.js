import app from "./index.js";
import { createAuth } from "./auth.js";
import { handleUserApi } from "./user-api.js";
import { getMigrations } from "better-auth/db/migration";

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/_dev/auth-migrate" && request.method === "POST") {
      if (env.AUTH_MIGRATION_MODE !== "1") return json({ ok: false, error: "Not found" }, 404);
      const auth = createAuth(env);
      const migrations = await getMigrations(auth.options);
      await migrations.runMigrations();
      return json({
        ok: true,
        created: migrations.toBeCreated?.map((x) => x.table || x.modelName || x) || [],
        added: migrations.toBeAdded || [],
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
