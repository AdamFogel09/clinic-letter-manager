const steps = [
  {
    number: "1",
    title: "Write",
    body: "Open a new letter, select a template, fill patient details and clinical notes.",
  },
  {
    number: "2",
    title: "Translate",
    body: "Use AI assistance to generate an accurate translated version for the patient.",
  },
  {
    number: "3",
    title: "Review",
    body: "Check the draft, make adjustments, and mark as approved when ready.",
  },
  {
    number: "4",
    title: "Export",
    body: "Download as a formatted PDF or Word document, ready to sign and send.",
  },
];

export default function WorkflowSection() {
  return (
    <section className="section-pad" style={{ backgroundColor: "#ffffff" }}>
      <div className="section-container">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-14">
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "#0D9488" }}
          >
            Workflow
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: "#1A2B4A" }}
          >
            How it works.
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "#64748B" }}>
            Four clear steps — from opening a blank letter to a finished,
            exportable document.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop only) */}
          <div
            className="hidden lg:block absolute h-px"
            style={{
              backgroundColor: "#E2E8F0",
              top: "1.25rem",
              left: "calc(12.5% + 1.25rem)",
              right: "calc(12.5% + 1.25rem)",
            }}
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex flex-col items-center text-center lg:items-start lg:text-left"
              >
                {/* Number circle */}
                <div
                  className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white mb-5 flex-shrink-0"
                  style={{
                    backgroundColor: "#0D9488",
                    boxShadow: "0 0 0 6px #CCFBF1",
                  }}
                >
                  {step.number}
                </div>

                <h3
                  className="text-base font-semibold mb-2"
                  style={{ color: "#1A2B4A" }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
