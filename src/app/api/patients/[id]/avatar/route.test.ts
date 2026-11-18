import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/patients/[id]/avatar/route";
import { getAvatarPath } from "@/modules/patients/server/queries";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";
import { createSignedReadUrls } from "@/server/storage/objects";

vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/patients/server/queries", () => ({ getAvatarPath: vi.fn() }));
vi.mock("@/server/storage/objects", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createSignedReadUrls: vi.fn(async (_bucket: string, paths: string[]) => {
    return new Map(paths.map((path) => [path, "https://storage.example/signed?token=t"]));
  }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const ACCOUNT = "6f1c1b0e-6c1a-4c37-9d55-1f0a8c1e2b3d";
const PATIENT = "0b7f8f0e-6a3c-4a8e-9f5c-2d1e0c9b8a76";
const PATH = `${ACCOUNT}/0123456789abcdef0123456789abcdef.webp`;
const lan: AuthContext = {
  sessionId: "s",
  account: { id: ACCOUNT, role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
};
const admin: AuthContext = {
  sessionId: "a",
  account: { id: "admin", role: "admin", username: "admin", displayName: "Quản trị" },
};

function signedInAs(auth: AuthContext | null) {
  vi.mocked(getSessionToken).mockResolvedValue(auth ? "token" : undefined);
  vi.mocked(validateSessionToken).mockResolvedValue(auth);
}

const call = (id = PATIENT) =>
  GET(new Request(`https://sotay.example/api/patients/${id}/avatar?v=x`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => vi.mocked(getAvatarPath).mockResolvedValue(PATH));

describe("GET /api/patients/[id]/avatar", () => {
  it("redirects the owner to a signed URL, cached privately", async () => {
    signedInAs(lan);
    const response = await call();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.example/signed?token=t");
    expect(response.headers.get("cache-control")).toMatch(/^private, max-age=\d+$/);
    expect(getAvatarPath).toHaveBeenCalledWith(lan, PATIENT);
    expect(createSignedReadUrls).toHaveBeenCalledWith("avatars", [PATH], 86_400);
  });

  it("Ảnh của bác sĩ khác: another doctor's patient (or no picture) is 404", async () => {
    signedInAs(lan);
    vi.mocked(getAvatarPath).mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(404);
    expect(createSignedReadUrls).not.toHaveBeenCalled();
  });

  it("a picture missing from storage is 404, not 500", async () => {
    signedInAs(lan);
    vi.mocked(createSignedReadUrls).mockResolvedValueOnce(new Map([[PATH, null]]));
    expect((await call()).status).toBe(404);
  });

  it("a malformed id is 404 without a query", async () => {
    signedInAs(lan);
    expect((await call("not-a-uuid")).status).toBe(404);
    expect(getAvatarPath).not.toHaveBeenCalled();
  });

  it.each([
    ["not signed in", null, 401],
    ["an Admin", admin, 403],
  ])("Chưa đăng nhập hoặc Admin xem ảnh: %s", async (_label, auth, status) => {
    signedInAs(auth);
    expect((await call()).status).toBe(status);
    expect(createSignedReadUrls).not.toHaveBeenCalled();
  });
});
