import { z } from 'zod';

const envSchema = z.object({
  // Virtuals ACP
  ACP_WALLET_PRIVATE_KEY: z.string().min(1).optional(),
  ACP_AGENT_WALLET_ADDRESS: z.string().min(1).optional(),
  ACP_BUYER_WALLET_ADDRESS: z.string().min(1).optional(),
  ACP_SESSION_ENTITY_KEY_ID: z.string().min(1).optional(),
  GAME_API_KEY: z.string().min(1).optional(),

  // Server
  PORT: z.string().default('3001'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),

  // Database
  DB_PATH: z.string().default('./data/taste.db'),

  // File uploads
  UPLOAD_DIR: z.string().default('./data/uploads'),
  BASE_URL: z.string().optional(),
  FILE_SIGNING_SECRET: z.string().min(16).optional(),

  // Security
  EMAIL_ENCRYPTION_KEY: z.string().length(64, 'EMAIL_ENCRYPTION_KEY must be 64 hex characters (32 bytes)').optional()
    .refine(
      (val) => val !== undefined || process.env.NODE_ENV !== 'production',
      'EMAIL_ENCRYPTION_KEY is required in production',
    ),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Push Notifications (Web Push VAPID)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_EMAIL: z.string().default('mailto:admin@taste.xyz'),

  // Mode
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const errors = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, val]) => {
        const errs = (val as { _errors: string[] })._errors;
        return `  ${key}: ${errs.join(', ')}`;
      })
      .join('\n');

    console.error('Environment validation failed:\n' + errors);
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) throw new Error('Environment not loaded. Call loadEnv() first.');
  return _env;
}

/** Reset cached env — for tests only */
export function resetEnv(): void {
  _env = null;
}
