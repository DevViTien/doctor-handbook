import { describe, expect, it } from "vitest";

import { splitLinks } from "@/lib/text/linkify";

describe("splitLinks", () => {
  it("Link trong tóm tắt: turns http(s) addresses into links and keeps HTML as text", () => {
    expect(splitLinks("KQ XN: https://lab.example.vn/kq/123 và <b>đậm</b>")).toEqual([
      { type: "text", value: "KQ XN: " },
      { type: "link", value: "https://lab.example.vn/kq/123" },
      { type: "text", value: " và <b>đậm</b>" },
    ]);
  });

  it("drops sentence punctuation after an address", () => {
    expect(splitLinks("Xem http://a.vn/x?y=1. Rồi (https://b.vn).")).toEqual([
      { type: "text", value: "Xem " },
      { type: "link", value: "http://a.vn/x?y=1" },
      { type: "text", value: ". Rồi (" },
      { type: "link", value: "https://b.vn" },
      { type: "text", value: ")." },
    ]);
  });

  it("keeps a closing bracket the address opened itself", () => {
    expect(splitLinks("Xem https://vi.wikipedia.org/wiki/A_(B).")).toEqual([
      { type: "text", value: "Xem " },
      { type: "link", value: "https://vi.wikipedia.org/wiki/A_(B)" },
      { type: "text", value: "." },
    ]);
  });

  it("keeps line breaks in the text parts", () => {
    expect(splitLinks("Dòng 1\nhttps://a.vn\nDòng 3")).toEqual([
      { type: "text", value: "Dòng 1\n" },
      { type: "link", value: "https://a.vn" },
      { type: "text", value: "\nDòng 3" },
    ]);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<b>x</b>",
    "www.example.vn",
    "ftp://a.vn",
    "https://",
  ])("Không biến địa chỉ lạ thành liên kết: %s", (text) => {
    expect(splitLinks(text)).toEqual([{ type: "text", value: text }]);
  });

  it("returns nothing for an empty text", () => {
    expect(splitLinks("")).toEqual([]);
  });
});
