import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_EMAILS = ["lungdrsumit@gmail.com"];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ALLOWED_EMAILS.includes(user.email ?? "")) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const client = getOAuth2Client();

  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",          // force refresh_token to be returned every time
    scope: ["https://www.googleapis.com/auth/gmail.send"],
  });

  return NextResponse.redirect(url);
}
