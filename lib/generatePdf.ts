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

  // Wait for fonts before capturing so text renders at correct weight/family
  if (document.fonts?.ready) await document.fonts.ready;

  // Wait for all images inside the letter pages to finish loading
  const allImages = Array.from(document.querySelectorAll<HTMLImageElement>(".a4-page img"));
  const unloaded  = allImages.filter((img) => !img.complete || img.naturalWidth === 0);
  if (unloaded.length > 0) {
    onProgress?.("Waiting for images…");
    await Promise.all(
      unloaded.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.onload  = () => resolve();
            img.onerror = () => resolve(); // don't block on broken images
          })
      )
    );
  }

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
        imageTimeout: 10000,
        // Tell html2canvas to treat the viewport as 820px so responsive
        // breakpoints don't fire even on narrow browser windows
        windowWidth: 820,
        // Colorize the lungistitute logo to brand purple before html2canvas
        // captures it. The preview uses mix-blend-mode:screen (unsupported by
        // html2canvas); instead we pixel-manipulate the cloned image so dark
        // strokes become #1E106E while white background pixels stay white.
        onclone: (clonedDoc: Document) => {
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
          // html2canvas flex alignment is unreliable regardless of align-items value.
          // Replace flex containers with display:block + line-height centering,
          // which html2canvas handles correctly and guarantees text is centered.
          // This only affects the clone used for capture — the live preview is unchanged.

          // Lavender/grey bars (אבחנה/סיכום/תכנית/נקודות חשובות), fixed 28px height.
          // Use display:block on bar + line-height trick for vertical centering.
          // Use display:block on children (not inline) so html2canvas text-align
          // applies reliably — inline on h3 is ignored by html2canvas's layout engine.
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
              // Space-between bar (e.g. Pictures/תמונות): keep flex for horizontal layout;
              // symmetric 5px padding already centers vertically, just clear any offset.
              bar.style.alignItems    = "flex-start";
              bar.style.paddingTop    = "5px";
              bar.style.paddingBottom = "5px";
              (h3 as HTMLElement).style.margin  = "0";
              (h3 as HTMLElement).style.padding = "0";
              (span as HTMLElement).style.margin  = "0";
              (span as HTMLElement).style.padding = "0";
            } else {
              // Single-title centred bar: block + symmetric padding.
              // Children use display:block + text-align:center directly — more reliable
              // in html2canvas than relying on display:inline + parent text-align.
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
          // html2canvas may not support display:contents on the wrapper divs,
          // causing them to be treated as display:block grid items (breaking the
          // 4-column layout). Unwrap them so the label/value spans are direct
          // children of the grid container.
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
        },
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

      // JPEG 0.75 balances print clarity with file size.
      // The full-page screenshot at scale:2 already has high pixel density,
      // so 0.75 quality is indistinguishable from 0.95 at normal viewing distance
      // while producing PDF pages roughly 40-50% smaller.
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.75),
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
