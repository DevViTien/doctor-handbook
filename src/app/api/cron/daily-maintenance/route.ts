import { getServerEnv } from "@/config/env";
import { purgeExpiredTrash } from "@/modules/patients/server/mutations";
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
 * 3. Deletes for good the patients that have been in the trash for 30 days (spec patient-trash
 *    "Tự xoá hẳn sau 30 ngày"), with their notes. Only the count is logged.
 */
export async function GET(request: Request) {
  try {
    const { CRON_SECRET } = getServerEnv();
    const authorization = request.headers.get("authorization") ?? "";

    if (!CRON_SECRET || !safeEqual(authorization, `Bearer ${CRON_SECRET}`)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Independent jobs: one failing must not keep the other (e.g. the trash purge) from running.
    const [attempts, trash] = await Promise.allSettled([pruneAuthAttempts(), purgeExpiredTrash()]);
    const prunedAuthAttempts = attempts.status === "fulfilled" ? attempts.value : null;
    const purgedPatients = trash.status === "fulfilled" ? trash.value : null;
    for (const [job, outcome] of [
      ["pruneAuthAttempts", attempts],
      ["purgeExpiredTrash", trash],
    ] as const) {
      if (outcome.status === "rejected") {
        logger.error("Daily maintenance job failed", { job, error: outcome.reason });
      }
    }
    const ok = attempts.status === "fulfilled" && trash.status === "fulfilled";
    logger.info("Daily maintenance done", { ok, prunedAuthAttempts, purgedPatients });
    return Response.json({ ok, prunedAuthAttempts, purgedPatients }, { status: ok ? 200 : 500 });
  } catch (error) {
    return toErrorResponse(error, { route: "cron.daily-maintenance" });
  }
}
