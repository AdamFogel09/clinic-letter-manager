// PDF export — screenshots each real visible Preview page.
//
// Selector scope:
//   source = #letter-preview-export-source   (wraps ONLY the real Preview pages)
//   pages  = :scope > .a4-page[data-export-page="true"]
//
// No onclone / no visual modifications to the clone.
// What html2canvas captures is exactly what we put in the PDF.

const PDF_W_MM = 210;
const PDF_H_MM = 297;
const SCALE    = 1.5;   // 1.5× — balanced sharpness vs file size
const JPEG_Q   = 0.82;  // JPEG quality

/** Returns true if a page element has no meaningful visible content. */
export function isPageEmpty(pageEl: HTMLElement): boolean {
  const offset = parseFloat(pageEl.dataset.contentOffset ?? "0");
  const totalH = parseFloat(pageEl.dataset.totalHeight  ?? "-1");
  if (totalH >= 0 && offset >= totalH) return true;

  const contentEl = pageEl.querySelector<HTMLElement>(".a4-page-content");
  if (!contentEl) return true;
  if ((contentEl.innerText ?? "").trim().length > 0) return false;

  const imgs = Array.from(contentEl.querySelectorAll<HTMLImageElement>("img"));
  if (imgs.some(img => img.complete && img.naturalWidth > 0)) return false;
  if (contentEl.querySelector("svg")) return false;

  return true;
}

function getScopedPages(): HTMLElement[] {
  const source = document.getElementById("letter-preview-export-source");
  if (!source) throw new Error("Preview export source not found. Open the letter preview first.");
  return Array.from(
    source.querySelectorAll<HTMLElement>(':scope > .a4-page[data-export-page="true"]'),
  );
}

async function buildLetterPdfDoc(onProgress?: (msg: string) => void): Promise<unknown> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF }   = await import("jspdf");

  const allPages = getScopedPages();
  if (allPages.length === 0)
    throw new Error("No letter pages found. Open the letter preview first.");

  const pages = allPages.filter(p => !isPageEmpty(p));
  if (pages.length === 0)
    throw new Error("Letter pages appear to be empty — nothing to export.");

  if (document.fonts?.ready) await document.fonts.ready;

  const allImgs  = pages.flatMap(p => Array.from(p.querySelectorAll<HTMLImageElement>("img")));
  const unloaded = allImgs.filter(img => !img.complete || img.naturalWidth === 0);
  if (unloaded.length > 0) {
    onProgress?.("Waiting for images…");
    let failCount = 0;
    await Promise.all(unloaded.map(img => new Promise<void>(resolve => {
      img.onload  = () => resolve();
      img.onerror = () => { failCount++; resolve(); };
      if (!img.complete) { const s = img.src; img.src = ""; img.src = s; }
    })));
    if (failCount > 0) console.warn(`[generatePdf] ${failCount} image(s) failed to load.`);
  }

  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (let pi = 0; pi < pages.length; pi++) {
    const pageEl = pages[pi];
    onProgress?.(`Capturing page ${pi + 1} of ${pages.length}…`);

    const rect  = pageEl.getBoundingClientRect();
    const ratio = rect.width / rect.height;
    console.log(
      `[generatePdf] page ${pi + 1}: ${Math.round(rect.width)}×${Math.round(rect.height)}px` +
      ` ratio=${ratio.toFixed(5)} (A4=0.70707)`,
    );

    const canvas = await html2canvas(pageEl, {
      scale:           SCALE,
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      backgroundColor: "#ffffff",
      imageTimeout:    15000,
      // no onclone — capture the clone exactly as-is, zero modifications
    });

    if (pdf === null) {
      pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PDF_W_MM, PDF_H_MM], compress: true });
    } else {
      pdf.addPage([PDF_W_MM, PDF_H_MM]);
    }

    pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_Q), "JPEG", 0, 0, PDF_W_MM, PDF_H_MM);

    // Inhaler links: re-add as PDF link annotations (rasterised by html2canvas → restore clickability)
    const pW = rect.width  || 820;
    const pH = rect.height || 1160;
    Array.from(pageEl.querySelectorAll<HTMLAnchorElement>("a[href]")).forEach(anchor => {
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("http")) return;
      const r   = anchor.getBoundingClientRect();
      const pad = 1;
      pdf!.link(
        Math.max(0, (r.left - rect.left) / pW * PDF_W_MM - pad),
        Math.max(0, (r.top  - rect.top)  / pH * PDF_H_MM - pad),
        Math.min(PDF_W_MM, r.width  / pW * PDF_W_MM + pad * 2),
        Math.min(PDF_H_MM, r.height / pH * PDF_H_MM + pad * 2),
        { url: href },
      );
    });
  }

  if (!pdf) throw new Error("PDF generation produced no pages.");
  return pdf;
}

/**
 * Debug helper — downloads the raw html2canvas capture for each Preview page as a JPEG.
 * Compare these images with the visible Preview to verify capture fidelity.
 * Call from the browser console: window.__debugPdfCapture?.()
 */
export async function debugExportPageImages(): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;

  let pages: HTMLElement[];
  try { pages = getScopedPages().filter(p => !isPageEmpty(p)); }
  catch (e) { console.error("[debug]", e); return; }

  if (document.fonts?.ready) await document.fonts.ready;

  console.log(`[debug] capturing ${pages.length} page(s) as JPEG…`);

  for (let pi = 0; pi < pages.length; pi++) {
    const pageEl = pages[pi];
    const rect   = pageEl.getBoundingClientRect();
    console.log(
      `[debug] page ${pi + 1}: ${Math.round(rect.width)}×${Math.round(rect.height)}px` +
      ` ratio=${(rect.width / rect.height).toFixed(5)}`,
    );

    const canvas = await html2canvas(pageEl, {
      scale:           SCALE,
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      backgroundColor: "#ffffff",
      imageTimeout:    15000,
    });

    const a = document.createElement("a");
    a.href     = canvas.toDataURL("image/jpeg", 0.92);
    a.download = `preview-capture-page-${pi + 1}.jpg`;
    a.click();
    await new Promise(r => setTimeout(r, 400));
  }
  console.log("[debug] done — compare downloaded images with the visible Preview.");
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
