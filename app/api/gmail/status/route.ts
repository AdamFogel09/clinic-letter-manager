import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // getAuthenticatedClient already handles token loading + auto-refresh
  const client = await getAuthenticatedClient();
  return NextResponse.json({ connected: !!client });
}
