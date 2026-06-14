import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ─── Supabase persistence ─────────────────────────────────────────────────────
// Uses the service-role key so token reads/writes bypass RLS and work in any
// Vercel function container without a user session.
// Table: gmail_credentials (id text PK, refresh_token text, access_token text,
//         expiry_date bigint, updated_at timestamptz)

const TABLE   = "gmail_credentials";
const ROW_ID  = "singleton";
const LOCAL_FILE = path.join(process.cwd(), ".gmail-token.json");

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── OAuth2 factory ───────────────────────────────────────────────────────────

export function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
}

// ─── Token record ─────────────────────────────────────────────────────────────

export type TokenRecord = {
  refresh_token: string | null;
  access_token:  string | null;
  expiry_date:   number | null;   // Unix ms
};

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadTokens(): Promise<TokenRecord> {
  // 1. Supabase DB — primary store; survives Vercel container restarts
  try {
    const db = makeServiceClient();
    if (db) {
      const { data } = await db
        .from(TABLE)
        .select("refresh_token,access_token,expiry_date")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (data?.refresh_token) {
        return {
          refresh_token: data.refresh_token,
          access_token:  data.access_token  ?? null,
          expiry_date:   data.expiry_date   ?? null,
        };
      }
    }
  } catch (e) {
    console.warn("[gmail] DB read failed:", e);
  }

  // 2. Local dev file (.gmail-token.json, git-ignored)
  try {
    if (fs.existsSync(LOCAL_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
      if (raw?.refresh_token) {
        return {
          refresh_token: raw.refresh_token,
          access_token:  raw.access_token  ?? null,
          expiry_date:   raw.expiry_date   ?? null,
        };
      }
    }
  } catch { /* read-only FS in prod */ }

  // 3. Env-var bootstrap (initial setup / no DB row yet)
  return {
    refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? null,
    access_token:  null,
    expiry_date:   null,
  };
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function saveTokens(tokens: Partial<TokenRecord>): Promise<void> {
  // DB (primary)
  try {
    const db = makeServiceClient();
    if (db) {
      const { error } = await db
        .from(TABLE)
        .upsert({ id: ROW_ID, ...tokens, updated_at: new Date().toISOString() });
      if (error) console.error("[gmail] DB write error:", error.message);
    } else {
      console.warn("[gmail] SUPABASE_SERVICE_ROLE_KEY not set — tokens not persisted to DB.");
    }
  } catch (e) {
    console.error("[gmail] DB write exception:", e);
  }

  // Local dev file (best-effort; silently skipped on read-only FS)
  try {
    const existing: Record<string, unknown> = (() => {
      try { return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8")); } catch { return {}; }
    })();
    fs.writeFileSync(LOCAL_FILE, JSON.stringify({ ...existing, ...tokens }), "utf-8");
  } catch { /* expected on Vercel */ }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function isGmailConnected(): Promise<boolean> {
  const { refresh_token } = await loadTokens();
  return !!refresh_token;
}

/**
 * Returns an authenticated OAuth2 client with a valid access token.
 * Auto-refreshes the access token if it is missing or expires within 5 minutes.
 * Returns null if the refresh token is absent or has been revoked — caller must
 * prompt the user to reconnect Gmail.
 */
export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const stored = await loadTokens();
  if (!stored.refresh_token) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    refresh_token: stored.refresh_token,
    access_token:  stored.access_token  ?? undefined,
    expiry_date:   stored.expiry_date   ?? undefined,
  });

  // Proactively refresh if no access token or it expires within 5 minutes
  const needsRefresh =
    !stored.access_token ||
    (stored.expiry_date != null && stored.expiry_date < Date.now() + 5 * 60_000);

  if (needsRefresh) {
    try {
      const { credentials } = await client.refreshAccessToken();
      const update: Partial<TokenRecord> = {
        access_token: credentials.access_token ?? null,
        expiry_date:
          typeof credentials.expiry_date === "number" ? credentials.expiry_date : null,
      };
      // Google occasionally rotates the refresh token — persist it if so
      if (credentials.refresh_token) update.refresh_token = credentials.refresh_token;
      await saveTokens(update);
      client.setCredentials(credentials);
    } catch (err: unknown) {
      console.error("[gmail] Access-token refresh failed:", err);
      // null → caller shows "reconnect Gmail" message
      return null;
    }
  }

  return client;
}

// ─── Legacy sync shims (kept so nothing else breaks) ─────────────────────────

/** @deprecated Use saveTokens() */
export function saveRefreshToken(refreshToken: string): void {
  saveTokens({ refresh_token: refreshToken, access_token: null, expiry_date: null })
    .catch(e => console.error("[gmail] saveRefreshToken async error:", e));
}

/** @deprecated Use loadTokens() */
export function loadRefreshToken(): string | null {
  return process.env.GMAIL_REFRESH_TOKEN ?? null;
}
