import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { getLetterById, updateLetterStatus } from "@/lib/supabase/letters";
import { getAuthenticatedClient, isGmailConnected } from "@/lib/gmail";

const STORAGE_BUCKET = "clinic-letters";

// Reproduces the [ID]_[SURNAME]_[LOCATION]_[DATE].pdf naming convention
function buildPdfFilename(patientId: string, fullName: string, location: string, date: string): string {
  const safePart = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 30) || "x";
  const safeDate = (d: string) => (d || "").replace(/\//g, "-").replace(/[^0-9-]/g, "") || "00-00-0000";
  const id      = (patientId || "").replace(/[^a-zA-Z0-9]/g, "") || "NoID";
  const parts   = (fullName  || "").trim().split(/\s+/);
  const surname = safePart(parts[parts.length - 1] || "Unknown").toUpperCase();
  const loc     = safePart(location || "NoLocation");
  return `${id}_${surname}_${loc}_${safeDate(date)}.pdf`;
}

/** Build a base64url-encoded RFC2822 message with a PDF and logo attachment. */
function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  pdfBase64: string;
  pdfFilename: string;
  logoBase64: string;
}): string {
  const boundary = `clinic_boundary_${Date.now()}`;
  const mime = [
    `MIME-Version: 1.0`,
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    params.body,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${params.pdfFilename}"`,
    ``,
    params.pdfBase64,
    ``,
    `--${boundary}`,
    `Content-Type: image/png`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="Dr-Sumit-Chatterji-Logo.png"`,
    ``,
    params.logoBase64,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(mime).toString("base64url");
}

export async function POST(req: NextRequest) {
  // ── Gmail connection check ────────────────────────────────────────────────────
  if (!isGmailConnected()) {
    return NextResponse.json(
      { error: "Gmail is not connected. Please connect Gmail from the Dashboard first." },
      { status: 503 }
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: { letterId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { letterId } = body;
  if (!letterId) {
    return NextResponse.json({ error: "letterId is required." }, { status: 400 });
  }

  // ── Fetch letter + patient ────────────────────────────────────────────────────
  const letter = await getLetterById(supabase, letterId);
  if (!letter) {
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }
  if (letter.created_by !== user.id) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  // ── Patient email ─────────────────────────────────────────────────────────────
  const patientEmail = letter.patients?.email?.trim();
  if (!patientEmail) {
    return NextResponse.json({ error: "Patient email is missing." }, { status: 400 });
  }

  // ── PDF from Storage ──────────────────────────────────────────────────────────
  const pdfPath = letter.final_pdf_url;
  if (!pdfPath) {
    return NextResponse.json(
      { error: "No final PDF found. Please export the final PDF first." },
      { status: 400 }
    );
  }

  const { data: fileData, error: fileError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(pdfPath);

  if (fileError || !fileData) {
    console.error("[send-patient-email] Storage download error:", fileError?.message);
    return NextResponse.json(
      { error: "Could not retrieve the PDF from storage." },
      { status: 500 }
    );
  }

  const pdfBuffer    = Buffer.from(await fileData.arrayBuffer());
  const pdfSizeBytes = pdfBuffer.length;
  console.log(`[size] PDF size calculated: ${Math.round(pdfSizeBytes / 1024)} KB`);
  const pdfBase64    = pdfBuffer.toString("base64");
  const pdfFilename  = buildPdfFilename(
    letter.patients?.patient_id_number || "",
    letter.patients?.full_name         || "",
    letter.patients?.location          || "",
    letter.letter_date                 || ""
  );

  // ── Load logo from project files ──────────────────────────────────────────────
  let logoBase64: string;
  try {
    const logoPath = path.join(process.cwd(), "logo1.png");
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  } catch {
    console.error("[send-patient-email] Could not load logo1.png");
    return NextResponse.json(
      { error: "Could not load clinic logo file." },
      { status: 500 }
    );
  }

  // ── Send via Gmail API ─────────────────────────────────────────────────────────
  const authClient = getAuthenticatedClient();
  if (!authClient) {
    return NextResponse.json({ error: "Gmail auth client unavailable." }, { status: 503 });
  }

  const gmail = google.gmail({ version: "v1", auth: authClient });

  const emailBody = [
    "Dear Patient,",
    "",
    "Please find attached your clinic letter from Dr. Sumit Chatterji.",
    "",
    "A copy of the clinic logo is also attached for your reference.",
    "",
    "If you have any questions regarding the contents of the letter, please contact the clinic directly.",
    "",
    "Kind regards,",
    "",
    "Dr. Sumit Chatterji",
    "Specialist in Respiratory Medicine",
  ].join("\n");

  const rawMessage = buildRawEmail({
    from:        process.env.GMAIL_SENDER_EMAIL!,
    to:          patientEmail,
    subject:     "Clinic Letter from Dr. Sumit Chatterji",
    body:        emailBody,
    pdfBase64,
    pdfFilename,
    logoBase64,
  });

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: rawMessage },
    });
  } catch (sendErr: unknown) {
    console.error("[send-patient-email] Gmail send error:", sendErr);
    const isAuthError =
      sendErr instanceof Error &&
      (sendErr.message.includes("invalid_grant") ||
        sendErr.message.includes("Invalid Credentials") ||
        sendErr.message.includes("Token has been expired"));
    return NextResponse.json(
      {
        error: isAuthError
          ? "Gmail connection has expired. Please click 'Reconnect Gmail' on the Dashboard."
          : "Failed to send email via Gmail. Please try again.",
      },
      { status: isAuthError ? 401 : 502 }
    );
  }

  // ── Update letter status ──────────────────────────────────────────────────────
  await updateLetterStatus(supabase, letterId, "Sent to Patient", {
    sentToPatientAt: new Date().toISOString(),
  });

  // ── Update PDF size if not already tracked ────────────────────────────────────
  const { data: sizeRow } = await supabase
    .from("letters")
    .select("final_pdf_size_bytes, images_total_size_bytes")
    .eq("id", letterId)
    .single();
  if (!sizeRow?.final_pdf_size_bytes) {
    const imgBytes = (sizeRow as { images_total_size_bytes?: number } | null)?.images_total_size_bytes || 0;
    await supabase.from("letters").update({
      final_pdf_size_bytes:     pdfSizeBytes,
      total_storage_size_bytes: pdfSizeBytes + imgBytes,
    }).eq("id", letterId);
    console.log(`[size] Storage size fields updated`);
  }

  console.log(`[send-patient-email] letter sent | id: ${letterId}`);

  return NextResponse.json({
    success: true,
    sentTo:  patientEmail,
    sentAt:  new Date().toISOString(),
  });
}
