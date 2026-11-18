import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PatientForm } from "@/modules/patients/components/patient-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/modules/patients/server/actions", () => ({
  createPatientFormAction: vi.fn(),
  updatePatientFormAction: vi.fn(),
}));

const empty = {
  fullName: "",
  birth: "",
  gender: "",
  hometown: "",
  phone: "",
  patientCode: "",
  summary: "",
};

describe("PatientForm (server-rendered HTML)", () => {
  const html = renderToStaticMarkup(
    <PatientForm mode="create" initialValues={empty} candidates={[]} />,
  );

  it("cannot submit before hydration: no GET that would put patient data in the URL", () => {
    expect(html).toMatch(/<form[^>]*action="javascript:/);
    expect(html).not.toMatch(/<form[^>]*method="get"/i);
  });

  it("Thuộc tính ô của form: tel phone, autocomplete off on every field", () => {
    expect(html).toMatch(
      /<input[^>]*type="tel"[^>]*name="patientPhone"|<input[^>]*name="patientPhone"[^>]*type="tel"/,
    );
    const fields = html.match(/<(input|textarea)(?![^>]*type="(hidden|radio)")[^>]*>/g) ?? [];
    expect(fields.length).toBeGreaterThanOrEqual(6);
    for (const field of fields) expect(field).toMatch(/autocomplete="off"/i);
  });
});
