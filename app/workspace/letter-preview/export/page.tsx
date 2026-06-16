import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLetterById, supabaseLetterToStoredLetter, resolvePictureUrls } from "@/lib/supabase/letters";
import ExportClient from "./ExportClient";
import type { LetterData } from "@/components/letter/LetterPageRenderer";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ letterId?: string }>;
}) {
  const { letterId } = await searchParams;
  if (!letterId) notFound();

  const supabase = await createClient();
  const letter = await getLetterById(supabase, letterId);
  if (!letter) notFound();

  const stored = supabaseLetterToStoredLetter(letter);
  const data = (stored.data ?? {}) as Record<string, unknown> & LetterData;

  // Resolve PictureMetadata objects → signed URLs so Puppeteer can fetch them
  if (Array.isArray(data.pictures) && data.pictures.length > 0) {
    data.pictures = await resolvePictureUrls(supabase, data.pictures as unknown[]);
  }

  return <ExportClient data={data as unknown as LetterData} />;
}
