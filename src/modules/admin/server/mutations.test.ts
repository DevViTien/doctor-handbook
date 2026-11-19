import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDoctorAccount, doctorAccountById } from "@/modules/admin/server/mutations";
import type { DbExecutor } from "@/server/db/client";
import { removeAccountObjects } from "@/server/storage/objects";

vi.mock("@/server/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/server/storage/objects", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  removeAccountObjects: vi.fn(),
}));

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

describe("deleteDoctorAccount", () => {
  type Row = { username: string; status: "active" | "locked" };
  let deletes: SQL[];
  let lockedForUpdate: boolean;

  /** A transaction that answers the `FOR UPDATE` read with `row` and records every DELETE. */
  function fakeDb(row: Row | undefined): DbExecutor {
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: async (mode: string) => {
              lockedForUpdate = mode === "update";
              return row ? [row] : [];
            },
          }),
        }),
      }),
      delete: () => ({
        where: async (condition: SQL) => {
          deletes.push(condition);
        },
      }),
    };
    return {
      transaction: async <T>(run: (t: typeof tx) => Promise<T>) => run(tx),
    } as unknown as DbExecutor;
  }

  beforeEach(() => {
    deletes = [];
    lockedForUpdate = false;
    vi.mocked(removeAccountObjects).mockResolvedValue(3);
  });

  it("Xoá tài khoản cùng toàn bộ dữ liệu: removes the avatars, then deletes only a doctor row", async () => {
    const result = await deleteDoctorAccount(
      ACCOUNT_ID,
      " BS.Khoa ",
      fakeDb({ username: "bs.khoa", status: "locked" }),
    );

    expect(result).toEqual({ status: "deleted", username: "bs.khoa", removedObjects: 3 });
    expect(lockedForUpdate).toBe(true);
    expect(removeAccountObjects).toHaveBeenCalledWith("avatars", ACCOUNT_ID);
    expect(deletes).toHaveLength(1);
    const [condition] = deletes;
    if (!condition) throw new Error("expected a DELETE");
    const query = dialect.sqlToQuery(condition);
    expect(query.sql).toMatch(/"accounts"\."id" = \$\d+ and "accounts"\."role" = \$\d+/);
    expect(query.params).toEqual([ACCOUNT_ID, "doctor"]);
  });

  it.each([
    ["Xoá tài khoản Admin hoặc tài khoản đã xoá", undefined, "bs.khoa", "not-found"],
    [
      "Tài khoản vừa được mở khoá ở nơi khác",
      { username: "bs.khoa", status: "active" },
      "bs.khoa",
      "active",
    ],
    [
      "Server từ chối tên đăng nhập không khớp",
      { username: "bs.khoa", status: "locked" },
      "bs.lan",
      "mismatch",
    ],
    ["empty confirmation", { username: "bs.khoa", status: "locked" }, "", "mismatch"],
  ] as const)("%s: touches nothing", async (_label, row, typed, status) => {
    const result = await deleteDoctorAccount(ACCOUNT_ID, typed, fakeDb(row));

    expect(result).toEqual({ status });
    expect(removeAccountObjects).not.toHaveBeenCalled();
    expect(deletes).toHaveLength(0);
  });

  it("Kho ảnh lỗi: the storage error leaves the transaction (rollback) and nothing is deleted", async () => {
    vi.mocked(removeAccountObjects).mockRejectedValue(new Error("storage down"));

    await expect(
      deleteDoctorAccount(ACCOUNT_ID, "bs.khoa", fakeDb({ username: "bs.khoa", status: "locked" })),
    ).rejects.toThrow("storage down");
    expect(deletes).toHaveLength(0);
  });
});
