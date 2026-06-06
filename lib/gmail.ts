import { google } from "googleapis";
import fs from "fs";
import path from "path";

// In production, refresh tokens must be stored encrypted in the database or secure secret storage.
// For local development, the token is persisted in .gmail-token.json (git-ignored).
const TOKEN_FILE = path.join(process.cwd(), ".gmail-token.json");

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
}

export function saveRefreshToken(refreshToken: string): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: refreshToken }), "utf-8");
}

export function loadRefreshToken(): string | null {
  // Prefer env var (works on Vercel / any deployment)
  if (process.env.GMAIL_REFRESH_TOKEN) return process.env.GMAIL_REFRESH_TOKEN;
  // Fall back to local file for dev
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
    return typeof raw.refresh_token === "string" ? raw.refresh_token : null;
  } catch {
    return null;
  }
}

export function isGmailConnected(): boolean {
  return !!loadRefreshToken();
}

/** Returns an authenticated OAuth2 client ready for Gmail API calls, or null if not connected. */
export function getAuthenticatedClient() {
  const refreshToken = loadRefreshToken();
  if (!refreshToken) return null;
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
