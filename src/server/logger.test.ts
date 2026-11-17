import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";
import { describe, expect, it, vi } from "vitest";

import { logger, serializeError } from "@/server/logger";

const PATIENT_NAME = "Nguyễn Văn An";

describe("serializeError", () => {
  it("drops query params and message of DrizzleQueryError", () => {
    const error = new DrizzleQueryError(
      'insert into "patients" ("full_name") values ($1)',
      [PATIENT_NAME],
      new Error("timeout"),
    );

    const serialized = JSON.stringify(serializeError(error));

    expect(serialized).not.toContain(PATIENT_NAME);
    expect(serialized).toContain('insert into \\"patients\\"');
  });

  it("keeps only structural fields of PostgresError", () => {
    const error = new postgres.PostgresError({
      message: `duplicate key value: ${PATIENT_NAME}`,
      code: "23505",
      detail: `Key (full_name)=(${PATIENT_NAME}) already exists.`,
      table_name: "patients",
      constraint_name: "patients_pkey",
    } as never);

    const serialized = serializeError(error);

    expect(JSON.stringify(serialized)).not.toContain(PATIENT_NAME);
    expect(serialized).toMatchObject({ code: "23505", table: "patients" });
  });

  it("serializes the cause chain of wrapped errors", () => {
    const pgError = new postgres.PostgresError({ message: PATIENT_NAME, code: "57014" } as never);
    const error = new DrizzleQueryError("select 1", [PATIENT_NAME], pgError);

    expect(serializeError(error)).toMatchObject({
      cause: { name: "PostgresError", code: "57014" },
    });
  });

  it("passes non-error values through", () => {
    expect(serializeError("patient-id-1")).toBe("patient-id-1");
  });
});

describe("logger", () => {
  it("writes one JSON line per entry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Action failed", { action: "patients.create" });

    const line = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(line).toMatchObject({
      level: "error",
      message: "Action failed",
      action: "patients.create",
    });
  });
});
