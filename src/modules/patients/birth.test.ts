import { describe, expect, it } from "vitest";

import {
  ageOf,
  describeBirthDetail,
  describeBirthReading,
  describeListAge,
  formatBirthInput,
  parseBirthInput,
  todayInVietnam,
} from "@/modules/patients/birth";
import { PATIENT_MESSAGES } from "@/modules/patients/constants";

const today = { year: 2026, month: 11, day: 18 };
const ok = (birthYear: number, birthDate: string | null = null) => ({
  kind: "ok",
  birthYear,
  birthDate,
});
const error = (message: string) => ({ kind: "error", message });

describe("parseBirthInput", () => {
  it("reads nothing from an empty field", () => {
    expect(parseBirthInput("   ", today)).toEqual({ kind: "empty" });
  });

  it.each(["45t", "45 t", "45 tuổi", "45 Tuổi", "45 tuoi", "45", " 45T "])(
    "Nhập tuổi nhanh: %s is an age",
    (text) => {
      expect(parseBirthInput(text, today)).toEqual(ok(1981));
    },
  );

  it("reads decomposed Vietnamese (NFD) as typed on some keyboards", () => {
    expect(parseBirthInput("45 tuổi".normalize("NFD"), today)).toEqual(ok(1981));
  });

  it("reads four digits as a year", () => {
    expect(parseBirthInput("1979", today)).toEqual(ok(1979));
  });

  it.each([
    ["12/03/1979", "1979-03-12"],
    ["12-3-1979", "1979-03-12"],
    ["1.3.1979", "1979-03-01"],
    ["29/02/2024", "2024-02-29"],
    ["18/11/2026", "2026-11-18"],
  ])("Nhập ngày sinh đầy đủ: %s", (text, iso) => {
    expect(parseBirthInput(text, today)).toEqual(ok(Number(iso.slice(0, 4)), iso));
  });

  it("accepts the age limits 0 and 120", () => {
    expect(parseBirthInput("0t", today)).toEqual(ok(2026));
    expect(parseBirthInput("120", today)).toEqual(ok(1906));
  });

  it("refuses an age over 120", () => {
    expect(parseBirthInput("121", today)).toEqual(error(PATIENT_MESSAGES.ageOutOfRange));
  });

  it("Năm sinh ở tương lai, and years before 1900", () => {
    expect(parseBirthInput("2030", today)).toEqual(error(PATIENT_MESSAGES.birthYearOutOfRange));
    expect(parseBirthInput("1899", today)).toEqual(error(PATIENT_MESSAGES.birthYearOutOfRange));
    expect(parseBirthInput("1900", today)).toEqual(ok(1900));
    expect(parseBirthInput("01/01/1899", today)).toEqual(
      error(PATIENT_MESSAGES.birthYearOutOfRange),
    );
  });

  it.each(["31/02/1979", "29/02/2023", "00/01/1979", "12/13/1979", "19/11/2026"])(
    "Ngày không có thật hoặc ở tương lai: %s",
    (text) => {
      expect(parseBirthInput(text, today)).toEqual(error(PATIENT_MESSAGES.birthDateInvalid));
    },
  );

  it.each(["khoảng 40", "45 tuổi rưỡi", "1979/03/12", "12/03/79", "-5", "4 5"])(
    "Nhập không hiểu được: %s",
    (text) => {
      expect(parseBirthInput(text, today)).toEqual(error(PATIENT_MESSAGES.birthUnreadable));
    },
  );
});

describe("age", () => {
  it("Nhập tuổi nhanh: reading and detail of an age", () => {
    const birth = { birthYear: 1981, birthDate: null };
    expect(describeBirthReading(birth, today)).toBe("Năm sinh 1981 · 45 tuổi");
    expect(describeBirthDetail(birth, today)).toBe("45 tuổi (1981)");
  });

  it("Nhập ngày sinh đầy đủ: completed years after the birthday", () => {
    const birth = { birthYear: 1979, birthDate: "1979-03-12" };
    expect(describeBirthDetail(birth, today)).toBe("47 tuổi (12/03/1979)");
    expect(describeBirthReading(birth, today)).toBe("Ngày sinh 12/03/1979 · 47 tuổi");
  });

  it("Chưa tới sinh nhật trong năm", () => {
    expect(describeBirthDetail({ birthYear: 1979, birthDate: "1979-12-20" }, today)).toBe(
      "46 tuổi (20/12/1979)",
    );
    expect(ageOf({ birthYear: 1979, birthDate: "1979-11-18" }, today)).toBe(47);
    expect(ageOf({ birthYear: 1979, birthDate: "1979-11-19" }, today)).toBe(46);
  });

  it("Chưa đầy một tuổi", () => {
    expect(describeListAge({ birthYear: 2026, birthDate: null }, today)).toBe("Dưới 1 tuổi");
    expect(describeBirthDetail({ birthYear: 2026, birthDate: null }, today)).toBe(
      "Dưới 1 tuổi (2026)",
    );
  });

  it("knows nothing without a birth year", () => {
    const birth = { birthYear: null, birthDate: null };
    expect(describeListAge(birth, today)).toBeNull();
    expect(describeBirthDetail(birth, today)).toBeNull();
    expect(formatBirthInput(birth)).toBe("");
  });

  it("formats the stored value back for the edit form", () => {
    expect(formatBirthInput({ birthYear: 1979, birthDate: null })).toBe("1979");
    expect(formatBirthInput({ birthYear: 1979, birthDate: "1979-03-12" })).toBe("12/03/1979");
  });
});

describe("todayInVietnam", () => {
  it("uses Vietnam time, not UTC", () => {
    // 31/12/2025 18:30 UTC is already 01/01/2026 01:30 in Vietnam.
    expect(todayInVietnam(new Date("2025-12-31T18:30:00Z"))).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });
});
