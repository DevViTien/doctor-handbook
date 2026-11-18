import { z } from "zod";

import { SEARCH_LIMITS } from "@/modules/search/constants";

/** Deep search (spec patient-search). The query is patient data: never logged, never in a URL. */
export const searchPatientsSchema = z.object({
  query: z.string().trim().max(SEARCH_LIMITS.maxLength),
});
