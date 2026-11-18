import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/patients/search/route";
import { searchPatients } from "@/modules/search/server/queries";
import { getSessionToken } from "@/server/auth/cookies";
import { type AuthContext, validateSessionToken } from "@/server/auth/session";

vi.mock("@/server/auth/cookies", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ validateSessionToken: vi.fn() }));
vi.mock("@/modules/search/server/queries", () => ({ searchPatients: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const minh: AuthContext = {
  sessionId: "s-minh",
  account: { id: "account-minh", role: "doctor", username: "bs.minh", displayName: "BS. Minh" },
};
const admin: AuthContext = {
  sessionId: "s-admin",
  account: { id: "account-admin", role: "admin", username: "admin", displayName: "Quản trị" },
};

function signedInAs(auth: AuthContext | null) {
  vi.mocked(getSessionToken).mockResolvedValue(auth ? "token" : undefined);
  vi.mocked(validateSessionToken).mockResolvedValue(auth);
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://sotay.example/api/patients/search", {
    method: "POST",
    headers: {
      host: "sotay.example",
      origin: "https://sotay.example",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(searchPatients).mockResolvedValue({
    matches: [{ id: "p1", kinds: ["notes"] }],
    suggestions: [],
  });
});

describe("POST /api/patients/search", () => {
  it("searches the session's own account and returns ids and kinds only", async () => {
    signedInAs(minh);

    const response = await POST(request({ query: " penicillin ", accountId: "account-lan" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      matches: [{ id: "p1", kinds: ["notes"] }],
      suggestions: [],
    });
    expect(searchPatients).toHaveBeenCalledWith(minh, "penicillin");
  });

  it("Chưa đăng nhập hoặc Admin gửi lệnh tìm", async () => {
    signedInAs(null);
    expect((await POST(request({ query: "an" }))).status).toBe(401);
    signedInAs(admin);
    const forbidden = await POST(request({ query: "an" }));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(searchPatients).not.toHaveBeenCalled();
  });

  it("refuses another origin, a missing origin and a non-JSON body", async () => {
    signedInAs(minh);
    expect((await POST(request({ query: "an" }, { origin: "https://evil.example" }))).status).toBe(
      403,
    );
    const noOrigin = request({ query: "an" });
    noOrigin.headers.delete("origin");
    expect((await POST(noOrigin)).status).toBe(403);
    expect((await POST(request({ query: "an" }, { "content-type": "text/plain" }))).status).toBe(
      422,
    );
    expect(searchPatients).not.toHaveBeenCalled();
  });

  it("refuses a query longer than 100 characters", async () => {
    signedInAs(minh);
    expect((await POST(request({ query: "a".repeat(101) }))).status).toBe(422);
    expect(searchPatients).not.toHaveBeenCalled();
  });
});
