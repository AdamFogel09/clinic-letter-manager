import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "clinic_access";

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const sitePassword = process.env.PRIVATE_SITE_PASSWORD;

  // If not configured, allow through (dev/unconfigured environments).
  if (!sitePassword) {
    const res = NextResponse.json({ success: true });
    res.cookies.set(ACCESS_COOKIE, "unconfigured", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  }

  if (!body.password || body.password !== sitePassword) {
    return NextResponse.json(
      { error: "Incorrect access password." },
      { status: 401 }
    );
  }

  const token = await sha256hex(sitePassword);
  const res = NextResponse.json({ success: true });
  res.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
