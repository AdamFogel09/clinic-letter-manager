export default function MockLetterCard() {
  return (
    <div className="relative">
      {/* Background blob for depth */}
      <div
        className="absolute inset-0 rounded-2xl bg-[#EBF3FB] -z-10"
        style={{ transform: "rotate(-2deg) scale(0.96)" }}
      />

      {/* Card */}
      <div
        className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden"
        style={{
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 4px 16px 0 rgb(26 43 74 / 0.06)",
        }}
      >
        {/* Top bar */}
        <div className="bg-[#1A2B4A] px-5 py-3 flex items-center justify-between">
          <span className="text-white/90 text-xs font-semibold tracking-wide">
            Letter Preview
          </span>
          <span className="bg-[#0D9488] text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full tracking-wider uppercase">
            Draft
          </span>
        </div>

        {/* Letter body */}
        <div className="p-6">
          {/* Metadata row */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] border-b border-[#E2E8F0] pb-4 mb-4">
            {[
              ["Patient", "J. Smith"],
              ["DOB", "12 / 04 / 1978"],
              ["Ref No.", "PC-2024-0041"],
              ["Date", "30 May 2024"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-1.5">
                <span className="text-[#64748B] min-w-[3rem]">{label}</span>
                <span className="text-[#1A2B4A] font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* Letter text */}
          <div className="space-y-2 text-[12px] text-[#1A2B4A] leading-relaxed">
            <p>Dear Dr. Henderson,</p>
            <p>
              I am writing regarding my patient J. Smith, who attended the
              clinic on 28 May 2024 for a routine review appointment.
            </p>
            <p>
              <span className="font-semibold">Diagnosis:</span> Essential
              hypertension (I10). Blood pressure well-controlled on current
              medication.
            </p>
            <p>
              I have recommended continuation of current therapy with a
              follow-up appointment in 8 weeks. Please do not hesitate to
              contact me.
            </p>
            <p className="pt-1">
              Yours sincerely,
              <br />
              <span className="font-semibold">Dr. [Name]</span>
            </p>
          </div>

          {/* Action pills (decorative) */}
          <div className="flex gap-2 mt-5 pt-4 border-t border-[#E2E8F0]">
            {["Translate", "Export PDF", "Mark Review"].map((label) => (
              <span
                key={label}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium select-none"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
