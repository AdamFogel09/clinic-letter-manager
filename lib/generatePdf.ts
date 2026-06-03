// Client-side PDF generation from the rendered letter preview.
// Captures each .a4-page element with html2canvas, combines into a jsPDF document.
// Each PDF page includes the clinic header (logo) and footer — they are part of the
// rendered .a4-page elements already, so they appear on every page automatically.

// Internal: renders all .a4-page DOM elements into a jsPDF document.
// Returns the pdf instance typed as unknown — callers cast to access .save() or .output().
async function buildLetterPdfDoc(onProgress?: (msg: string) => void): Promise<unknown> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF }   = await import("jspdf");

  const pages = Array.from(document.querySelectorAll<HTMLElement>(".a4-page"));
  if (pages.length === 0) throw new Error("No letter pages found to export.");

  const overrideStyle = document.createElement("style");
  overrideStyle.textContent = `
    .a4-page          { box-shadow: none !important; }
    .preview-wrapper  { background: white !important; gap: 0 !important; }
  `;
  document.head.appendChild(overrideStyle);

  const PDF_WIDTH_MM = 210; // A4 width in mm
  let pdf: InstanceType<typeof jsPDF> | null = null;

  try {
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`Rendering page ${i + 1} of ${pages.length}…`);

      const canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        imageTimeout: 8000,
      });

      const pageH_mm = (canvas.height / canvas.width) * PDF_WIDTH_MM;

      if (!pdf) {
        pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [PDF_WIDTH_MM, pageH_mm],
        });
      } else {
        pdf.addPage([PDF_WIDTH_MM, pageH_mm]);
      }

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0, 0,
        PDF_WIDTH_MM,
        pageH_mm
      );

      // Overlay clickable link annotations so hyperlinks survive the image-based export
      const currentPdf = pdf;
      const pageRect   = pages[i].getBoundingClientRect();
      if (currentPdf && pageRect.width > 0 && pageRect.height > 0) {
        const scaleX = PDF_WIDTH_MM / pageRect.width;
        const scaleY = pageH_mm    / pageRect.height;
        pages[i].querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
          const href = anchor.getAttribute("href");
          if (!href || !href.startsWith("http")) return;
          const r = anchor.getBoundingClientRect();
          const x = (r.left - pageRect.left) * scaleX;
          const y = (r.top  - pageRect.top)  * scaleY;
          const w = r.width  * scaleX;
          const h = r.height * scaleY;
          if (w > 0 && h > 0) currentPdf.link(x, y, w, h, { url: href });
        });
      }
    }
  } finally {
    document.head.removeChild(overrideStyle);
  }

  if (!pdf) throw new Error("PDF generation produced no pages.");
  return pdf;
}

export async function exportLetterPdf(
  patientName: string,
  date: string,
  onProgress?: (msg: string) => void,
  patientId?: string,
  location?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = (await buildLetterPdfDoc(onProgress)) as any;
  const { finalPdfFilename } = await import("@/lib/generateDocx");
  const filename = finalPdfFilename(patientId || "", patientName || "", location || "", date);
  onProgress?.("Saving PDF…");
  pdf.save(filename);
}

/**
 * Same as exportLetterPdf but returns the PDF as a Blob instead of triggering a download.
 * Used when the PDF needs to be uploaded to Supabase Storage (e.g. for the SMS signed-URL flow).
 */
export async function exportLetterPdfBlob(
  patientName: string,
  date: string,
  onProgress?: (msg: string) => void,
  patientId?: string,
  location?: string,
): Promise<{ blob: Blob; filename: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = (await buildLetterPdfDoc(onProgress)) as any;
  const { finalPdfFilename } = await import("@/lib/generateDocx");
  const filename = finalPdfFilename(patientId || "", patientName || "", location || "", date);
  onProgress?.("Preparing PDF…");
  const bytes = new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
  return { blob: new Blob([bytes], { type: "application/pdf" }), filename };
}
