import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PictureMetadata } from "@/lib/supabase/letters";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require("sharp");

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const IMAGE_BUCKET = "letter-images";
const MAX_DIM = 600;
const JPEG_QUALITY = 65;

/**
 * POST /api/admin/migrate-images
 *
 * One-time admin migration: finds all letters where pictures[] contains
 * base64 / data:image strings, uploads each image to Supabase Storage,
 * and replaces the DB field with PictureMetadata objects.
 *
 * Only lungdrsumit@gmail.com may call this endpoint.
 */
export async function POST(_req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "lungdrsumit@gmail.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all letters that have a non-empty pictures column
  const { data: letters, error: fetchErr } = await supabase
    .from("letters")
    .select("id, pictures, created_by");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const results = { migrated: 0, skipped: 0, errors: 0, details: [] as string[] };

  for (const letter of letters ?? []) {
    const pics: unknown[] = Array.isArray(letter.pictures) ? letter.pictures : [];
    if (pics.length === 0) { results.skipped++; continue; }

    // Check if any entry is a legacy base64 string
    const needsMigration = pics.some(p => typeof p === "string");
    if (!needsMigration) { results.skipped++; continue; }

    const newPictures: (PictureMetadata | unknown)[] = [];
    let failed = false;

    for (let i = 0; i < pics.length; i++) {
      const p = pics[i];

      if (typeof p !== "string") {
        // Already metadata — keep as-is
        newPictures.push(p);
        continue;
      }

      // Parse data URL: "data:image/jpeg;base64,<data>"
      const dataUrl = p as string;
      const commaIdx = dataUrl.indexOf(",");
      if (commaIdx < 0) {
        results.details.push(`letter ${letter.id} image ${i}: not a valid data URL — skipped`);
        newPictures.push(p); // keep unchanged
        continue;
      }
      const base64 = dataUrl.slice(commaIdx + 1);

      try {
        const rawBuffer = Buffer.from(base64, "base64");

        // Re-compress: resize to max 600px and re-encode at quality 65
        const sharpInstance = sharp(rawBuffer).rotate(); // .rotate() auto-corrects EXIF orientation
        const metadata = await sharpInstance.metadata();
        const origW = metadata.width ?? 0;
        const origH = metadata.height ?? 0;
        const longestSide = Math.max(origW, origH);
        if (longestSide > MAX_DIM) {
          sharpInstance.resize(
            origW >= origH ? MAX_DIM : null,
            origH > origW  ? MAX_DIM : null,
            { withoutEnlargement: true },
          );
        }
        const compressedBuffer: Buffer = await sharpInstance
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: false })
          .toBuffer();

        const { info } = await sharp(compressedBuffer).jpeg().toBuffer({ resolveWithObject: true });
        const finalW = info.width as number;
        const finalH = info.height as number;

        const imageId = `migrated-${i}-${Date.now().toString(36)}`;
        const path = `${letter.created_by}/${letter.id}/${imageId}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, compressedBuffer, { contentType: "image/jpeg", upsert: true });

        if (uploadErr) throw uploadErr;

        const meta: PictureMetadata = {
          id: imageId,
          path,
          bucket: IMAGE_BUCKET,
          sizeBytes: compressedBuffer.length,
          width: finalW,
          height: finalH,
          contentType: "image/jpeg",
        };
        newPictures.push(meta);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.details.push(`letter ${letter.id} image ${i}: upload failed — ${msg}`);
        failed = true;
        break; // stop processing this letter on first failure
      }
    }

    if (failed) {
      results.errors++;
      continue;
    }

    // Update the letter row with the migrated pictures
    const { error: updateErr } = await supabase
      .from("letters")
      .update({ pictures: newPictures })
      .eq("id", letter.id);

    if (updateErr) {
      results.details.push(`letter ${letter.id}: DB update failed — ${updateErr.message}`);
      results.errors++;
    } else {
      results.migrated++;
    }
  }

  return NextResponse.json(results);
}
