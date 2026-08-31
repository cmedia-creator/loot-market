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

function validAdminToken(request, env) {
  return Boolean(env.ADMIN_TOKEN) && request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;
}

function errorText(error, fallback) {
  return String(error?.body?.message || error?.message || fallback);
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
  if (!env.ADMIN_TOKEN) return { ok: false, status: 503, error: 'ADMIN_TOKEN is not configured on the server' };
  if (!validAdminToken(request, env)) return { ok: false, status: 401, error: 'ADMIN_TOKENが違います。' };
  if (await adminCount(env)) return { ok: false, status: 409, error: '管理者はすでに登録されています。ログインしてください。' };

  const session = await getAuthSession(request, env);
  if (session?.user?.id) {
    if (!(await claimFirstAdmin(env, session.user.id))) {
      return { ok: false, status: 409, error: '管理者はすでに登録されています。' };
    }
    return {
      ok: true,
      status: 201,
      user: { id: session.user.id, name: session.user.name, email: session.user.email },
      created: false,
    };
  }

  let input = {};
  try { input = await request.json(); } catch {}
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const name = String(input.name || email.split('@')[0] || 'LOOT ADMIN').trim().slice(0, 80);
  if (!email || !email.includes('@')) return { ok: false, status: 400, error: 'メールアドレスを確認してください。' };
  if (password.length < 8 || password.length > 128) return { ok: false, status: 400, error: 'パスワードは8〜128文字で入力してください。' };

  const auth = createAuth(env);
  let user = null;
  let created = true;
  try {
    const data = await auth.api.signUpEmail({ body: { name, email, password } });
    user = data?.user || data?.data?.user || null;
  } catch (signUpError) {
    // A previous failed setup may already have created the account. In that case,
    // verify the same credentials and continue instead of forcing manual recovery.
    try {
      const data = await auth.api.signInEmail({ body: { email, password, rememberMe: true } });
      user = data?.user || data?.data?.user || null;
      created = false;
    } catch {
      return { ok: false, status: 400, error: errorText(signUpError, 'アカウントを作成できませんでした。') };
    }
  }

  if (!user?.id) return { ok: false, status: 500, error: 'ユーザー情報を取得できませんでした。' };
  if (!(await claimFirstAdmin(env, user.id))) {
    return { ok: false, status: 409, error: '管理者はすでに登録されています。' };
  }
  return {
    ok: true,
    status: 201,
    user: { id: user.id, name: user.name, email: user.email },
    created,
  };
}
