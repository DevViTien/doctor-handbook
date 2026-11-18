import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "@/server/db/errors";

const driverError = (constraint: string) =>
  Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint_name: constraint,
  });

describe("isUniqueViolation", () => {
  it("recognizes the driver error itself", () => {
    expect(isUniqueViolation(driverError("accounts_username_key"), "accounts_username_key")).toBe(
      true,
    );
  });

  it("recognizes a driver error wrapped by Drizzle in `cause`", () => {
    const wrapped = new Error("Failed query", { cause: driverError("accounts_username_key") });
    expect(isUniqueViolation(wrapped, "accounts_username_key")).toBe(true);
  });

  it("ignores a unique violation of another constraint", () => {
    const wrapped = new Error("Failed query", { cause: driverError("access_codes_code_hash_key") });
    expect(isUniqueViolation(wrapped, "accounts_username_key")).toBe(false);
  });

  it("ignores other errors and non-errors", () => {
    expect(isUniqueViolation(new Error("boom"), "accounts_username_key")).toBe(false);
    expect(isUniqueViolation(Object.assign(new Error(), { code: "23503" }), "x")).toBe(false);
    expect(isUniqueViolation(null, "accounts_username_key")).toBe(false);
    expect(isUniqueViolation("23505", "accounts_username_key")).toBe(false);
  });
});
