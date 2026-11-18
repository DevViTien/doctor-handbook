import { describe, expect, it } from "vitest";

import { matchPatientFields } from "@/modules/search/deep-match";
import { indexPatients, rankLocal, searchTokens } from "@/modules/search/match";

const patients = [
  { id: "binh", fullName: "Trần Thị Bình", hometown: "Hà Tĩnh" },
  { id: "an-nghe", fullName: "Nguyễn Văn An", hometown: "Nghệ An" },
  { id: "hong", fullName: "Nguyễn Thị Hồng", hometown: "Nghệ An" },
  { id: "an-thanh", fullName: "Nguyễn Văn An", hometown: "Thanh Hoá" },
  { id: "minh", fullName: "Lê Minh", hometown: null },
];
const indexed = indexPatients(patients);
const ids = (query: string) => rankLocal(indexed, searchTokens(query)).map((p) => p.id);

describe("rankLocal", () => {
  it("Gõ không dấu: accent and case insensitive", () => {
    expect(ids("nguyen van an")).toEqual(["an-nghe", "an-thanh"]);
    expect(ids("TRẦN THỊ BÌNH")).toEqual(["binh"]);
    expect(ids("  binh  ")).toEqual(["binh"]);
  });

  it("Từ theo thứ tự bất kỳ, gồm cả quê", () => {
    // Both Nghệ An patients, never An from Thanh Hoá.
    expect(ids("an nghe")).toEqual(["an-nghe", "hong"]);
    expect(ids("nghe an van")).toEqual(["an-nghe"]);
  });

  it("puts name matches before hometown-only matches, keeping list order in each group", () => {
    // "an" is inside "Trần" and both "An", and only in Hồng's hometown.
    expect(ids("an")).toEqual(["binh", "an-nghe", "an-thanh", "hong"]);
  });

  it("returns everyone for an empty query", () => {
    expect(ids("   ")).toEqual(patients.map((p) => p.id));
  });

  it("handles a patient without hometown", () => {
    expect(ids("minh")).toEqual(["minh"]);
    expect(ids("xyz")).toEqual([]);
  });
});

describe("matchPatientFields", () => {
  const fields = {
    phone: "0912 345 678",
    patientCode: "BN-10234",
    summary: "Tiền sử đái tháo đường",
  };

  it("Tìm theo số điện thoại: compares digits, ignoring spaces", () => {
    expect(matchPatientFields(fields, "0912345")).toEqual(["phone"]);
    expect(matchPatientFields(fields, "345 678")).toEqual(["phone"]);
  });

  it("needs at least 3 digits and a phone-like query", () => {
    expect(matchPatientFields(fields, "09")).toEqual([]);
    expect(matchPatientFields(fields, "an 0912")).toEqual([]);
  });

  it("Tìm theo mã bệnh nhân", () => {
    expect(matchPatientFields(fields, "bn-10234")).toEqual(["patientCode"]);
    expect(matchPatientFields(fields, "BN 10234")).toEqual(["patientCode"]);
  });

  it("Tìm trong tóm tắt: accent insensitive, every word", () => {
    expect(matchPatientFields(fields, "dai thao duong")).toEqual(["summary"]);
    expect(matchPatientFields(fields, "duong tien")).toEqual(["summary"]);
    expect(matchPatientFields(fields, "huyet ap")).toEqual([]);
  });

  it("matches nothing on empty fields or an empty query", () => {
    expect(
      matchPatientFields({ phone: null, patientCode: null, summary: null }, "0912345"),
    ).toEqual([]);
    expect(matchPatientFields(fields, "  ")).toEqual([]);
  });
});
