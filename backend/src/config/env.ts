import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().default('http://localhost:3001'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
    PUBLIC_API_URL: z.string().default('http://localhost:3000'),
    CLOUDINARY_URL: z.string().optional(),
    PROBLEM_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),
    MAX_QUOTES_PER_PROBLEM: z.coerce.number().int().positive().default(10),
    BOOKING_AUTO_COMPLETE_HOURS: z.coerce.number().int().positive().default(72),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 'cloudinary' && !env.CLOUDINARY_URL) {
      ctx.addIssue({ code: 'custom', path: ['CLOUDINARY_URL'], message: 'Required when STORAGE_DRIVER=cloudinary' });
    }
  });

export type Env = z.infer<typeof schema>;

/** The app refuses to start when required variables are missing or invalid. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${lines}\nCopy .env.example to .env and fill it in.`);
  }
  return parsed.data;
}
