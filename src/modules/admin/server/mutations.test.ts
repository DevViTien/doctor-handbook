import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { doctorAccountById } from "@/modules/admin/server/mutations";

vi.mock("@/server/db/client", () => ({ getDb: vi.fn() }));

const dialect = new PgDialect({ casing: "snake_case" });
const ACCOUNT_ID = "6f1d2c3b-4a59-4e7f-8a1b-2c3d4e5f6a7b";

describe("doctorAccountById", () => {
  it("Khoá tài khoản Admin: only ever matches a doctor account with that id", () => {
    const condition = doctorAccountById(ACCOUNT_ID);
    if (!condition) throw new Error("expected a condition");
    const query = dialect.sqlToQuery(condition);

    expect(query.sql).toMatch(/"accounts"\."id" = \$\d+ and "accounts"\."role" = \$\d+/);
    expect(query.params).toEqual([ACCOUNT_ID, "doctor"]);
  });
});
