// Client-side PDF generation from the rendered letter preview.
//
// Architecture: capture each .a4-page at full height, then decompose the canvas
// into three strips — header, content, footer — and re-compose them on every
// PDF page so that:
//   • Header is always at the top of every page
//   • Footer is always at the bottom of every page
//   • Content fills the space between them (sliced if it overflows one page)
//
// This replaces the previous "slice the full canvas" approach, which put the
// footer in the wrong position on the last slice.

const PDF_WIDTH_MM  = 210; // A4 width
const PDF_HEIGHT_MM = 297; // A4 height — fixed for every page

async function buildLetterPdfDoc(onProgress?: (msg: string) => void): Promise<unknown> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF }   = await import("jspdf");

  const pages = Array.from(document.querySelectorAll<HTMLElement>(".a4-page"));
  if (pages.length === 0) throw new Error("No letter pages found to export.");

  if (document.fonts?.ready) await document.fonts.ready;

  // Wait for images to finish loading
  const allImages = Array.from(document.querySelectorAll<HTMLImageElement>(".a4-page img"));
  const unloaded  = allImages.filter((img) => !img.complete || img.naturalWidth === 0);
  if (unloaded.length > 0) {
    onProgress?.("Waiting for images…");
    let failCount = 0;
    await Promise.all(
      unloaded.map((img) =>
        new Promise<void>((resolve) => {
          img.onload  = () => resolve();
          img.onerror = () => { failCount++; resolve(); };
          // Safari: re-trigger load on external images that are stuck
          if (img.src && !img.src.startsWith("data:") && !img.complete) {
            const s = img.src; img.src = ""; img.src = s;
          }
        }),
      ),
    );
    if (failCount > 0) console.warn(`[generatePdf] ${failCount} image(s) failed to load.`);
  }

  // ── Override styles (applied to live doc, cloned into html2canvas) ───────────
  const overrideStyle = document.createElement("style");
  overrideStyle.textContent = `
    .a4-page {
      width: 820px !important;
      max-width: 820px !important;
      min-width: 820px !important;
      box-shadow: none !important;
    }
    .preview-wrapper { background: white !important; gap: 0 !important; }

    /* Lungistitute: mix-blend-mode:screen unsupported in html2canvas;
       onclone pixel-colorizes the logo instead */
    .lungistitute-wrap { background-color: white !important; isolation: auto !important; }
    .lungistitute-wrap img { mix-blend-mode: normal !important; }

    /* Header: block + text-align so the logo is reliably centred */
    .letter-header-wrap { display: block !important; text-align: center !important; }
    .letter-header-wrap > img { display: inline-block !important; }

    /* Patient details: replace CSS gap with margin so html2canvas renders it */
    .pdf-patient-cols { gap: 0 !important; }
    .pdf-patient-cols > div:first-child { margin-right: 32px !important; }
    .pdf-lv { gap: 0 !important; }
    .pdf-lv > span:first-child { margin-right: 8px !important; }
  `;
  document.head.appendChild(overrideStyle);

  // ── Shared html2canvas config ─────────────────────────────────────────────────
  const sharedOptions = {
    scale:           2,
    useCORS:         true,
    allowTaint:      true,
    logging:         false,
    backgroundColor: "#ffffff",
    imageTimeout:    10000,
    windowWidth:     820,
  };

  // ── onclone: applied to the CLONED document before rendering ─────────────────
  const pageOnClone = (clonedDoc: Document) => {
    // ── Lungistitute logo: pixel-colorize dark strokes to brand purple ──────
    try {
      const clonedImg = clonedDoc.querySelector<HTMLImageElement>(".lungistitute-wrap img");
      if (clonedImg) {
        const srcImg = document.querySelector<HTMLImageElement>(".lungistitute-wrap img");
        if (srcImg?.complete && srcImg.naturalWidth) {
          const off = document.createElement("canvas");
          off.width  = srcImg.naturalWidth;
          off.height = srcImg.naturalHeight;
          const ctx  = off.getContext("2d");
          if (ctx) {
            ctx.drawImage(srcImg, 0, 0);
            const id  = ctx.getImageData(0, 0, off.width, off.height);
            const px  = id.data;
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
    } catch { /* logo renders as black — acceptable fallback */ }

    // ── Section-header vertical centering ─────────────────────────────────
    //
    // html2canvas has a known bug: flex align-items:center places children at
    // the BOTTOM of the container. The fix is to inject a stylesheet with
    // !important into the clone — this reliably overrides the original inline
    // display:flex because !important in any author stylesheet beats inline styles.
    //
    // Strategy:
    //  • Lavender bars (.section-bar-he): block + symmetric padding (7px)
    //  • Grey bars, single language (.pdf-bar-mono): block + symmetric padding (5px)
    //  • Grey bars, bilingual (.pdf-bar-bilingual): flex-row + align-start + padding
    //    (English left, Hebrew right — keep the space-between layout, just fix centering)

    // Tag bars before injecting CSS so the selectors work
    Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar")).forEach(bar => {
      const hasTitle = !!bar.querySelector(":scope > h3");
      const hasHe    = !!bar.querySelector(":scope > span");
      bar.classList.add(hasTitle && hasHe ? "pdf-bar-bilingual" : "pdf-bar-mono");
    });

    const fix = clonedDoc.createElement("style");
    fix.textContent = `
      /* Lavender bars: block + symmetric padding */
      .section-bar-he {
        display: block !important;
        padding: 7px 8px !important;
        min-height: 0 !important;
        text-align: center !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      .section-bar-he > h3 {
        display: block !important;
        line-height: 1.3 !important;
        margin: 0 !important;
        padding: 0 !important;
        text-align: center !important;
      }

      /* Grey bars — single language */
      .section-bar.pdf-bar-mono {
        display: block !important;
        padding: 5px 10px !important;
        min-height: 0 !important;
        text-align: center !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      .section-bar.pdf-bar-mono > h3,
      .section-bar.pdf-bar-mono > span {
        display: block !important;
        line-height: 1.3 !important;
        margin: 0 !important;
        padding: 0 !important;
        text-align: center !important;
      }

      /* Grey bars — bilingual (English left, Hebrew right) */
      .section-bar.pdf-bar-bilingual {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        padding: 5px 10px !important;
        min-height: 0 !important;
        box-sizing: border-box !important;
      }
      .section-bar.pdf-bar-bilingual > h3,
      .section-bar.pdf-bar-bilingual > span {
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1.3 !important;
      }
    `;
    clonedDoc.head.appendChild(fix);

    // ── Examination grid: flatten display:contents wrappers ────────────────
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

      const pageEl = pages[i];

      // ── Measure header/footer heights in DOM pixels BEFORE capture ────────
      // getBoundingClientRect reflects the actual rendered layout including
      // any styles injected by overrideStyle above.
      const pageRect    = pageEl.getBoundingClientRect();
      const headerEl    = pageEl.querySelector<HTMLElement>(".letter-header-wrap");
      const footerEl    = pageEl.querySelector<HTMLElement>(".letter-footer-bar");
      const headerDomH  = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const footerDomH  = footerEl ? footerEl.getBoundingClientRect().height : 0;
      const pageDomH    = Math.max(pageRect.height, 1);

      // ── Capture the full page ─────────────────────────────────────────────
      const fullCanvas = await html2canvas(pageEl, { ...sharedOptions, onclone: pageOnClone });

      // ── Convert DOM measurements → canvas pixels ──────────────────────────
      // domToCanvas accounts for any difference between the DOM render size and
      // the html2canvas render size (scale, windowWidth, etc.).
      const domToCanvas = fullCanvas.height / pageDomH;
      const headerH     = Math.round(headerDomH * domToCanvas);
      const footerH     = Math.round(footerDomH * domToCanvas);

      // Guard: never let header+footer consume more than 80% of the canvas
      const safeHeaderH = Math.min(headerH, Math.floor(fullCanvas.height * 0.5));
      const safeFooterH = Math.min(footerH, Math.floor(fullCanvas.height * 0.3));

      // ── Content strip: the area between header and footer ─────────────────
      const contentStartY  = safeHeaderH;
      const contentEndY    = fullCanvas.height - safeFooterH;
      const totalContentH  = Math.max(0, contentEndY - contentStartY);

      // ── Fixed A4 height in canvas pixels ──────────────────────────────────
      const a4Px = Math.round((PDF_HEIGHT_MM / PDF_WIDTH_MM) * fullCanvas.width);

      // Usable content height per PDF page (A4 minus header and footer)
      const usableH  = Math.max(1, a4Px - safeHeaderH - safeFooterH);
      const numPages = Math.max(1, Math.ceil(totalContentH / usableH));

      for (let s = 0; s < numPages; s++) {
        const sliceCanvas  = document.createElement("canvas");
        sliceCanvas.width  = fullCanvas.width;
        sliceCanvas.height = a4Px;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) continue;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

        // 1. Header — always at the top of every page
        if (safeHeaderH > 0) {
          ctx.drawImage(
            fullCanvas,
            0, 0, fullCanvas.width, safeHeaderH,
            0, 0, sliceCanvas.width, safeHeaderH,
          );
        }

        // 2. Content chunk for this page
        const srcY = contentStartY + s * usableH;
        const srcH = Math.min(usableH, totalContentH - s * usableH);
        if (srcH > 0) {
          ctx.drawImage(
            fullCanvas,
            0, srcY, fullCanvas.width, srcH,
            0, safeHeaderH, sliceCanvas.width, srcH,
          );
        }

        // 3. Footer — always at the bottom of every page
        if (safeFooterH > 0) {
          ctx.drawImage(
            fullCanvas,
            0, fullCanvas.height - safeFooterH, fullCanvas.width, safeFooterH,
            0, a4Px - safeFooterH, sliceCanvas.width, safeFooterH,
          );
        }

        // ── Add page to PDF ────────────────────────────────────────────────
        if (firstPdfPage) {
          pdf = new jsPDF({
            orientation: "portrait",
            unit:        "mm",
            format:      [PDF_WIDTH_MM, PDF_HEIGHT_MM],
          });
          firstPdfPage = false;
        } else {
          pdf!.addPage([PDF_WIDTH_MM, PDF_HEIGHT_MM]);
        }

        // 0.92 quality — higher than the previous 0.75 for better text clarity
        pdf!.addImage(
          sliceCanvas.toDataURL("image/jpeg", 0.92),
          "JPEG",
          0, 0,
          PDF_WIDTH_MM,
          PDF_HEIGHT_MM,
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
