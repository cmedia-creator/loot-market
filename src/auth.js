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

async function adminCount(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM admin_users').first();
  return Number(row?.count || 0);
}

async function claimFirstAdmin(env, userId) {
  const result = await env.DB.prepare(`
    INSERT INTO admin_users (user_id, is_active)
    SELECT ?, 1
    WHERE NOT EXISTS (SELECT 1 FROM admin_users)
  `).bind(userId).run();
  return Boolean(result.meta?.changes);
}

async function responseMessage(response, fallback) {
  try {
    const body = await response.clone().json();
    return body?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

function validAdminToken(request, env) {
  return Boolean(env.ADMIN_TOKEN) && request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;
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
  const totalAdmins = await adminCount(env);
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
  if (!validAdminToken(request, env)) return { ok: false, status: 401, error: 'Invalid ADMIN_TOKEN' };

  if (!(await claimFirstAdmin(env, session.user.id))) {
    return { ok: false, status: 409, error: 'An administrator is already registered' };
  }
  return {
    ok: true,
    status: 201,
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
  };
}

export async function createFirstAdminAccount(request, env) {
  await ensureAdminUsersTable(env);
  if (!env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: 'ADMIN_TOKEN is not configured on the server' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (!validAdminToken(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: 'ADMIN_TOKENが違います。' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (await adminCount(env)) {
    return new Response(JSON.stringify({ ok: false, error: '管理者はすでに登録されています。ログインしてください。' }), {
      status: 409,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  let input = {};
  try { input = await request.json(); } catch {}
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const name = String(input.name || email.split('@')[0] || 'LOOT ADMIN').trim().slice(0, 80);
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'メールアドレスを確認してください。' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (password.length < 8 || password.length > 128) {
    return new Response(JSON.stringify({ ok: false, error: 'パスワードは8〜128文字で入力してください。' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const auth = createAuth(env);
  let authResponse = await auth.api.signUpEmail({
    body: { name, email, password },
    asResponse: true,
  });
  let mode = 'created';

  // If the email was already created during a previous attempt, accept the same
  // credentials and finish the first-admin setup instead of trapping the owner.
  if (!authResponse.ok) {
    const signInResponse = await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      asResponse: true,
    });
    if (!signInResponse.ok) {
      const message = await responseMessage(authResponse, 'アカウントを作成できませんでした。');
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: authResponse.status || 400,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    authResponse = signInResponse;
    mode = 'signed_in';
  }

  let authBody = {};
  try { authBody = await authResponse.clone().json(); } catch {}
  const user = authBody?.user || authBody?.data?.user || null;
  if (!user?.id) {
    return new Response(JSON.stringify({ ok: false, error: 'アカウント作成後のユーザー情報を取得できませんでした。' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (!(await claimFirstAdmin(env, user.id))) {
    return new Response(JSON.stringify({ ok: false, error: '管理者はすでに登録されています。' }), {
      status: 409,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const headers = new Headers(authResponse.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify({
    ok: true,
    mode,
    user: { id: user.id, name: user.name, email: user.email },
  }), { status: 201, headers });
}
