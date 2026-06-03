import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Privacy rule: Do not send patient identifiers to AI.
// Only send the selected text section and patient gender.
// Never include: patient name, ID, email, phone, birthdate, or address.

type SectionType = "diagnosis" | "summary" | "plan";
type Gender = "male" | "female" | "other";

interface TranslateRequest {
  sectionType: SectionType;
  sourceLanguage: "en";
  targetLanguage: "he";
  gender: Gender;
  text?: string;
  planSteps?: string[];
}

function buildSystemPrompt(gender: Gender): string {
  const genderNote =
    gender === "female" ? "The patient is female — use feminine Hebrew grammatical forms." :
    gender === "male"   ? "The patient is male — use masculine Hebrew grammatical forms." :
                          "Use neutral Hebrew forms where possible.";

  return `You are a professional medical translator specialising in English-to-Hebrew translation for private clinic letters. ${genderNote}

Translation rules — follow exactly:
1. Translate medically accurately from English to Hebrew.
2. Do not add any medical information not present in the original English.
3. Do not remove any medical information from the original English.
4. Do not invent diagnoses, symptoms, explanations, warnings, medications, or recommendations.
5. Keep the meaning identical to the source text.
6. Use professional clinical terminology appropriate for a clinic letter.
7. Keep all dates, numbers, medication names, dosages, units, and test names exactly as given unless Hebrew grammar requires a minor grammatical particle change.
8. If the text is ambiguous, translate literally — never guess at intent.
9. The output is a draft that the doctor will review and may edit.
10. Return ONLY valid JSON as specified — no preamble, no explanation.`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Translation service not configured. Add GEMINI_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  let body: TranslateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { sectionType, gender = "other", text, planSteps } = body;

  if (!["diagnosis", "summary", "plan"].includes(sectionType)) {
    return NextResponse.json({ error: "Invalid sectionType." }, { status: 400 });
  }

  if (sectionType === "plan") {
    if (!Array.isArray(planSteps) || planSteps.length === 0 || !planSteps.some(s => s.trim())) {
      return NextResponse.json({ error: "planSteps array is required and must not be empty." }, { status: 400 });
    }
  } else {
    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required for diagnosis/summary translation." }, { status: 400 });
    }
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: buildSystemPrompt(gender as Gender),
    generationConfig: { responseMimeType: "application/json" },
  });

  let prompt: string;

  if (sectionType === "plan") {
    const stepCount = planSteps!.length;
    prompt =
      `Translate these ${stepCount} English clinical plan steps into Hebrew.\n` +
      `Return exactly: {"translatedSteps": ["step 1 in Hebrew", ...]}\n` +
      `Rules: exactly ${stepCount} steps, same order, do not merge, split, add, or remove any step.\n\n` +
      `English steps:\n` +
      planSteps!.map((s, i) => `${i + 1}. ${s}`).join("\n");
  } else {
    prompt =
      `Translate this English clinical ${sectionType} text into Hebrew.\n` +
      `Return exactly: {"translatedText": "..."}\n\n` +
      `English text:\n${text}`;
  }

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    if (sectionType === "plan") {
      if (!Array.isArray(parsed.translatedSteps) || parsed.translatedSteps.length !== planSteps!.length) {
        throw new Error(`Expected ${planSteps!.length} steps, got ${parsed.translatedSteps?.length ?? 0}.`);
      }
      return NextResponse.json({ translatedSteps: parsed.translatedSteps });
    } else {
      if (typeof parsed.translatedText !== "string") throw new Error("translatedText missing from response.");
      return NextResponse.json({ translatedText: parsed.translatedText });
    }
  } catch (err) {
    console.error("[/api/translate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Translation failed. Please try again." },
      { status: 500 }
    );
  }
}
