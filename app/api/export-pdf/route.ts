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

    // Collect all A4 page elements for screenshots
    const pageElements = await page.$$('.a4-page[data-export-page="true"]');
    if (pageElements.length === 0) {
      throw new Error("No A4 pages found in export view — letter may be empty.");
    }

    // Single evaluate call: gather all geometry inside the browser context so
    // page rects and link rects share the same coordinate origin (both use
    // getBoundingClientRect with scroll=0). This avoids the null-boundingBox
    // problem caused by overflow:hidden parents and eliminates coordinate-system
    // mismatches between ElementHandle.boundingBox() and getBoundingClientRect().
    type GeoEntry = { left: number; top: number; width: number; height: number };
    type LinkEntry = GeoEntry & { href: string };
    const geo = (await page.evaluate(() => {
      const pages = Array.from(document.querySelectorAll('.a4-page[data-export-page="true"]'));
      const links = Array.from(document.querySelectorAll('[data-pdf-link]'));
      return {
        pages: pages.map(p => {
          const r = p.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        }),
        links: links.map(l => {
          const r = l.getBoundingClientRect();
          return {
            href: l.getAttribute("data-pdf-link") ?? "",
            left: r.left, top: r.top, width: r.width, height: r.height,
          };
        }),
      };
    })) as { pages: GeoEntry[]; links: LinkEntry[] };

    console.log("[pdf-annot] pages:", geo.pages.length, "links:", geo.links.length, JSON.stringify(geo.links));

    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i];
      const pg = geo.pages[i];

      // JPEG at quality 75 — ~3–5× smaller than PNG with imperceptible quality loss
      const screenshotBuf: Buffer = await pageEl.screenshot({ type: "jpeg", quality: 75 });
      const jpgImage = await pdfDoc.embedJpg(screenshotBuf);
      const pdfPage = pdfDoc.addPage([A4_W_PT, A4_H_PT]);
      pdfPage.drawImage(jpgImage, { x: 0, y: 0, width: A4_W_PT, height: A4_H_PT });

      if (!pg) continue;

      for (const link of geo.links) {
        if (!link.href.startsWith("http")) continue;

        // Assign link to the page whose vertical span contains the link's midpoint
        const linkMidY = link.top + link.height / 2;
        if (linkMidY < pg.top || linkMidY > pg.top + pg.height) continue;

        const relLeft = link.left - pg.left;
        const relTop  = link.top  - pg.top;
        const xPt = (relLeft       / pg.width)  * A4_W_PT;
        const wPt = (link.width    / pg.width)  * A4_W_PT;
        const hPt = (link.height   / pg.height) * A4_H_PT;
        // PDF y-axis is bottom-up: yPt is the bottom-left corner of the annotation
        const yPt = A4_H_PT - ((relTop + link.height) / pg.height) * A4_H_PT;

        console.log("[pdf-annot] annotation page", i, "href:", link.href, "rect:", { xPt, yPt, wPt, hPt });

        // Register URI action as an indirect object — better compatibility across viewers
        const actionRef = pdfDoc.context.register(
          pdfDoc.context.obj({
            S:   PDFName.of("URI"),
            URI: PDFString.of(link.href),
          }),
        );
        const annotRef = pdfDoc.context.register(
          pdfDoc.context.obj({
            Type:    PDFName.of("Annot"),
            Subtype: PDFName.of("Link"),
            Rect:    [xPt, yPt, xPt + wPt, yPt + hPt],
            Border:  [0, 0, 0],
            A:       actionRef,
          }),
        );
        const existing = pdfPage.node.get(PDFName.of("Annots"));
        if (existing instanceof PDFArray) {
          existing.push(annotRef);
        } else {
          pdfPage.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
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
