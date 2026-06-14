import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLetterById, supabaseLetterToStoredLetter } from "@/lib/supabase/letters";
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
  const data = (stored.data ?? {}) as unknown as LetterData;

  return <ExportClient data={data} />;
}
