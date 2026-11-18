import { gunzipSync, gzipSync } from "node:zlib";

import { AppError } from "@/lib/errors";
import {
  BACKUP_LIMITS,
  BACKUP_MESSAGES,
  REPLACE_EXISTING_HEADER,
} from "@/modules/backup/constants";
import { backupFileSchema } from "@/modules/backup/schemas";
import { replaceAllData } from "@/modules/backup/server/mutations";
import { getBackupSnapshot } from "@/modules/backup/server/queries";
import { requireAccess } from "@/server/auth/guards";
import { toErrorResponse } from "@/server/http/responses";
import { assertNotCrossSite, assertSameOrigin } from "@/server/http/same-origin";
import { logger } from "@/server/logger";

/**
 * Backup data (specs data-backup, data-import; design §3–§4). The `.zip` is built and opened in
 * the browser; only its JSON travels here, gzip-compressed both ways so it stays far below the
 * ~4.5 MB a Vercel Function accepts. Doctors only; the account is always the session's.
 *
 * - GET: everything of the account, as gzip JSON `{ manifest, data }`.
 * - PUT: replace everything with a gzip JSON `{ manifest, data }`, checked again here. Without
 *   `x-replace-existing: 1` (the browser saw data, asked and saved a backup) it only fills an
 *   empty account.
 */

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  try {
    assertNotCrossSite(request);
    const auth = await requireAccess("doctor");
    const file = await getBackupSnapshot(auth, process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0");
    const body = gzipSync(JSON.stringify(file));
    if (body.byteLength > BACKUP_LIMITS.fileBytes) {
      logger.warn("Backup too large to export", {
        counts: file.manifest.counts,
        bytes: body.byteLength,
      });
      throw new AppError("VALIDATION_FAILED", BACKUP_MESSAGES.exportTooLarge);
    }
    return new Response(new Uint8Array(body), {
      headers: { ...NO_STORE, "Content-Type": "application/gzip" },
    });
  } catch (error) {
    return toErrorResponse(error, { route: "api.backup.export" });
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const auth = await requireAccess("doctor");
    if (request.headers.get("content-type") !== "application/gzip") {
      throw new AppError("VALIDATION_FAILED", BACKUP_MESSAGES.fileBroken);
    }

    const compressed = await readBody(request, BACKUP_LIMITS.fileBytes);
    let parsed: unknown;
    try {
      const json = gunzipSync(compressed, { maxOutputLength: BACKUP_LIMITS.unpackedBytes });
      parsed = JSON.parse(json.toString("utf8"));
    } catch {
      throw new AppError("VALIDATION_FAILED", BACKUP_MESSAGES.fileBroken);
    }
    const file = backupFileSchema.safeParse(parsed);
    if (!file.success) throw new AppError("VALIDATION_FAILED", BACKUP_MESSAGES.fileBroken);

    const result = await replaceAllData(auth, file.data, {
      replacingExisting: request.headers.get(REPLACE_EXISTING_HEADER) === "1",
    });
    logger.info("Backup imported", { ...result });
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return toErrorResponse(error, { route: "api.backup.import" });
  }
}

/** The body, refused as soon as it passes `limit` bytes (whatever Content-Length claims). */
async function readBody(request: Request, limit: number): Promise<Uint8Array> {
  const tooLarge = () => new AppError("VALIDATION_FAILED", BACKUP_MESSAGES.fileTooLarge);
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw tooLarge();
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    parts.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  return body;
}
