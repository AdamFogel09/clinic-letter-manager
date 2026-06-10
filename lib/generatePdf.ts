// PDF export: direct screenshot of each fixed-size .a4-page element.
//
// Architecture (new):
//   1. Find all .a4-page elements rendered by the preview PageBuilder.
//   2. Filter out genuinely empty pages (text + image + SVG check).
//   3. Wait for fonts and images to load.
//   4. Capture each page with html2canvas — pages are already exactly 1160 px
//      tall (fixed by A4Page component), so no slicing needed.
//   5. Add each captured canvas as one A4 PDF page (210 × 297 mm).
//
// This eliminates all blank pages caused by the previous slicer approach,
// which created nearly-empty "last slice" pages whenever content was even
// slightly taller than A4.

const PDF_W_MM = 210;
const PDF_H_MM = 297;
const SCALE    = 1.5;   // 1.5× → sharp text, ~30 % smaller than 2×
const JPEG_Q   = 0.82;  // JPEG quality: readable + compact

function imp(el: HTMLElement, prop: string, val: string) {
  el.style.setProperty(prop, val, "important");
}

/** Returns true if a page element has no meaningful visible content. */
export function isPageEmpty(pageEl: HTMLElement): boolean {
  // Windowed pages carry data-content-offset / data-total-height so we can tell
  // whether this viewport actually shows any content from the flow.
  const offset = parseFloat(pageEl.dataset.contentOffset ?? "0");
  const totalH = parseFloat(pageEl.dataset.totalHeight  ?? "-1");
  if (totalH >= 0 && offset >= totalH) return true;

  const contentEl = pageEl.querySelector<HTMLElement>(".a4-page-content");
  if (!contentEl) return true;

  // Text covers most sections (diagnosis, summary, plan, etc.)
  if ((contentEl.innerText ?? "").trim().length > 0) return false;

  // Images (pictures page, inhaler images, stamp — innerText misses these)
  const imgs = Array.from(contentEl.querySelectorAll<HTMLImageElement>("img"));
  if (imgs.some(img => img.complete && img.naturalWidth > 0)) return false;

  // Inline SVG icons
  if (contentEl.querySelector("svg")) return false;

  return true;
}

function onCloneFix(clonedDoc: Document): void {
  // Force each .a4-page in the clone to exactly 1160 px and clip overflow,
  // so html2canvas captures a clean A4-sized rectangle every time.
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".a4-page")).forEach(page => {
    imp(page, "height",     "1160px");
    imp(page, "min-height", "1160px");
    imp(page, "max-height", "1160px");
    imp(page, "overflow",   "hidden");
    imp(page, "box-shadow", "none");
    imp(page, "margin",     "0");
  });
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".a4-page-content")).forEach(el => {
    imp(el, "overflow", "hidden");
  });
  // Remove the grey background and gap between pages visible in the browser.
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".preview-wrapper")).forEach(el => {
    imp(el, "background", "white");
    imp(el, "gap",        "0");
    imp(el, "padding",    "0");
  });

  // Recolor lungistitute logo: html2canvas ignores mix-blend-mode:screen,
  // so we pre-bake black pixels → brand purple (#1E106E).
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

  // Fix header: reinforce flex centering so the logo stays horizontally centered.
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".letter-header-wrap")).forEach(hdr => {
    imp(hdr, "display",         "flex");
    imp(hdr, "flex-direction",  "column");
    imp(hdr, "align-items",     "center");
    imp(hdr, "justify-content", "center");
    imp(hdr, "text-align",      "center");
  });
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".letter-header-wrap img")).forEach(img => {
    imp(img, "display", "block");
    imp(img, "margin",  "0 auto");
  });

  // Fix Hebrew section bars (.section-bar-he): block + text-align center + inline-block child.
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar-he")).forEach(bar => {
    imp(bar, "display",    "block");
    imp(bar, "text-align", "center");
    imp(bar, "padding",    "4px 8px 9px");
    imp(bar, "box-sizing", "border-box");
    imp(bar, "width",      "100%");
    Array.from(bar.querySelectorAll<HTMLElement>(".section-title-text")).forEach(el => {
      imp(el, "display",     "inline-block");
      imp(el, "text-align",  "center");
      imp(el, "margin",      "0");
      imp(el, "padding",     "0");
      imp(el, "line-height", "1");
    });
  });

  // Fix English section bars (.section-bar): single title = block+center, bilingual = flex space-between.
  // Using inline-block children + text-align:center is universally supported including html2canvas.
  Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar")).forEach(bar => {
    const items = Array.from(bar.querySelectorAll<HTMLElement>(":scope > .section-title-text"));
    if (items.length >= 2) {
      imp(bar, "display",         "flex");
      imp(bar, "flex-direction",  "row");
      imp(bar, "align-items",     "flex-start");
      imp(bar, "justify-content", "space-between");
      imp(bar, "padding",         "3px 10px 8px");
      imp(bar, "box-sizing",      "border-box");
    } else {
      imp(bar, "display",    "block");
      imp(bar, "text-align", "center");
      imp(bar, "padding",    "3px 10px 8px");
      imp(bar, "box-sizing", "border-box");
      imp(bar, "width",      "100%");
    }
    items.forEach(el => {
      imp(el, "display",     "inline-block");
      imp(el, "margin",      "0");
      imp(el, "padding",     "0");
      imp(el, "line-height", "1");
    });
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

  // Filter pages that contain no real content.
  const pages = allPages.filter(p => !isPageEmpty(p));
  if (pages.length === 0)
    throw new Error("Letter pages appear to be empty — nothing to export.");

  // Wait for web fonts.
  if (document.fonts?.ready) await document.fonts.ready;

  // Wait for all images in the visible pages to finish loading.
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

  // Inject capture-time style overrides (applied to live document; onclone mirrors them).
  const captureStyle = document.createElement("style");
  captureStyle.textContent = `
    .a4-page {
      box-shadow: none !important;
      width: 820px !important;
      max-width: 820px !important;
      min-width: 820px !important;
    }
    .preview-wrapper { background: white !important; gap: 0 !important; padding: 0 !important; }
    .lungistitute-wrap { background-color: white !important; isolation: auto !important; }
    .lungistitute-wrap img { mix-blend-mode: normal !important; }
    .letter-header-wrap { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; }
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

  let pdf: InstanceType<typeof jsPDF> | null = null;

  try {
    for (let pi = 0; pi < pages.length; pi++) {
      const pageEl = pages[pi];
      onProgress?.(`Capturing page ${pi + 1} of ${pages.length}…`);

      // Capture the page. onCloneFix forces height: 1160px + overflow: hidden in
      // the clone, so the canvas is always exactly 820 × 1160 (at 1× scale).
      const canvas = await html2canvas(pageEl, captureOpts);

      // All PDF pages are standard A4 (210 × 297 mm).
      if (pdf === null) {
        pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PDF_W_MM, PDF_H_MM] });
      } else {
        pdf.addPage([PDF_W_MM, PDF_H_MM]);
      }

      pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_Q), "JPEG", 0, 0, PDF_W_MM, PDF_H_MM);
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
