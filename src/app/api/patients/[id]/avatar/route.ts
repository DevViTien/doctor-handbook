import { AppError } from "@/lib/errors";
import { patientIdSchema } from "@/modules/patients/schemas";
import { getAvatarPath } from "@/modules/patients/server/queries";
import { requireAccess } from "@/server/auth/guards";
import { toErrorResponse } from "@/server/http/responses";
import { createSignedReadUrls, STORAGE_BUCKETS, storedAvatarPath } from "@/server/storage/objects";

/** Signed URLs live a day; the redirect is cached a little less, so it never points at a dead one. */
const SIGNED_URL_SECONDS = 24 * 60 * 60;
const REDIRECT_CACHE_SECONDS = 23 * 60 * 60;

/**
 * A patient's avatar (spec patient-avatars, design §4): checks the session owns the patient,
 * then redirects (307) to a short-lived signed URL of the private bucket. The picture itself
 * never passes through this function. `?v=` (the random file name) makes a new picture a new
 * URL, so the cached redirect is never stale. Private cache only: never shared caches.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireAccess("doctor");
    const id = patientIdSchema.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND");

    const path = storedAvatarPath(await getAvatarPath(auth, id.data));
    if (!path) throw new AppError("NOT_FOUND");

    // A missing object (lost upload, cleaned orphan) signs as `null`: 404, the initials show.
    const url = (
      await createSignedReadUrls(STORAGE_BUCKETS.avatars, [path], SIGNED_URL_SECONDS)
    ).get(path);
    if (!url) throw new AppError("NOT_FOUND");
    return new Response(null, {
      status: 307,
      headers: { Location: url, "Cache-Control": `private, max-age=${REDIRECT_CACHE_SECONDS}` },
    });
  } catch (error) {
    return toErrorResponse(error, { route: "api.patients.avatar" });
  }
}
