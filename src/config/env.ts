import "server-only";

import { z } from "zod";

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Set by Vercel. Absent locally. */
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    /** Supabase transaction pooler URL (runtime). */
    DATABASE_URL: z.url(),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    /** HMAC key for access codes, so leaked hashes cannot be brute-forced offline. */
    ACCESS_CODE_PEPPER: z.string().min(32),
    /** Required in Vercel production: without it the daily maintenance cron never runs. */
    CRON_SECRET: z.string().min(16).optional(),
  })
  .superRefine((env, context) => {
    if (env.VERCEL_ENV === "production" && !env.CRON_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "CRON_SECRET is required in production",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

/**
 * Validated server environment.
 *
 * Validation is lazy on purpose: `next build` (and CI) can import server modules
 * without real credentials, while any code path that actually needs a secret fails
 * fast with a readable message.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables (see .env.example):\n${z.prettifyError(parsed.error)}`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
