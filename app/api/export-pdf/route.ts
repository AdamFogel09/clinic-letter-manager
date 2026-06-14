import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, PDFName, PDFArray, PDFString } from "pdf-lib";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// @sparticuz/chromium detects the Lambda environment via AWS_EXECUTION_ENV /
// AWS_LAMBDA_JS_RUNTIME to decide whether to extract bundled .so files
// (libnss3, etc.) and add their path to LD_LIBRARY_PATH.
// Vercel sets neither variable, so we set it here — at module load time —
// before the first require("@sparticuz/chromium") runs.
if (process.env.VERCEL && !process.env.AWS_LAMBDA_JS_RUNTIME) {
  process.env.AWS_LAMBDA_JS_RUNTIME = "nodejs20.x";
}

const A4_W_PT = 595.28;
const A4_H_PT = 841.89;

async function getExecPath(): Promise<string> {
  if (process.env.VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chromium = require("@sparticuz/chromium");
    return chromium.executablePath();
  }
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        ]
      : [
          "/usr/bin/google-chrome-stable",
          "/usr/bin/google-chrome",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
          "/snap/bin/chromium",
        ];
  for (const p of candidates) {
    try { if (existsSync(p)) return p; } catch { /* */ }
  }
  throw new Error(
    "Chrome not found locally. Set CHROME_EXECUTABLE_PATH env var.",
  );
}

function getLaunchArgs(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chromiumArgs: string[] = process.env.VERCEL
    ? require("@sparticuz/chromium").args
    : [];
  return [
    ...chromiumArgs,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth check — only lungdrsumit@gmail.com may export
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "lungdrsumit@gmail.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { letterId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { letterId } = body;
  if (!letterId) {
    return NextResponse.json({ error: "letterId is required" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const exportUrl = `${origin}/workspace/letter-preview/export?letterId=${encodeURIComponent(letterId)}`;
  const cookieHeader = req.headers.get("cookie") || "";

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require("puppeteer-core");

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const executablePath = await getExecPath();
    browser = await puppeteer.launch({
      args: getLaunchArgs(),
      defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 1.5 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    // Set cookies for auth (clinic_access + Supabase session)
    if (cookieHeader) {
      const parsedCookies = cookieHeader.split(";").flatMap((c: string) => {
        const eqIdx = c.indexOf("=");
        if (eqIdx < 0) return [];
        const name = c.slice(0, eqIdx).trim();
        const value = c.slice(eqIdx + 1).trim();
        if (!name) return [];
        return [{ name, value, url: origin }];
      });
      if (parsedCookies.length > 0) {
        await page.setCookie(...parsedCookies);
      }
    }

    await page.goto(exportUrl, { waitUntil: "networkidle0", timeout: 60_000 });

    // Wait until PageBuilder finishes measuring and painting
    await page.waitForSelector('[data-render-complete="true"]', { timeout: 30_000 });

    // Collect all A4 pages
    const pageElements = await page.$$('.a4-page[data-export-page="true"]');
    if (pageElements.length === 0) {
      throw new Error("No A4 pages found in export view — letter may be empty.");
    }

    const pdfDoc = await PDFDocument.create();

    for (const pageEl of pageElements) {
      // boundingBox() returns page-relative coordinates (not viewport-relative)
      const pageBox: { x: number; y: number; width: number; height: number } | null =
        await pageEl.boundingBox();

      // JPEG at quality 75 — ~3–5× smaller than PNG with imperceptible quality loss
      const screenshotBuf: Buffer = await pageEl.screenshot({ type: "jpeg", quality: 75 });
      const jpgImage = await pdfDoc.embedJpg(screenshotBuf);
      const pdfPage = pdfDoc.addPage([A4_W_PT, A4_H_PT]);
      pdfPage.drawImage(jpgImage, { x: 0, y: 0, width: A4_W_PT, height: A4_H_PT });

      // Link annotations — use ElementHandle.boundingBox() so coordinates are
      // page-relative (consistent with pageEl.boundingBox()), not viewport-relative.
      // getBoundingClientRect() would be wrong for pages below the viewport fold.
      if (pageBox) {
        const linkHandles = await pageEl.$$("[data-pdf-link]");
        for (const linkHandle of linkHandles) {
          const href: string = await linkHandle.evaluate(
            (el: Element) => (el as HTMLAnchorElement).getAttribute("data-pdf-link") ?? "",
          );
          if (!href.startsWith("http")) continue;

          const linkBox = await linkHandle.boundingBox();
          if (!linkBox) continue;

          const relLeft = linkBox.x - pageBox.x;
          const relTop  = linkBox.y - pageBox.y;
          const xPt  = (relLeft / pageBox.width)  * A4_W_PT;
          const wPt  = (linkBox.width  / pageBox.width)  * A4_W_PT;
          const hPt  = (linkBox.height / pageBox.height) * A4_H_PT;
          // PDF y-axis is bottom-up: compute bottom-left corner of the annotation rect
          const yPt  = A4_H_PT - ((relTop + linkBox.height) / pageBox.height) * A4_H_PT;

          const annotRef = pdfDoc.context.register(
            pdfDoc.context.obj({
              Type: PDFName.of("Annot"),
              Subtype: PDFName.of("Link"),
              Rect: [xPt, yPt, xPt + wPt, yPt + hPt],
              Border: [0, 0, 0],
              A: {
                Type: PDFName.of("Action"),
                S: PDFName.of("URI"),
                URI: PDFString.of(href),
              },
            }),
          );
          const annotArr = pdfPage.node.get(PDFName.of("Annots"));
          if (annotArr instanceof PDFArray) {
            annotArr.push(annotRef);
          } else {
            pdfPage.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
          }
        }
      }
    }

    const pdfBuffer = Buffer.from(await pdfDoc.save());

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="letter.pdf"',
      },
    });
  } catch (err) {
    console.error("[export-pdf] error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* */ }
    }
  }
}
