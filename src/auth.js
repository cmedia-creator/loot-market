import { betterAuth } from 'better-auth';

function trustedOrigins(env) {
  return String(env.AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function createAuth(env) {
  const socialProviders = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    appName: 'LOOT MARKET',
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: trustedOrigins(env),
    emailAndPassword: { enabled: true },
    socialProviders,
  });
}

export async function getAuthSession(request, env) {
  return createAuth(env).api.getSession({ headers: request.headers });
}

export async function ensureAdminUsersTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS admin_users (
      user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS admin_users_active_idx ON admin_users(is_active)').run();
}

async function adminRowForUser(env, userId) {
  if (!userId) return null;
  try {
    return await env.DB.prepare('SELECT user_id, is_active FROM admin_users WHERE user_id = ?').bind(userId).first();
  } catch (error) {
    if (/no such table: admin_users/i.test(String(error?.message || error))) return null;
    throw error;
  }
}

export async function isAdminSession(request, env) {
  const session = await getAuthSession(request, env);
  if (!session?.user?.id) return false;
  const row = await adminRowForUser(env, session.user.id);
  return Boolean(row && Number(row.is_active));
}

export async function getAdminAccessState(request, env) {
  await ensureAdminUsersTable(env);
  const session = await getAuthSession(request, env);
  const user = session?.user || null;
  const countRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM admin_users').first();
  const totalAdmins = Number(countRow?.count || 0);
  const row = user ? await adminRowForUser(env, user.id) : null;
  return {
    authenticated: Boolean(user),
    admin: Boolean(row && Number(row.is_active)),
    needsBootstrap: totalAdmins === 0,
    bridgeReady: Boolean(env.ADMIN_TOKEN),
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
  };
}

export async function bootstrapFirstAdmin(request, env) {
  await ensureAdminUsersTable(env);
  const session = await getAuthSession(request, env);
  if (!session?.user?.id) return { ok: false, status: 401, error: 'Login required' };
  if (!env.ADMIN_TOKEN) return { ok: false, status: 503, error: 'ADMIN_TOKEN is not configured on the server' };
  if (request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
    return { ok: false, status: 401, error: 'Invalid ADMIN_TOKEN' };
  }

  const result = await env.DB.prepare(`
    INSERT INTO admin_users (user_id, is_active)
    SELECT ?, 1
    WHERE NOT EXISTS (SELECT 1 FROM admin_users)
  `).bind(session.user.id).run();

  if (!result.meta?.changes) {
    return { ok: false, status: 409, error: 'An administrator is already registered' };
  }
  return {
    ok: true,
    status: 201,
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
  };
}
