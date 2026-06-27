import { renderToBuffer } from "@react-pdf/renderer";
import ReportPDF from "./report-pdf";
import type { Report } from "@/lib/db/types";
import type { ReactElement } from "react";

export async function generateReportPDF(report: Report): Promise<Buffer> {
  try {
    // Create the PDF document component
    const pdfDocument = ReportPDF({ report }) as ReactElement;

    // Render to buffer
    const buffer = await renderToBuffer(pdfDocument);

    return Buffer.from(buffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error(
      `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
