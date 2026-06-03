const features = [
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 4h12M4 8h8M4 12h6M13 14l2 2 4-4" />
      </svg>
    ),
    iconBg: "#EBF3FB",
    iconColor: "#4A90D9",
    title: "Structured Letter Creation",
    body: "Create clinic letters using a consistent professional format with guided sections and reusable templates.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="10" cy="10" r="8" />
        <path d="M2 10h16M10 2a14 14 0 0 1 0 16M10 2a14 14 0 0 0 0 16" />
      </svg>
    ),
    iconBg: "#CCFBF1",
    iconColor: "#0D9488",
    title: "AI-Assisted Translation",
    body: "Translate selected medical sections from English to Hebrew while keeping the original text available for review.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="10" cy="10" r="8" />
        <path d="M7 10l2 2 4-4" />
      </svg>
    ),
    iconBg: "rgb(26 43 74 / 0.08)",
    iconColor: "#1A2B4A",
    title: "Review Workflow",
    body: "Prepare letters for review before final approval, reducing copy-paste work and formatting mistakes.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M10 3v10M6 9l4 4 4-4M4 17h12" />
      </svg>
    ),
    iconBg: "#EBF3FB",
    iconColor: "#4A90D9",
    title: "Export Ready",
    body: "Generate clean Word-compatible and PDF-ready documents with consistent formatting.",
  },
];

export default function FeatureCards() {
  return (
    <section
      id="about"
      className="section-pad"
      style={{ backgroundColor: "#F4F6F9" }}
    >
      <div className="section-container">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: "#1A2B4A" }}
          >
            Everything you need, nothing you don&apos;t.
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "#64748B" }}>
            Designed around the actual workflow of a private clinic consultation
            letter — from first draft to final export.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: f.iconBg, color: f.iconColor }}
              >
                {f.icon}
              </div>

              {/* Text */}
              <h3
                className="text-base font-semibold mb-2"
                style={{ color: "#1A2B4A" }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
