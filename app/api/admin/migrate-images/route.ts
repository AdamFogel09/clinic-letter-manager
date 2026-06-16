import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PictureMetadata } from "@/lib/supabase/letters";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const IMAGE_BUCKET = "letter-images";
const MAX_DIM = 600;
const JPEG_QUALITY = 65;

/**
 * POST /api/admin/migrate-images
 *
 * One-time admin migration: finds all letters where pictures[] contains
 * base64 / data:image strings, re-compresses each image to 600px/q65,
 * uploads to Supabase Storage, and replaces the DB field with PictureMetadata.
 *
 * Only lungdrsumit@gmail.com may call this endpoint.
 */
export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== "lungdrsumit@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require("sharp") as typeof import("sharp");

    const { data: letters, error: fetchErr } = await supabase
      .from("letters")
      .select("id, pictures, created_by");

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const results = { migrated: 0, skipped: 0, errors: 0, details: [] as string[] };

    for (const letter of letters ?? []) {
      const pics: unknown[] = Array.isArray(letter.pictures) ? letter.pictures : [];
      if (pics.length === 0) { results.skipped++; continue; }

      const needsMigration = pics.some(p => typeof p === "string");
      if (!needsMigration) { results.skipped++; continue; }

      const newPictures: unknown[] = [];
      let failed = false;

      for (let i = 0; i < pics.length; i++) {
        const p = pics[i];

        if (typeof p !== "string") {
          newPictures.push(p); // already metadata — keep as-is
          continue;
        }

        const commaIdx = (p as string).indexOf(",");
        if (commaIdx < 0) {
          results.details.push(`letter ${letter.id} image ${i}: not a valid data URL — skipped`);
          newPictures.push(p);
          continue;
        }

        try {
          const rawBuffer = Buffer.from((p as string).slice(commaIdx + 1), "base64");

          // Re-compress: resize to max 600px, JPEG quality 65
          const sharpMeta = await sharp(rawBuffer).metadata();
          const origW = sharpMeta.width ?? 0;
          const origH = sharpMeta.height ?? 0;

          let pipeline = sharp(rawBuffer).rotate(); // auto-correct EXIF orientation
          if (Math.max(origW, origH) > MAX_DIM) {
            pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true });
          }
          const { data: compressedBuffer, info } = await pipeline
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer({ resolveWithObject: true });

          const imageId = `migrated-${i}-${Date.now().toString(36)}`;
          const storagePath = `${letter.created_by}/${letter.id}/${imageId}.jpg`;

          const { error: uploadErr } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(storagePath, compressedBuffer, { contentType: "image/jpeg", upsert: true });

          if (uploadErr) throw new Error(uploadErr.message);

          const meta: PictureMetadata = {
            id: imageId,
            path: storagePath,
            bucket: IMAGE_BUCKET,
            sizeBytes: compressedBuffer.length,
            width: info.width,
            height: info.height,
            contentType: "image/jpeg",
          };
          newPictures.push(meta);
          results.details.push(`letter ${letter.id} image ${i}: ${Math.round(rawBuffer.length / 1024)}KB → ${Math.round(compressedBuffer.length / 1024)}KB`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.details.push(`letter ${letter.id} image ${i}: FAILED — ${msg}`);
          failed = true;
          break;
        }
      }

      if (failed) { results.errors++; continue; }

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[migrate-images] fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
