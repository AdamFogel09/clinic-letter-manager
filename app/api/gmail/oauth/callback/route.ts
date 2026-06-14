import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client, saveTokens } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2 style="color:#BE123C">Gmail connection cancelled</h2>
        <p>${error}</p>
        <a href="/dashboard">Back to Dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
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
        <p>Google only returns a refresh token when granting access for the first time,
        or after revoking and re-authorising the app.</p>
        <p>Please visit
        <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>,
        remove <strong>Clinic Letter Manager</strong>, then try connecting again.</p>
        <a href="/api/gmail/oauth/start"
          style="display:inline-block;margin-top:16px;padding:10px 24px;
          background:#1A2B4A;color:white;border-radius:10px;text-decoration:none;font-size:14px">
          Try again
        </a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  // Persist the full token set so auto-refresh works without another reconnect
  await saveTokens({
    refresh_token: tokens.refresh_token,
    access_token:  tokens.access_token  ?? null,
    expiry_date:
      typeof tokens.expiry_date === "number" ? tokens.expiry_date : null,
  });

  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2 style="color:#0D9488">&#10003; Gmail connected successfully.</h2>
      <p>lungdrsumit@gmail.com is now connected.<br>
      You can send clinic letters directly from the Review page.</p>
      <a href="/dashboard"
        style="display:inline-block;margin-top:16px;padding:10px 24px;
        background:#1A2B4A;color:white;border-radius:10px;text-decoration:none;font-size:14px">
        Back to Dashboard
      </a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}
