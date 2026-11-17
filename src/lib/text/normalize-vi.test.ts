import { describe, expect, it } from "vitest";

import { buildSearchText, normalizeVi } from "@/lib/text/normalize-vi";

describe("normalizeVi", () => {
  it("strips Vietnamese diacritics and lowercases", () => {
    expect(normalizeVi("Nguyễn Văn Ánh")).toBe("nguyen van anh");
  });

  it("maps đ/Đ to d", () => {
    expect(normalizeVi("Đặng Đức")).toBe("dang duc");
  });

  it("collapses and trims whitespace", () => {
    expect(normalizeVi("  Trần   Thị \n Bé ")).toBe("tran thi be");
  });

  it("makes common speech-recognition tone errors match", () => {
    expect(normalizeVi("Hùng")).toBe(normalizeVi("Hưng"));
  });

  it("handles precomposed and decomposed input identically", () => {
    expect(normalizeVi("Ế".normalize("NFC"))).toBe(normalizeVi("Ế".normalize("NFD")));
  });
});

describe("buildSearchText", () => {
  it("joins normalized non-empty parts", () => {
    expect(buildSearchText("Lê Văn Tám", null, "  ", "Nghệ An", undefined)).toBe(
      "le van tam nghe an",
    );
  });
});
