import { NextResponse } from "next/server";
import { isGmailConnected } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({ connected: isGmailConnected() });
}
