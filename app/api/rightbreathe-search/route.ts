import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASE = "https://www.rightbreathe.com";

interface InhalerResult {
  name: string;
  imageUrl: string;
  pageUrl: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const query = (body.query ?? "").toString().trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // RightBreathe uses ?s= for search (not ?search=)
    const searchUrl = `${BASE}/?device_type=&drug_class=&drug_name=&s=${encodeURIComponent(query)}`;

    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json({ results: [], error: "Could not reach RightBreathe. Please add inhaler manually." });
    }

    const html = await res.text();
    const results = parseResults(html);

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[rightbreathe] error:", err);
    return NextResponse.json(
      { results: [], error: "Search failed. Please add inhaler manually." },
      { status: 200 }
    );
  }
}

function toAbsolute(href: string): string {
  return href.startsWith("http") ? href : `${BASE}${href}`;
}

function parseResults(html: string): InhalerResult[] {
  const results: InhalerResult[] = [];
  const seen = new Set<string>();

  // Match <a> tags linking to /medicines/.
  // The href may have query params appended (e.g. ?device_type=&s=fostair) so we:
  //   1. capture only the path portion (up to ? or ")
  //   2. skip any trailing query string with [^"]*
  const anchorOpenRe = /<a[^>]+href="((?:https?:\/\/(?:www\.)?rightbreathe\.com)?\/medicines\/[^"?#]+)[^"]*"[^>]*>/gi;
  let m: RegExpExecArray | null;

  while ((m = anchorOpenRe.exec(html)) !== null && results.length < 12) {
    const pageUrl = toAbsolute(m[1].replace(/\/$/, ""));
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);

    // Grab the content from this <a> to the matching </a>
    const blockStart = m.index;
    const closeIdx = html.indexOf("</a>", blockStart + m[0].length);
    const block = closeIdx > 0
      ? html.slice(blockStart, closeIdx + 4)
      : html.slice(blockStart, Math.min(blockStart + 2000, html.length));

    // RightBreathe puts the clean product name in the <img alt="...">
    const imgAlt = /alt="([^"]{4,200})"/i.exec(block)?.[1];

    // Fallbacks: heading or strong tag
    const nameFromBlock =
      imgAlt ||
      /<h[1-6][^>]*>\s*([^<]{4,120})\s*<\/h[1-6]>/i.exec(block)?.[1] ||
      /<(?:strong|b)[^>]*>\s*([^<]{4,120})\s*<\/(?:strong|b)>/i.exec(block)?.[1];

    // Last resort: humanise the URL slug
    const slug = pageUrl.replace(/.*\/medicines\//, "");
    const slugName = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();

    const rawName = nameFromBlock ?? slugName;
    const name = rawName.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!name || name.length < 3) continue;

    // Image src from the block
    const imgSrc = /src="([^"]+)"/i.exec(block)?.[1] ?? "";
    const imageUrl = imgSrc ? toAbsolute(imgSrc) : "";

    results.push({ name, imageUrl, pageUrl });
  }

  return results;
}
