import { describe, expect, it } from "vitest";

import { describePatientDetailMeta, describePatientMeta, telHref } from "@/modules/patients/format";
import type { PatientListItem } from "@/modules/patients/types";

const today = { year: 2026, month: 11, day: 18 };
const an: PatientListItem = {
  id: "p1",
  fullName: "Nguyễn Văn An",
  birthYear: 1979,
  birthDate: null,
  gender: "male",
  hometown: "Nghệ An",
  avatarUrl: null,
};

describe("patient display", () => {
  it("Xem danh sách: gender, age and hometown", () => {
    expect(describePatientMeta(an, today)).toBe("Nam · 47 tuổi · Nghệ An");
    expect(describePatientDetailMeta(an, today)).toBe("Nam · 47 tuổi (1979) · Nghệ An");
  });

  it("skips what is unknown", () => {
    expect(describePatientMeta({ ...an, gender: null, hometown: null }, today)).toBe("47 tuổi");
    expect(
      describePatientMeta({ ...an, gender: null, birthYear: null, hometown: null }, today),
    ).toBe("");
  });

  it("Gọi điện từ trang chi tiết: keeps digits and a leading +", () => {
    expect(telHref("0912 345 678")).toBe("tel:0912345678");
    expect(telHref(" +84 (912) 345-678 ")).toBe("tel:+84912345678");
    expect(telHref("(+84) 912 345 678")).toBe("tel:+84912345678");
  });
});
