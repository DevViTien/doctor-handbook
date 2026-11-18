import { gunzipSync, gzipSync } from "node:zlib";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/backup/route";
import { BACKUP_LIMITS, BACKUP_MESSAGES } from "@/modules/backup/constants";
import { recordBackupAction } from "@/modules/backup/server/actions";
import { recordBackup, replaceAllData } from "@/modules/backup/server/mutations";
import { getBackupSnapshot } from "@/modules/backup/server/queries";
import { sampleBackup } from "@/modules/backup/test-fixtures";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";

// Real guards, fake session lookup and DAL: tests the access rules and the checks end to end.
vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/backup/server/queries", () => ({ getBackupSnapshot: vi.fn() }));
vi.mock("@/modules/backup/server/mutations", () => ({
  replaceAllData: vi.fn(),
  recordBackup: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const lan: AuthContext = {
  sessionId: "s-lan",
  account: { id: "account-lan", role: "doctor", username: "bs.lan", displayName: "BS. Lan" },
};
const admin: AuthContext = {
  sessionId: "s-admin",
  account: { id: "account-admin", role: "admin", username: "admin", displayName: "Quản trị" },
};

function signedInAs(auth: AuthContext | null) {
  vi.mocked(getSessionToken).mockResolvedValue(auth ? "token" : undefined);
  vi.mocked(validateSessionToken).mockResolvedValue(auth);
}

const URL_ = "https://sotay.example/api/backup";

function getRequest(headers: Record<string, string> = {}) {
  return new Request(URL_, { headers: { host: "sotay.example", ...headers } });
}

function putRequest(body: Uint8Array | string, headers: Record<string, string> = {}) {
  return new Request(URL_, {
    method: "PUT",
    headers: {
      host: "sotay.example",
      origin: "https://sotay.example",
      "content-type": "application/gzip",
      ...headers,
    },
    body: typeof body === "string" ? body : new Uint8Array(body),
  });
}

const gz = (value: unknown) => new Uint8Array(gzipSync(JSON.stringify(value)));

beforeEach(() => {
  vi.mocked(getBackupSnapshot).mockResolvedValue(sampleBackup());
  vi.mocked(replaceAllData).mockResolvedValue({ patients: 2, notes: 3, todos: 1 });
});

describe("GET /api/backup", () => {
  it("returns the session's own data, gzip-compressed, never cached", async () => {
    signedInAs(lan);

    const response = await GET(getRequest({ "sec-fetch-site": "same-origin" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/gzip");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8"));
    expect(body).toEqual(sampleBackup());
    expect(getBackupSnapshot).toHaveBeenCalledWith(lan, expect.any(String));
  });

  it.each([
    ["not signed in", null, 401],
    ["an Admin", admin, 403],
  ])("Chưa đăng nhập hoặc Admin tải sao lưu: %s", async (_label, auth, status) => {
    signedInAs(auth);

    const response = await GET(getRequest());

    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("Nguyễn Văn An");
    expect(getBackupSnapshot).not.toHaveBeenCalled();
  });

  it("refuses a request the browser marks as cross-site", async () => {
    signedInAs(lan);
    const response = await GET(getRequest({ "sec-fetch-site": "cross-site" }));
    expect(response.status).toBe(403);
    expect(getBackupSnapshot).not.toHaveBeenCalled();
  });
});

describe("PUT /api/backup", () => {
  it("replaces the session's own data with a checked file", async () => {
    signedInAs(lan);
    const file = sampleBackup();
    // A tampered file naming another account: the target is still the session's.
    Object.assign(file.manifest.account, { id: "account-minh" });

    const response = await PUT(putRequest(gz(file)));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ patients: 2, notes: 3, todos: 1 });
    expect(replaceAllData).toHaveBeenCalledWith(
      lan,
      expect.objectContaining({
        manifest: expect.objectContaining({ account: { username: "bs.lan" } }),
      }),
      { replacingExisting: false },
    );
  });

  it("replaces existing data only when the browser says it confirmed and backed it up", async () => {
    signedInAs(lan);
    await PUT(putRequest(gz(sampleBackup()), { "x-replace-existing": "1" }));
    expect(replaceAllData).toHaveBeenCalledWith(lan, expect.anything(), {
      replacingExisting: true,
    });
  });

  it.each([
    ["not signed in", null, 401],
    ["an Admin", admin, 403],
  ])("Chưa đăng nhập hoặc Admin nhập dữ liệu: %s", async (_label, auth, status) => {
    signedInAs(auth);
    const response = await PUT(putRequest(gz(sampleBackup())));
    expect(response.status).toBe(status);
    expect(replaceAllData).not.toHaveBeenCalled();
  });

  it("refuses another origin", async () => {
    signedInAs(lan);
    const response = await PUT(putRequest(gz(sampleBackup()), { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(replaceAllData).not.toHaveBeenCalled();
  });

  it("refuses a body that is not gzip", async () => {
    signedInAs(lan);
    const response = await PUT(
      putRequest(JSON.stringify(sampleBackup()), { "content-type": "application/json" }),
    );
    expect(response.status).toBe(422);
    expect(replaceAllData).not.toHaveBeenCalled();
  });

  it("refuses broken gzip", async () => {
    signedInAs(lan);
    const response = await PUT(putRequest(new TextEncoder().encode("not gzip")));
    expect(response.status).toBe(422);
    expect((await response.json()).error.message).toBe(BACKUP_MESSAGES.fileBroken);
  });

  it("refuses a body over the limit", async () => {
    signedInAs(lan);
    const response = await PUT(putRequest(new Uint8Array(BACKUP_LIMITS.fileBytes + 1)));
    expect(response.status).toBe(422);
    expect((await response.json()).error.message).toBe(BACKUP_MESSAGES.fileTooLarge);
    expect(replaceAllData).not.toHaveBeenCalled();
  });

  it("Dữ liệu sai gửi thẳng lên server: a patient without a name", async () => {
    signedInAs(lan);
    const file = sampleBackup();
    file.data.patients[0]!.fullName = "";

    const response = await PUT(putRequest(gz(file)));

    expect(response.status).toBe(422);
    expect((await response.json()).error.message).toBe(BACKUP_MESSAGES.fileBroken);
    expect(replaceAllData).not.toHaveBeenCalled();
  });
});

describe("recordBackupAction", () => {
  it("records for the session's account and ignores anything sent", async () => {
    signedInAs(lan);
    const result = await recordBackupAction({ accountId: "account-minh" } as never);
    expect(result).toEqual({ ok: true, data: { recorded: true } });
    expect(recordBackup).toHaveBeenCalledWith(lan);
  });

  it.each([
    ["not signed in", null, "UNAUTHENTICATED"],
    ["an Admin", admin, "FORBIDDEN"],
  ])("refuses %s", async (_label, auth, code) => {
    signedInAs(auth);
    const result = await recordBackupAction({});
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(recordBackup).not.toHaveBeenCalled();
  });
});
