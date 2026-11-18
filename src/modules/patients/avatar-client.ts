import { DEFAULT_ERROR_MESSAGES } from "@/lib/errors";
import type { AvatarImage } from "@/modules/patients/avatar-image";
import { AVATAR_MESSAGES } from "@/modules/patients/constants";
import { prepareAvatarUploadAction, setAvatarAction } from "@/modules/patients/server/actions";

/** A failed avatar save; `offline` tells a lost connection from a refusal. */
export class AvatarSaveError extends Error {
  constructor(
    message: string,
    readonly offline: boolean,
  ) {
    super(message);
    this.name = "AvatarSaveError";
  }
}

/**
 * Saves an already shrunk avatar (design §3): ask for a signed upload URL, PUT the picture
 * straight to Storage (never through a Vercel Function), then attach it to the patient.
 */
export async function saveAvatar(patientId: string, image: AvatarImage): Promise<string> {
  const offline = new AvatarSaveError(AVATAR_MESSAGES.offline, true);
  try {
    const prepared = await prepareAvatarUploadAction({ patientId, format: image.format });
    if (!prepared.ok) throw new AvatarSaveError(prepared.error.message, false);

    const upload = await fetch(prepared.data.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": image.blob.type,
        // The name is new for every picture: it can be cached for good.
        "cache-control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: image.blob,
    });
    if (!upload.ok) throw new AvatarSaveError(DEFAULT_ERROR_MESSAGES.INTERNAL, false);

    const attached = await setAvatarAction({ patientId, path: prepared.data.path });
    if (!attached.ok) throw new AvatarSaveError(attached.error.message, false);
    return attached.data.avatarUrl;
  } catch (error) {
    if (error instanceof AvatarSaveError) throw error;
    throw offline;
  }
}
