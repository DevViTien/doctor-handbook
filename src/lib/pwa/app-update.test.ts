import { describe, expect, it } from "vitest";

import { isNewerDeployment } from "@/lib/pwa/app-update";

describe("isNewerDeployment", () => {
  it("is true when the live deployment differs from the one that built the page", () => {
    expect(isNewerDeployment("dpl_new", "dpl_old")).toBe(true);
  });

  it("is false for the same deployment, or when either side is unknown", () => {
    expect(isNewerDeployment("dpl_old", "dpl_old")).toBe(false);
    expect(isNewerDeployment("dpl_new", "")).toBe(false);
    expect(isNewerDeployment("", "dpl_old")).toBe(false);
    expect(isNewerDeployment(null, "dpl_old")).toBe(false);
    expect(isNewerDeployment(undefined, "dpl_old")).toBe(false);
  });
});
