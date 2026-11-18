import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { PATIENT_MESSAGES } from "@/modules/patients/constants";
import {
  PATIENT_FIELD_NAMES as F,
  patientFormSchema,
  toPatientInput,
  updatePatientFormSchema,
} from "@/modules/patients/schemas";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T03:00:00Z"));
});
afterEach(() => vi.useRealTimers());

function fieldErrors(values: Record<string, unknown>) {
  const result = patientFormSchema.safeParse(values);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("patientFormSchema", () => {
  it("Thêm chỉ với họ tên: every other field becomes null", () => {
    const parsed = patientFormSchema.parse({ [F.fullName]: "  Nguyễn Văn An  " });
    expect(toPatientInput(parsed)).toEqual({
      fullName: "Nguyễn Văn An",
      birthYear: null,
      birthDate: null,
      gender: null,
      hometown: null,
      phone: null,
      patientCode: null,
      summary: null,
    });
  });

  it("Thêm với đủ thông tin", () => {
    const parsed = patientFormSchema.parse({
      [F.fullName]: "Nguyễn Văn An",
      [F.birth]: "12/03/1979",
      [F.gender]: "male",
      [F.hometown]: " Nghệ An ",
      [F.phone]: "0912 345 678",
      [F.patientCode]: "BN-10234",
      [F.summary]: "THA 5 năm.\nDị ứng Penicillin.\n",
    });
    expect(toPatientInput(parsed)).toEqual({
      fullName: "Nguyễn Văn An",
      birthYear: 1979,
      birthDate: "1979-03-12",
      gender: "male",
      hometown: "Nghệ An",
      phone: "0912 345 678",
      patientCode: "BN-10234",
      summary: "THA 5 năm.\nDị ứng Penicillin.",
    });
  });

  it("Nhập tuổi nhanh: the age becomes a birth year (Vietnam time)", () => {
    const parsed = patientFormSchema.parse({ [F.fullName]: "An", [F.birth]: "45t" });
    expect(toPatientInput(parsed)).toMatchObject({ birthYear: 1981, birthDate: null });
  });

  it("Thiếu họ tên (empty or only spaces)", () => {
    expect(fieldErrors({ [F.fullName]: "   " })[F.fullName]).toEqual([
      PATIENT_MESSAGES.fullNameRequired,
    ]);
    expect(fieldErrors({})[F.fullName]).toEqual([PATIENT_MESSAGES.fullNameRequired]);
  });

  it("normalizes decomposed Vietnamese (NFD) before measuring and storing", () => {
    const nfdName = "Nguyễn Thị Ngọc Ánh ".repeat(5).trim().normalize("NFD");
    expect(nfdName.length).toBeGreaterThan(100);
    const parsed = patientFormSchema.parse({ [F.fullName]: nfdName });
    expect(toPatientInput(parsed).fullName).toBe(nfdName.normalize("NFC"));
  });

  it("Họ tên quá dài", () => {
    expect(fieldErrors({ [F.fullName]: "a".repeat(101) })[F.fullName]).toEqual([
      PATIENT_MESSAGES.fullNameTooLong,
    ]);
    expect(fieldErrors({ [F.fullName]: "a".repeat(100) })).toEqual({});
  });

  it("Số điện thoại sai", () => {
    expect(fieldErrors({ [F.fullName]: "An", [F.phone]: "09ab" })[F.phone]).toEqual([
      PATIENT_MESSAGES.phoneInvalid,
    ]);
    expect(fieldErrors({ [F.fullName]: "An", [F.phone]: "+84 (912) 345-678." })).toEqual({});
  });

  it("reports birth errors on the birth field", () => {
    expect(fieldErrors({ [F.fullName]: "An", [F.birth]: "2030" })[F.birth]).toEqual([
      PATIENT_MESSAGES.birthYearOutOfRange,
    ]);
    expect(fieldErrors({ [F.fullName]: "An", [F.birth]: "khoảng 40" })[F.birth]).toEqual([
      PATIENT_MESSAGES.birthUnreadable,
    ]);
  });

  it("refuses an unknown gender and over-long optional fields", () => {
    const errors = fieldErrors({
      [F.fullName]: "An",
      [F.gender]: "robot",
      [F.hometown]: "a".repeat(101),
      [F.patientCode]: "a".repeat(51),
      [F.summary]: "a".repeat(5001),
    });
    expect(errors[F.gender]).toEqual([PATIENT_MESSAGES.genderInvalid]);
    expect(errors[F.hometown]).toEqual([PATIENT_MESSAGES.hometownTooLong]);
    expect(errors[F.patientCode]).toEqual([PATIENT_MESSAGES.patientCodeTooLong]);
    expect(errors[F.summary]).toEqual([PATIENT_MESSAGES.summaryTooLong]);
  });
});

describe("updatePatientFormSchema", () => {
  const valid = {
    [F.fullName]: "An",
    patientId: "0b7f8f0e-6a3c-4a8e-9f5c-2d1e0c9b8a76",
    version: "2026-11-18T03:00:00.123Z",
  };

  it("accepts a UUID and an ISO version", () => {
    expect(updatePatientFormSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses an id that is not a UUID", () => {
    expect(updatePatientFormSchema.safeParse({ ...valid, patientId: "1 OR 1=1" }).success).toBe(
      false,
    );
  });
});
