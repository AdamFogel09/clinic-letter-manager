import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client, saveRefreshToken } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2 style="color:#BE123C">Gmail connection cancelled</h2>
        <p>${error}</p>
        <a href="/dashboard">Back to Dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return NextResponse.json({ error: "No code returned from Google." }, { status: 400 });
  }

  const client = getOAuth2Client();

  let tokens;
  try {
    const { tokens: t } = await client.getToken(code);
    tokens = t;
  } catch (err) {
    console.error("[gmail/callback] Token exchange failed:", err);
    return NextResponse.json({ error: "Token exchange failed." }, { status: 500 });
  }

  if (!tokens.refresh_token) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2 style="color:#D97706">No refresh token received</h2>
        <p>Google only returns a refresh token on first authorisation.<br>
        If you have already connected Gmail before, revoke access at
        <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>
        and try again.</p>
        <a href="/api/gmail/oauth/start">Try again</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // In production, refresh tokens must be stored encrypted in the database or secure secret storage.
  saveRefreshToken(tokens.refresh_token);

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2 style="color:#0D9488">✓ Gmail connected successfully</h2>
      <p>Dr. Sumit's Gmail account is now connected.<br>
      You can now send clinic letters directly from the Review page.</p>
      <a href="/dashboard" style="display:inline-block;margin-top:16px;padding:10px 24px;
        background:#1A2B4A;color:white;border-radius:10px;text-decoration:none;font-size:14px">
        Back to Dashboard
      </a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
