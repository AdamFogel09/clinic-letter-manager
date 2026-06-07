// Client-side PDF generation from the rendered letter preview.
// Captures each .a4-page element with html2canvas, slices into fixed A4 pages,
// and composites the footer on every intermediate slice so the footer appears
// at the bottom of every PDF page regardless of content length.

const PDF_WIDTH_MM  = 210; // A4 width in mm
const PDF_HEIGHT_MM = 297; // A4 height in mm (fixed for every page)

async function buildLetterPdfDoc(onProgress?: (msg: string) => void): Promise<unknown> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF }   = await import("jspdf");

  const pages = Array.from(document.querySelectorAll<HTMLElement>(".a4-page"));
  if (pages.length === 0) throw new Error("No letter pages found to export.");

  // Wait for fonts before capturing so text renders at correct weight/family
  if (document.fonts?.ready) await document.fonts.ready;

  // Wait for all images inside the letter pages to finish loading.
  // Track failures so we can warn the caller without blocking the export.
  const allImages = Array.from(document.querySelectorAll<HTMLImageElement>(".a4-page img"));
  const unloaded  = allImages.filter((img) => !img.complete || img.naturalWidth === 0);
  if (unloaded.length > 0) {
    onProgress?.("Waiting for images…");
    let imageFailCount = 0;
    await Promise.all(
      unloaded.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.onload  = () => resolve();
            img.onerror = () => { imageFailCount++; resolve(); };
            // Safari: force re-fetch on external (non-data) images if stuck
            if (img.src && !img.src.startsWith("data:") && !img.complete) {
              const saved = img.src;
              img.src = "";
              img.src = saved;
            }
          })
      )
    );
    if (imageFailCount > 0) {
      console.warn(`[generatePdf] ${imageFailCount} image(s) failed to load — continuing without them.`);
    }
  }

  // ── Override styles (applied during capture only) ────────────────────────────
  const overrideStyle = document.createElement("style");
  overrideStyle.textContent = `
    /* Force exact A4 width so layout doesn't depend on browser window size */
    .a4-page {
      width: 820px !important;
      max-width: 820px !important;
      min-width: 820px !important;
      box-shadow: none !important;
    }
    .preview-wrapper { background: white !important; gap: 0 !important; }

    /* Lungistitute logo: mix-blend-mode:screen is unsupported in html2canvas.
       onclone callback pixel-colorizes the image to brand purple; here we just
       ensure the container has no dark background that bleeds into the capture. */
    .lungistitute-wrap {
      background-color: white !important;
      isolation: auto !important;
    }
    .lungistitute-wrap img {
      mix-blend-mode: normal !important;
    }

    /* Section header vertical centering fix.
       html2canvas 1.4.x has a bug where align-items:center renders flex children
       at the BOTTOM of the container instead of the middle. Override to flex-start;
       onclone then replaces flex with display:block + line-height centering. */
    .section-bar-he,
    .section-bar {
      align-items: flex-start !important;
    }
    .section-bar-he h3,
    .section-bar h3,
    .section-bar > span {
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Letter header: flex column + align-items:center may render the logo at the
       right edge. Convert to block + text-align so the logo is reliably centred. */
    .letter-header-wrap {
      display: block !important;
      text-align: center !important;
    }
    .letter-header-wrap > img {
      display: inline-block !important;
    }

    /* Patient details layout: replace CSS gap with explicit margin so the
       column spacing and label-value spacing render reliably in html2canvas. */
    .pdf-patient-cols {
      gap: 0 !important;
    }
    .pdf-patient-cols > div:first-child {
      margin-right: 32px !important;
    }
    .pdf-lv {
      gap: 0 !important;
    }
    .pdf-lv > span:first-child {
      margin-right: 8px !important;
    }
  `;
  document.head.appendChild(overrideStyle);

  // Shared html2canvas options (reused for both footer and page captures)
  const sharedOptions = {
    scale:           2,
    useCORS:         true,
    allowTaint:      true,
    logging:         false,
    backgroundColor: "#ffffff",
    imageTimeout:    10000,
    windowWidth:     820,
  };

  // onclone applied to every full-page capture
  const pageOnClone = (clonedDoc: Document) => {
    // ── Lungistitute logo: pixel-colorize dark strokes to brand purple ──
    try {
      const clonedImg = clonedDoc.querySelector<HTMLImageElement>(".lungistitute-wrap img");
      if (clonedImg) {
        const srcImg = document.querySelector<HTMLImageElement>(".lungistitute-wrap img");
        if (srcImg?.complete && srcImg.naturalWidth) {
          const offscreen = document.createElement("canvas");
          offscreen.width  = srcImg.naturalWidth;
          offscreen.height = srcImg.naturalHeight;
          const ctx = offscreen.getContext("2d");
          if (ctx) {
            ctx.drawImage(srcImg, 0, 0);
            const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
            const pixels = imageData.data;
            for (let px = 0; px < pixels.length; px += 4) {
              if ((pixels[px] + pixels[px + 1] + pixels[px + 2]) / 3 < 128) {
                pixels[px]     = 30;
                pixels[px + 1] = 16;
                pixels[px + 2] = 110;
              }
            }
            ctx.putImageData(imageData, 0, 0);
            clonedImg.src = offscreen.toDataURL("image/png");
          }
        }
      }
    } catch {
      // fallback: logo renders as black-on-white
    }

    // ── Section header vertical centering ──────────────────────────────
    // Lavender/grey bars (אבחנה/סיכום/תכנית/נקודות חשובות), fixed 28px height.
    Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar-he")).forEach(bar => {
      bar.style.display    = "block";
      bar.style.minHeight  = "0";
      bar.style.height     = "28px";
      bar.style.lineHeight = "28px";
      bar.style.textAlign  = "center";
      bar.style.padding    = "0 8px";
      bar.style.boxSizing  = "border-box";
      bar.style.overflow   = "hidden";
      Array.from(bar.querySelectorAll<HTMLElement>("h3, span")).forEach(el => {
        el.style.display    = "block";
        el.style.lineHeight = "28px";
        el.style.textAlign  = "center";
        el.style.margin     = "0";
        el.style.padding    = "0";
        el.style.width      = "100%";
      });
    });

    // Grey section bars
    Array.from(clonedDoc.querySelectorAll<HTMLElement>(".section-bar")).forEach(bar => {
      const h3   = bar.querySelector("h3");
      const span = bar.querySelector("span");
      if (h3 && span) {
        bar.style.alignItems    = "flex-start";
        bar.style.paddingTop    = "5px";
        bar.style.paddingBottom = "5px";
        (h3 as HTMLElement).style.margin  = "0";
        (h3 as HTMLElement).style.padding = "0";
        (span as HTMLElement).style.margin  = "0";
        (span as HTMLElement).style.padding = "0";
      } else {
        bar.style.display    = "block";
        bar.style.minHeight  = "0";
        bar.style.padding    = "5px 10px";
        bar.style.textAlign  = "center";
        bar.style.boxSizing  = "border-box";
        bar.style.overflow   = "hidden";
        Array.from(bar.querySelectorAll<HTMLElement>("h3, span")).forEach(el => {
          el.style.display   = "block";
          el.style.textAlign = "center";
          el.style.margin    = "0";
          el.style.padding   = "0";
          el.style.width     = "100%";
        });
      }
    });

    // ── Examination grid: fix display:contents wrappers ─────────────────
    const examGrid = clonedDoc.querySelector<HTMLElement>(".pdf-exam-grid");
    if (examGrid) {
      Array.from(examGrid.querySelectorAll<HTMLElement>("div")).forEach(div => {
        if (div.style.display === "contents") {
          while (div.firstChild) {
            div.parentNode!.insertBefore(div.firstChild, div);
          }
          div.parentNode!.removeChild(div);
        }
      });
    }
  };

  let pdf: InstanceType<typeof jsPDF> | null = null;
  let firstPdfPage = true;

  try {
    // ── Capture footer once for compositing onto intermediate slices ──────────
    // When page content overflows A4 height, we slice the canvas and add the
    // footer image at the bottom of every intermediate slice so the footer
    // appears on every printed page.
    let footerCanvas: HTMLCanvasElement | null = null;
    try {
      const footerEl = pages[0]?.querySelector<HTMLElement>(".letter-footer-bar");
      if (footerEl) {
        footerCanvas = await html2canvas(footerEl, { ...sharedOptions });
      }
    } catch {
      // Footer capture failed — intermediate slices will have no footer (graceful degradation)
    }

    // ── Main loop: one A4Page element → one or more PDF pages ─────────────────
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(`Rendering page ${i + 1} of ${pages.length}…`);

      const fullCanvas = await html2canvas(pages[i], {
        ...sharedOptions,
        onclone: pageOnClone,
      });

      // A4 height in canvas pixels: proportional to the captured width
      const a4HeightPx = Math.round((PDF_HEIGHT_MM / PDF_WIDTH_MM) * fullCanvas.width);

      // Number of A4 slices needed (content may exceed one A4 page)
      const numSlices = Math.max(1, Math.ceil(fullCanvas.height / a4HeightPx));

      for (let s = 0; s < numSlices; s++) {
        // Build a canvas exactly A4-sized for this slice
        const sliceCanvas  = document.createElement("canvas");
        sliceCanvas.width  = fullCanvas.width;
        sliceCanvas.height = a4HeightPx;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) continue;

        // White background (the last slice may be shorter than A4 — pad with white)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

        // Draw the portion of the full canvas that belongs to this slice
        ctx.drawImage(
          fullCanvas,
          0, 0, fullCanvas.width, fullCanvas.height,
          0, -s * a4HeightPx, fullCanvas.width, fullCanvas.height,
        );

        // For intermediate slices (not the last), overlay the footer at the bottom.
        // The last slice already contains the original rendered footer from the DOM.
        if (s < numSlices - 1 && footerCanvas && footerCanvas.width > 0) {
          // Scale the footer to match the slice width
          const footerScaledH = Math.round(
            footerCanvas.height * (sliceCanvas.width / footerCanvas.width)
          );
          const footerY = sliceCanvas.height - footerScaledH;
          // Erase the area where we'll draw the footer (avoids double-drawing if content reached there)
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, footerY, sliceCanvas.width, footerScaledH);
          ctx.drawImage(
            footerCanvas,
            0, 0, footerCanvas.width, footerCanvas.height,
            0, footerY, sliceCanvas.width, footerScaledH,
          );
        }

        // Add PDF page (always A4)
        if (firstPdfPage) {
          pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: [PDF_WIDTH_MM, PDF_HEIGHT_MM],
          });
          firstPdfPage = false;
        } else {
          pdf!.addPage([PDF_WIDTH_MM, PDF_HEIGHT_MM]);
        }

        // JPEG 0.75 balances print clarity with file size.
        pdf!.addImage(
          sliceCanvas.toDataURL("image/jpeg", 0.75),
          "JPEG",
          0, 0,
          PDF_WIDTH_MM,
          PDF_HEIGHT_MM,
        );

        // Overlay clickable link annotations so hyperlinks survive the image-based export.
        // Only on the first slice of each page (links are near the top of the content).
        if (s === 0) {
          const currentPdf = pdf!;
          const pageRect   = pages[i].getBoundingClientRect();
          if (pageRect.width > 0 && pageRect.height > 0) {
            const scaleX = PDF_WIDTH_MM  / pageRect.width;
            const scaleY = PDF_HEIGHT_MM / pageRect.height;
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
 * Used when the PDF needs to be uploaded to Supabase Storage.
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
