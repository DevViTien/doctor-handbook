import { describe, expect, it } from "vitest";

import { findPossibleDuplicates } from "@/modules/patients/duplicates";
import type { PatientListItem } from "@/modules/patients/types";

function patient(id: string, fullName: string, birthYear: number | null): PatientListItem {
  return {
    id,
    fullName,
    birthYear,
    birthDate: null,
    gender: null,
    hometown: null,
    avatarUrl: null,
  };
}

const an1979 = patient("p1", "Nguyễn Văn An", 1979);
const anUnknown = patient("p2", "Nguyễn  Văn An", null);
const binh = patient("p3", "Trần Thị Bình", 1964);

describe("findPossibleDuplicates", () => {
  it("Trùng tên và năm sinh: ignores accents, case and extra spaces", () => {
    expect(
      findPossibleDuplicates([an1979, binh], { fullName: " nguyen van  an ", birthYear: 1979 }),
    ).toEqual([an1979]);
  });

  it("Khác năm sinh thì không gợi ý", () => {
    expect(
      findPossibleDuplicates([an1979], { fullName: "Nguyễn Văn An", birthYear: 1990 }),
    ).toEqual([]);
  });

  it("suggests when either side has no birth year", () => {
    expect(
      findPossibleDuplicates([an1979, anUnknown], { fullName: "Nguyễn Văn An", birthYear: null }),
    ).toEqual([an1979, anUnknown]);
    expect(
      findPossibleDuplicates([anUnknown], { fullName: "Nguyễn Văn An", birthYear: 1990 }),
    ).toEqual([anUnknown]);
  });

  it("needs the whole name, not a prefix", () => {
    expect(findPossibleDuplicates([an1979], { fullName: "Nguyễn Văn", birthYear: null })).toEqual(
      [],
    );
    expect(findPossibleDuplicates([an1979], { fullName: "  ", birthYear: null })).toEqual([]);
  });

  it("shows at most three people", () => {
    const many = ["a", "b", "c", "d"].map((id) => patient(id, "Lê Minh", null));
    expect(findPossibleDuplicates(many, { fullName: "Lê Minh", birthYear: null })).toHaveLength(3);
  });
});
