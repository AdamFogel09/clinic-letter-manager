import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const client = getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ connected: false });
  }

  try {
    await client.getAccessToken();
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
