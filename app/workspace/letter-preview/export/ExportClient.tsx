"use client";

import { useRef } from "react";
import LetterPageRenderer, { type LetterData } from "@/components/letter/LetterPageRenderer";

export default function ExportClient({ data }: { data: LetterData }) {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={rootRef}
      style={{ background: "#F4F6F9", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <LetterPageRenderer
        data={data}
        onReady={() => {
          rootRef.current?.setAttribute("data-render-complete", "true");
        }}
      />
    </div>
  );
}
