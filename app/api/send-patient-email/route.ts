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

/** Build a base64url-encoded RFC2822 message with a PDF and logo attachment.
 *  Body is HTML so Hebrew RTL renders correctly in all email clients.
 *  Both the HTML body and attachments use base64 transfer encoding (UTF-8 safe). */
function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  pdfBase64: string;
  pdfFilename: string;
  logoBase64: string;
}): string {
  const boundary = `clinic_boundary_${Date.now()}`;
  // Wrap base64 at 76 chars per line — required by RFC 2045
  const wrap76 = (b64: string) => b64.replace(/(.{76})/g, "$1\r\n").trimEnd();
  const htmlBase64 = wrap76(Buffer.from(params.bodyHtml, "utf-8").toString("base64"));

  const mime = [
    `MIME-Version: 1.0`,
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    htmlBase64,
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
  if (!(await isGmailConnected())) {
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
  // getAuthenticatedClient loads stored tokens and auto-refreshes the access token
  // if it has expired. Returns null only when the refresh token itself is invalid
  // (revoked, missing) — i.e. a full reconnect is required.
  const authClient = await getAuthenticatedClient();
  if (!authClient) {
    return NextResponse.json(
      { error: "Gmail connection expired. Please click 'Reconnect Gmail' on the Dashboard." },
      { status: 503 }
    );
  }

  const gmail = google.gmail({ version: "v1", auth: authClient });

  const emailBodyHtml = `<!DOCTYPE html>
<html lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<div dir="rtl" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;">
  <p>שלום, מצורף מכתבך ממרפאתו של ד"ר סומיט . אנא קראו אותו בעיון ושלחו עותק אל רופא המשפחה שלכם.</p>

  <p>לכל שאלה לגבי תוכן המכתב, צרו עמנו קשר.</p>

  <p>בברכה,</p>

  <p>ד"ר סומיט צ'טרג'י</p>
</div>
</body>
</html>`;

  const rawMessage = buildRawEmail({
    from:        process.env.GMAIL_SENDER_EMAIL!,
    to:          patientEmail,
    subject:     "Clinic Letter from Dr. Sumit Chatterji",
    bodyHtml:    emailBodyHtml,
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
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    const isAuthError =
      msg.includes("invalid_grant") ||
      msg.includes("Invalid Credentials") ||
      msg.includes("Token has been expired") ||
      msg.includes("invalid_token");
    return NextResponse.json(
      {
        error: isAuthError
          ? "Gmail connection expired. Please click 'Reconnect Gmail' on the Dashboard."
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
