import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  // Verify the caller is authenticated via their session cookie
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { letterId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { letterId } = body;
  if (!letterId) {
    return NextResponse.json({ error: "letterId is required." }, { status: 400 });
  }

  // Use service role client if available so the ownership lookup bypasses RLS.
  // The manual created_by check below is what enforces authorization — relying on
  // the session-based client's RLS for this SELECT is fragile on the server side.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = serviceKey
    ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : userClient;

  const { data: row, error: fetchError } = await adminClient
    .from("letters")
    .select("id, final_pdf_url, created_by")
    .eq("id", letterId)
    .single();

  if (fetchError || !row) {
    console.error("[delete-letter] Letter not found:", letterId, fetchError?.message);
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }

  if (row.created_by !== user.id) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  // Delete PDF from storage if one exists
  if (row.final_pdf_url) {
    const { error: storageErr } = await adminClient.storage
      .from("clinic-letters")
      .remove([row.final_pdf_url]);
    if (storageErr) {
      console.warn("[delete-letter] Storage delete warning:", storageErr.message, "path:", row.final_pdf_url);
    }
  }

  // Delete the DB row — use .select("id") so we can detect silent RLS blocks
  const { data: deleted, error: deleteError } = await adminClient
    .from("letters")
    .delete()
    .eq("id", letterId)
    .select("id");

  if (deleteError) {
    console.error("[delete-letter] DB delete error:", deleteError.message, "code:", deleteError.code);
    return NextResponse.json(
      { error: `Database error: ${deleteError.message}` },
      { status: 500 }
    );
  }

  if (!deleted || deleted.length === 0) {
    console.error(
      "[delete-letter] Silently blocked — 0 rows deleted.",
      "letterId:", letterId,
      "userId:", user.id,
      "usingServiceRole:", !!serviceKey,
    );
    return NextResponse.json(
      { error: "Delete was blocked by database permissions. Run the letters_rls.sql in your Supabase SQL editor to add the DELETE policy." },
      { status: 403 }
    );
  }

  console.log("[delete-letter] Deleted letter", letterId.slice(0, 8), "by user", user.id.slice(0, 8));
  return NextResponse.json({ success: true });
}
