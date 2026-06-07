// Client-side PDF generation from the rendered letter preview.
//
// Architecture: capture each .a4-page at full height, decompose the canvas into
// three strips — header / content / footer — then compose every PDF page as:
//
//   [header strip at top]  [content chunk in middle]  [footer strip at bottom]
//
// This ensures header and footer are always at the correct positions regardless
// of how tall the content is.

const PDF_WIDTH_MM  = 210; // A4 width
const PDF_HEIGHT_MM = 297; // A4 height

// setProperty wrapper — sets a style with !important priority.
// This beats both ordinary stylesheet rules AND existing inline styles, making it
// the most reliable way to override html2canvas layout in onclone.
function imp(el: HTMLElement, prop: string, val: string) {
  el.style.setProperty(prop, val, "important");
}

async function buildLetterPdfDoc(onProgress?: (msg: string) => void): Promise<unknown> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF }   = await import("jspdf");

  const pages = Array.from(document.querySelectorAll<HTMLElement>(".a4-page"));
  if (pages.length === 0) throw new Error("No letter pages found to export.");

  if (document.fonts?.ready) await document.fonts.ready;

  // ── Wait for images ───────────────────────────────────────────────────────────
  const allImages = Array.from(document.querySelectorAll<HTMLImageElement>(".a4-page img"));
  const unloaded  = allImages.filter(img => !img.complete || img.naturalWidth === 0);
  if (unloaded.length > 0) {
    onProgress?.("Waiting for images…");
    let failCount = 0;
    await Promise.all(
      unloaded.map(img =>
        new Promise<void>(resolve => {
          img.onload  = () => resolve();
          img.onerror = () => { failCount++; resolve(); };
          if (img.src && !img.src.startsWith("data:") && !img.complete) {
            const s = img.src; img.src = ""; img.src = s;
          }
        }),
      ),
    );
    if (failCount > 0) console.warn(`[generatePdf] ${failCount} image(s) failed to load.`);
  }

  // ── Override styles (injected into live doc, cloned by html2canvas) ───────────
  const overrideStyle = document.createElement("style");
  overrideStyle.textContent = `
    .a4-page {
      width: 820px !important;
      max-width: 820px !important;
      min-width: 820px !important;
      box-shadow: none !important;
    }
    .preview-wrapper { background: white !important; gap: 0 !important; }
    .lungistitute-wrap { background-color: white !important; isolation: auto !important; }
    .lungistitute-wrap img { mix-blend-mode: normal !important; }
    .letter-header-wrap { display: block !important; text-align: center !important; }
    .letter-header-wrap > img { display: inline-block !important; }
    .pdf-patient-cols { gap: 0 !important; }
    .pdf-patient-cols > div:first-child { margin-right: 32px !important; }
    .pdf-lv { gap: 0 !important; }
    .pdf-lv > span:first-child { margin-right: 8px !important; }
  `;
  document.head.appendChild(overrideStyle);

  const sharedOptions = {
    scale:           2,
    useCORS:         true,
    allowTaint:      true,
    logging:         false,
    backgroundColor: "#ffffff",
    imageTimeout:    10000,
    windowWidth:     820,
  };

  // ── onclone: modify the CLONED document before html2canvas renders it ─────────
  const pageOnClone = (clonedDoc: Document) => {
    // ── Lungistitute logo: pixel-colorize dark strokes → brand purple ──────────
    try {
      const clonedImg = clonedDoc.querySelector<HTMLImageElement>(".lungistitute-wrap img");
      if (clonedImg) {
        const srcImg = document.querySelector<HTMLImageElement>(".lungistitute-wrap img");
        if (srcImg?.complete && srcImg.naturalWidth) {
          const off = document.createElement("canvas");
          off.width = srcImg.naturalWidth; off.height = srcImg.naturalHeight;
          const ctx = off.getContext("2d");
          if (ctx) {
            ctx.drawImage(srcImg, 0, 0);
            const id = ctx.getImageData(0, 0, off.width, off.height);
            const px = id.data;
            for (let p = 0; p < px.length; p += 4) {
              if ((px[p] + px[p + 1] + px[p + 2]) / 3 < 128) {
                px[p] = 30; px[p + 1] = 16; px[p + 2] = 110;
              }
            }
            ctx.putImageData(id, 0, 0);
            clonedImg.src = off.toDataURL("image/png");
          }
        }
      }
    } catch { /* logo falls back to black — acceptable */ }

    // ── Section-header vertical + horizontal centering ─────────────────────────
    //
    // html2canvas bug: flex align-items:center places children at the BOTTOM of
    // the container. Fix: convert every section bar to block layout with symmetric
    // padding, using setProperty("...", "...", "important") which sets inline
    // !important — the highest priority in the CSS cascade, beating both
    // stylesheet rules and ordinary inline styles.

    // Lavender bars (.section-bar-he) — אבחנה / סיכום / תכנית / נקודות חשובות
    Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar-he")).forEach(bar => {
      imp(bar, "display",     "block");
      imp(bar, "padding",     "7px 8px");
      imp(bar, "min-height",  "0");
      imp(bar, "text-align",  "center");
      imp(bar, "overflow",    "hidden");
      imp(bar, "box-sizing",  "border-box");
      imp(bar, "width",       "100%");
      Array.from(bar.querySelectorAll<HTMLElement>("h3, span")).forEach(el => {
        imp(el, "display",    "block");
        imp(el, "text-align", "center");
        imp(el, "width",      "100%");
        imp(el, "margin",     "0");
        imp(el, "padding",    "0");
        imp(el, "line-height","1.3");
      });
    });

    // Grey bars (.section-bar) — Diagnosis / Summary / Test Results / etc.
    Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar")).forEach(bar => {
      const h3   = bar.querySelector<HTMLElement>(":scope > h3");
      const span = bar.querySelector<HTMLElement>(":scope > span");

      if (h3 && span) {
        // Bilingual: English left, Hebrew right — keep flex-row, fix alignment
        imp(bar, "display",         "flex");
        imp(bar, "flex-direction",  "row");
        imp(bar, "justify-content", "space-between");
        imp(bar, "align-items",     "flex-start");
        imp(bar, "padding",         "5px 10px");
        imp(bar, "min-height",      "0");
        imp(bar, "box-sizing",      "border-box");
        imp(h3,   "margin",  "0"); imp(h3,   "padding",   "0"); imp(h3,   "line-height", "1.3");
        imp(span, "margin",  "0"); imp(span, "padding",   "0"); imp(span, "line-height", "1.3");
      } else {
        // Single-language: center the title
        imp(bar, "display",    "block");
        imp(bar, "padding",    "5px 10px");
        imp(bar, "min-height", "0");
        imp(bar, "text-align", "center");
        imp(bar, "overflow",   "hidden");
        imp(bar, "box-sizing", "border-box");
        imp(bar, "width",      "100%");
        [h3, span].forEach(el => {
          if (!el) return;
          imp(el, "display",    "block");
          imp(el, "text-align", "center");
          imp(el, "width",      "100%");
          imp(el, "margin",     "0");
          imp(el, "padding",    "0");
          imp(el, "line-height","1.3");
        });
      }
    });

    // ── Examination grid: flatten display:contents wrappers ───────────────────
    const examGrid = clonedDoc.querySelector<HTMLElement>(".pdf-exam-grid");
    if (examGrid) {
      Array.from(examGrid.querySelectorAll<HTMLElement>("div")).forEach(div => {
        if (div.style.display === "contents") {
          while (div.firstChild) div.parentNode!.insertBefore(div.firstChild, div);
          div.parentNode!.removeChild(div);
        }
      });
    }
  };

  let pdf: InstanceType<typeof jsPDF> | null = null;
  let firstPdfPage = true;

  try {
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`Rendering page ${i + 1} of ${pages.length}…`);

      const pageEl   = pages[i];
      const pageRect = pageEl.getBoundingClientRect();
      const headerEl = pageEl.querySelector<HTMLElement>(".letter-header-wrap");
      const footerEl = pageEl.querySelector<HTMLElement>(".letter-footer-bar");

      const headerDomH = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const footerDomH = footerEl ? footerEl.getBoundingClientRect().height : 0;
      const pageDomH   = Math.max(pageRect.height, 1);

      const fullCanvas = await html2canvas(pageEl, { ...sharedOptions, onclone: pageOnClone });

      // ── Convert DOM measurements → canvas pixels ──────────────────────────
      const domToCanvas = fullCanvas.height / pageDomH;

      // Add 4px safety margin to footer height so the 1px border-top line is
      // never accidentally cropped by sub-pixel rounding.
      const headerH = Math.ceil(headerDomH * domToCanvas);
      const footerH = Math.ceil(footerDomH * domToCanvas) + 4;

      const safeHeaderH = Math.min(headerH, Math.floor(fullCanvas.height * 0.5));
      const safeFooterH = Math.min(footerH, Math.floor(fullCanvas.height * 0.3));

      // ── A4 page height in canvas pixels ───────────────────────────────────
      // Use the minimum of (true A4 ratio) and (actual canvas height) so that
      // pages that fit within one A4 have no gap between content and footer.
      // A4Page.minHeight is now 1160px which matches 820px × 297/210 exactly,
      // so this min() is nearly a no-op but acts as a safety net.
      const naturalA4Px = Math.round((PDF_HEIGHT_MM / PDF_WIDTH_MM) * fullCanvas.width);
      const a4Px        = Math.min(fullCanvas.height, naturalA4Px);

      // ── Content strip ──────────────────────────────────────────────────────
      const contentStartY = safeHeaderH;
      const contentEndY   = fullCanvas.height - safeFooterH;
      const totalContentH = Math.max(0, contentEndY - contentStartY);

      const usableH  = Math.max(1, a4Px - safeHeaderH - safeFooterH);
      const numPages = Math.max(1, Math.ceil(totalContentH / usableH));

      for (let s = 0; s < numPages; s++) {
        const sliceCanvas  = document.createElement("canvas");
        sliceCanvas.width  = fullCanvas.width;
        sliceCanvas.height = a4Px;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) continue;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

        // 1. Header — top of every page
        if (safeHeaderH > 0) {
          ctx.drawImage(
            fullCanvas,
            0, 0, fullCanvas.width, safeHeaderH,
            0, 0, sliceCanvas.width, safeHeaderH,
          );
        }

        // 2. Content chunk
        const srcY = contentStartY + s * usableH;
        const srcH = Math.min(usableH, totalContentH - s * usableH);
        if (srcH > 0) {
          ctx.drawImage(
            fullCanvas,
            0, srcY, fullCanvas.width, srcH,
            0, safeHeaderH, sliceCanvas.width, srcH,
          );
        }

        // 3. Footer — bottom of every page (always taken from the original canvas)
        if (safeFooterH > 0) {
          // Clear the footer zone first (in case content reached this area)
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, a4Px - safeFooterH, sliceCanvas.width, safeFooterH);
          ctx.drawImage(
            fullCanvas,
            0, fullCanvas.height - safeFooterH, fullCanvas.width, safeFooterH,
            0, a4Px - safeFooterH, sliceCanvas.width, safeFooterH,
          );
        }

        // ── Add to PDF ───────────────────────────────────────────────────────
        // Page height in mm, proportional to the canvas dimensions
        const pageHeightMM = (a4Px / fullCanvas.width) * PDF_WIDTH_MM;

        if (firstPdfPage) {
          pdf = new jsPDF({
            orientation: "portrait",
            unit:        "mm",
            format:      [PDF_WIDTH_MM, pageHeightMM],
          });
          firstPdfPage = false;
        } else {
          pdf!.addPage([PDF_WIDTH_MM, pageHeightMM]);
        }

        pdf!.addImage(
          sliceCanvas.toDataURL("image/jpeg", 0.92),
          "JPEG",
          0, 0,
          PDF_WIDTH_MM,
          pageHeightMM,
        );
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
