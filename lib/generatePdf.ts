// Client-side PDF generation: direct capture of each .a4-page preview element.
//
// Architecture:
//   1. Find all .a4-page elements in the live DOM — filter empty ones.
//   2. Capture each page directly with html2canvas (no hidden containers).
//   3. From the first capture, extract header and footer strips.
//   4. Slice each page's content into A4-sized chunks, compositing the
//      shared header + content chunk + footer onto every PDF page.
//
// This eliminates blank pages caused by the previous approach (hidden fixed
// div at left:-10000px, which html2canvas rendered as an empty canvas).

const PDF_W_MM = 210;
const PDF_H_MM = 297;
const SCALE    = 2;    // capture resolution multiplier (2× = sharp on retina)
const JPEG_Q   = 0.82; // JPEG quality: readable + compact

function imp(el: HTMLElement, prop: string, val: string) {
  el.style.setProperty(prop, val, "important");
}

function onCloneFix(clonedDoc: Document): void {
  // Recolor lungistitute logo black pixels → brand purple (#1E106E).
  // html2canvas ignores CSS mix-blend-mode:screen, so we pre-bake the color.
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
            if ((px[p] + px[p + 1] + px[p + 2]) / 3 < 128)
              { px[p] = 30; px[p + 1] = 16; px[p + 2] = 110; }
          }
          ctx.putImageData(id, 0, 0);
          clonedImg.src = off.toDataURL("image/png");
        }
      }
    }
  } catch { /* logo falls back gracefully */ }

  // Fix lavender Hebrew section bars (.section-bar-he).
  // html2canvas has a bug with flex align-items:center that pushes text to bottom.
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar-he")).forEach(bar => {
    imp(bar, "display",    "block");
    imp(bar, "padding",    "7px 8px");
    imp(bar, "min-height", "0");
    imp(bar, "text-align", "center");
    imp(bar, "overflow",   "hidden");
    imp(bar, "box-sizing", "border-box");
    imp(bar, "width",      "100%");
    Array.from(bar.querySelectorAll<HTMLElement>("h3, span")).forEach(el => {
      imp(el, "display",     "block");
      imp(el, "text-align",  "center");
      imp(el, "width",       "100%");
      imp(el, "margin",      "0");
      imp(el, "padding",     "0");
      imp(el, "line-height", "1.3");
    });
  });

  // Fix grey English section bars (.section-bar).
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar")).forEach(bar => {
    const h3   = bar.querySelector<HTMLElement>(":scope > h3");
    const span = bar.querySelector<HTMLElement>(":scope > span");
    if (h3 && span) {
      imp(bar,  "display",         "flex");
      imp(bar,  "flex-direction",  "row");
      imp(bar,  "justify-content", "space-between");
      imp(bar,  "align-items",     "flex-start");
      imp(bar,  "padding",         "5px 10px");
      imp(bar,  "min-height",      "0");
      imp(bar,  "box-sizing",      "border-box");
      imp(h3,   "margin", "0"); imp(h3,   "padding", "0"); imp(h3,   "line-height", "1.3");
      imp(span, "margin", "0"); imp(span, "padding", "0"); imp(span, "line-height", "1.3");
    } else {
      imp(bar, "display",    "block");
      imp(bar, "padding",    "5px 10px");
      imp(bar, "min-height", "0");
      imp(bar, "text-align", "center");
      imp(bar, "overflow",   "hidden");
      imp(bar, "box-sizing", "border-box");
      imp(bar, "width",      "100%");
      [h3, span].forEach(el => {
        if (!el) return;
        imp(el, "display",     "block");
        imp(el, "text-align",  "center");
        imp(el, "width",       "100%");
        imp(el, "margin",      "0");
        imp(el, "padding",     "0");
        imp(el, "line-height", "1.3");
      });
    }
  });

  // Unwrap display:contents divs in the exam grid (not supported by html2canvas).
  const examGrid = clonedDoc.querySelector<HTMLElement>(".pdf-exam-grid");
  if (examGrid) {
    Array.from(examGrid.querySelectorAll<HTMLElement>("div")).forEach(div => {
      if (div.style.display === "contents") {
        while (div.firstChild) div.parentNode!.insertBefore(div.firstChild, div);
        div.parentNode!.removeChild(div);
      }
    });
  }
}

async function buildLetterPdfDoc(onProgress?: (msg: string) => void): Promise<unknown> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF }   = await import("jspdf");

  const allPages = Array.from(document.querySelectorAll<HTMLElement>(".a4-page"));
  if (allPages.length === 0)
    throw new Error("No letter pages found. Please open the letter preview first.");

  // Skip pages with no visible text — prevents exporting blank PDF pages
  const pages = allPages.filter(p => (p.innerText?.trim() ?? "").length > 0);
  if (pages.length === 0)
    throw new Error("Letter pages appear to be empty — nothing to export.");

  if (document.fonts?.ready) await document.fonts.ready;

  // Wait for all images in the visible pages to finish loading
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

  // Inject capture-time style overrides into the live document.
  // html2canvas clones the document including these styles.
  const captureStyle = document.createElement("style");
  captureStyle.textContent = `
    .a4-page {
      box-shadow: none !important;
      width: 820px !important;
      max-width: 820px !important;
      min-width: 820px !important;
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
  document.head.appendChild(captureStyle);

  const captureOpts = {
    scale:           SCALE,
    useCORS:         true,
    allowTaint:      true,
    logging:         false,
    backgroundColor: "#ffffff",
    imageTimeout:    15000,
    windowWidth:     820,
    onclone:         onCloneFix as (clonedDoc: Document) => void,
  };

  let pdf:         InstanceType<typeof jsPDF> | null = null;
  let headerStrip: HTMLCanvasElement | null = null;
  let footerStrip: HTMLCanvasElement | null = null;
  let headerH  = 0;
  let footerH  = 0;
  let CANVAS_W    = Math.round(820 * SCALE);                         // updated from first capture
  let A4_CANVAS_H = Math.round(CANVAS_W * (PDF_H_MM / PDF_W_MM));   // updated from first capture

  try {
    for (let pi = 0; pi < pages.length; pi++) {
      const pageEl = pages[pi];
      onProgress?.(`Capturing page ${pi + 1} of ${pages.length}…`);

      // Capture the full .a4-page element directly from the live DOM
      const pageCanvas = await html2canvas(pageEl, captureOpts);

      // First page: lock dimensions and extract reusable header/footer strips
      if (pi === 0) {
        CANVAS_W    = pageCanvas.width;
        A4_CANVAS_H = Math.round(CANVAS_W * (PDF_H_MM / PDF_W_MM));

        const headerEl = pageEl.querySelector<HTMLElement>(".letter-header-wrap");
        const footerEl = pageEl.querySelector<HTMLElement>(".letter-footer-bar");
        const pageDomH = Math.max(pageEl.getBoundingClientRect().height, 1);
        const hdrDomH  = headerEl?.getBoundingClientRect().height ?? 0;
        const ftrDomH  = footerEl?.getBoundingClientRect().height ?? 0;

        const domScale = pageCanvas.height / pageDomH;
        headerH = Math.min(Math.ceil(hdrDomH * domScale),     Math.floor(A4_CANVAS_H * 0.40));
        footerH = Math.min(Math.ceil(ftrDomH * domScale) + 4, Math.floor(A4_CANVAS_H * 0.20));

        headerStrip        = document.createElement("canvas");
        headerStrip.width  = CANVAS_W;
        headerStrip.height = headerH;
        headerStrip.getContext("2d")!.drawImage(
          pageCanvas, 0, 0, CANVAS_W, headerH,
          0, 0, CANVAS_W, headerH,
        );

        footerStrip        = document.createElement("canvas");
        footerStrip.width  = CANVAS_W;
        footerStrip.height = footerH;
        footerStrip.getContext("2d")!.drawImage(
          pageCanvas,
          0, pageCanvas.height - footerH, CANVAS_W, footerH,
          0, 0, CANVAS_W, footerH,
        );
      }

      // Content region sits between header and footer in the captured canvas
      const usableH     = A4_CANVAS_H - headerH - footerH;
      if (usableH <= 0) throw new Error("Header/footer height leaves no room for content.");

      const contentStart = headerH;
      const contentEnd   = pageCanvas.height - footerH;
      const contentH     = Math.max(0, contentEnd - contentStart);

      // A page taller than A4 (content overflow) becomes multiple PDF pages
      const numSlices = Math.max(1, Math.ceil(contentH / usableH));

      for (let s = 0; s < numSlices; s++) {
        if (numSlices > 1) onProgress?.(`Page ${pi + 1} · part ${s + 1}/${numSlices}…`);

        const srcY = contentStart + s * usableH;
        const srcH = Math.min(usableH, contentEnd - srcY);

        // Build one A4-sized canvas: header strip + content slice + footer strip
        const sliceCanvas        = document.createElement("canvas");
        sliceCanvas.width        = CANVAS_W;
        sliceCanvas.height       = A4_CANVAS_H;
        const ctx                = sliceCanvas.getContext("2d")!;

        // White background (fills the gap on the last partial slice)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, A4_CANVAS_H);

        // Header at top of every page
        if (headerStrip && headerH > 0) {
          ctx.drawImage(headerStrip, 0, 0, CANVAS_W, headerH, 0, 0, CANVAS_W, headerH);
        }

        // Content slice (white space below if srcH < usableH — last page padding)
        if (srcH > 0) {
          ctx.drawImage(pageCanvas, 0, srcY, CANVAS_W, srcH, 0, headerH, CANVAS_W, srcH);
        }

        // Footer pinned at bottom of every page
        if (footerStrip && footerH > 0) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, A4_CANVAS_H - footerH, CANVAS_W, footerH);
          ctx.drawImage(footerStrip, 0, 0, CANVAS_W, footerH, 0, A4_CANVAS_H - footerH, CANVAS_W, footerH);
        }

        // Add page to PDF at exact A4 dimensions
        const pageHMM = (A4_CANVAS_H / CANVAS_W) * PDF_W_MM; // ≈ 297 mm
        if (pdf === null) {
          pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PDF_W_MM, pageHMM] });
        } else {
          pdf.addPage([PDF_W_MM, pageHMM]);
        }
        pdf.addImage(sliceCanvas.toDataURL("image/jpeg", JPEG_Q), "JPEG", 0, 0, PDF_W_MM, pageHMM);
      }
    }
  } finally {
    document.head.removeChild(captureStyle);
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
