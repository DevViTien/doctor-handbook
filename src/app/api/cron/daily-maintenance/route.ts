import { getServerEnv } from "@/config/env";
import { pruneAuthAttempts } from "@/server/auth/attempts";
import { safeEqual } from "@/server/auth/crypto";
import { toErrorResponse } from "@/server/http/responses";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

/**
 * Daily Vercel Cron (see vercel.json), authenticated with `Authorization: Bearer CRON_SECRET`.
 *
 * 1. Touches the database so the free Supabase project is not paused during long
 *    holidays (teckstack.md §4.3).
 * 2. Prunes rate-limit rows that are no longer needed.
 */
export async function GET(request: Request) {
  try {
    const { CRON_SECRET } = getServerEnv();
    const authorization = request.headers.get("authorization") ?? "";

    if (!CRON_SECRET || !safeEqual(authorization, `Bearer ${CRON_SECRET}`)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const prunedAuthAttempts = await pruneAuthAttempts();
    logger.info("Daily maintenance done", { prunedAuthAttempts });
    return Response.json({ ok: true, prunedAuthAttempts });
  } catch (error) {
    return toErrorResponse(error, { route: "cron.daily-maintenance" });
  }
}
