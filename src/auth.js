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
