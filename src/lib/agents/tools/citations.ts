/**
 * Module 6: Citation & Directory Consistency Check
 * Tool: checkCitations
 *
 * Citation consistency needs a real directory provider or a targeted local
 * scraper. Until that exists, this collector returns an explicit unavailable
 * state instead of fabricating directory listings.
 */

import type { CitationConsistencyResult } from "@/lib/db/types";
import { unavailable, type UnavailableResult } from "./unavailable";

interface CheckCitationsParams {
  businessName: string;
  address?: string;
  phone?: string;
  city?: string;
  category?: string;
}

export async function checkCitations(
  _params: CheckCitationsParams
): Promise<CitationConsistencyResult | UnavailableResult> {
  return unavailable(
    "citations",
    "not_applicable",
    "Citation consistency requires a real citation provider; no local collector is implemented yet."
  );
}
