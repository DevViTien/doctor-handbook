import { AppError } from "@/lib/errors";
import { searchPatientsSchema } from "@/modules/search/schemas";
import { searchPatients } from "@/modules/search/server/queries";
import { requireAccess } from "@/server/auth/guards";
import { toErrorResponse } from "@/server/http/responses";

/**
 * Deep patient search (spec patient-search, design §3). A Route Handler rather than a Server
 * Action: the browser can abort a stale or hung request (AbortController), whereas Next runs
 * Server Actions one at a time per tab, so one hung search would block every later one.
 *
 * - POST with a JSON body only: the query is patient data and never goes in the URL or a log.
 * - Same-origin only (like Server Actions): a cross-site page cannot run it with the doctor's
 *   cookie (`SameSite=Lax` already withholds it; JSON forces a CORS preflight on top).
 * - Doctors only; the account comes from the session. Returns ids and match kinds only.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      throw new AppError("VALIDATION_FAILED");
    }
    const auth = await requireAccess("doctor");
    const input = searchPatientsSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AppError("VALIDATION_FAILED");

    return Response.json(await searchPatients(auth, input.data.query), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, { route: "api.patients.search" });
  }
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new AppError("FORBIDDEN");
}
