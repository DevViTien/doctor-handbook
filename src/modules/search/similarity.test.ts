import { describe, expect, it } from "vitest";

import { SEARCH_LIMITS } from "@/modules/search/constants";
import { matchPatientFields } from "@/modules/search/deep-match";
import { likeContains } from "@/modules/search/server/queries";
import { nameSimilarity } from "@/modules/search/similarity";

const near = (query: string, name: string) =>
  nameSimilarity(query, name) >= SEARCH_LIMITS.similarity;

describe("nameSimilarity", () => {
  it("Gõ sai một chữ: a typo still suggests the name", () => {
    expect(near("nguyn van an", "Nguyễn Văn An")).toBe(true);
    expect(near("nguyn", "Nguyễn Văn An")).toBe(true);
    expect(near("tran thi bnh", "Trần Thị Bình")).toBe(true);
  });

  it("does not suggest unrelated names", () => {
    expect(near("xyz", "Nguyễn Văn An")).toBe(false);
    expect(near("pham thu ha", "Nguyễn Văn An")).toBe(false);
  });

  it("compares names only: a phone or hometown typo suggests nobody", () => {
    expect(near("0912 345 679", "Nguyễn Văn An")).toBe(false);
    expect(near("nghe am", "Nguyễn Văn An")).toBe(false);
  });

  it("is 1 for the same name and 0 for nothing", () => {
    expect(nameSimilarity("Nguyễn Văn An", "nguyen van an")).toBe(1);
    expect(nameSimilarity("", "Nguyễn Văn An")).toBe(0);
  });
});

describe("matchPatientFields, other spellings", () => {
  it("matches a patient code without its separator", () => {
    expect(
      matchPatientFields({ phone: null, patientCode: "BN-10234", summary: null }, "bn10234"),
    ).toEqual(["patientCode"]);
  });

  it("matches a phone stored with +84 when typed with a leading 0, and the other way round", () => {
    const international = { phone: "+84 912 345 678", patientCode: null, summary: null };
    expect(matchPatientFields(international, "0912345678")).toEqual(["phone"]);
    const local = { phone: "0912 345 678", patientCode: null, summary: null };
    expect(matchPatientFields(local, "+84912345")).toEqual(["phone"]);
  });
});

describe("likeContains", () => {
  it("matches %, _ and \\ literally", () => {
    expect(likeContains("50%")).toBe("%50\\%%");
    expect(likeContains("a_b")).toBe("%a\\_b%");
    expect(likeContains("c\\d")).toBe("%c\\\\d%");
  });
});
