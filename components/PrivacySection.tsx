const CheckIcon = () => (
  <svg
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <path d="M2 7l3.5 3.5L12 3" />
  </svg>
);

const privacyPoints = [
  {
    title: "Private doctor access",
    body: "Designed exclusively for one authorised practitioner. No shared accounts, no open registration.",
  },
  {
    title: "No public registration",
    body: "Patient correspondence stays within your workspace. No third-party analytics on clinical content.",
  },
  {
    title: "Doctor approval before final export",
    body: "Every letter requires explicit review and sign-off before it can be exported or distributed.",
  },
];

export default function PrivacySection() {
  return (
    <section
      id="security"
      className="section-pad"
      style={{ backgroundColor: "#1A2B4A" }}
    >
      <div className="section-container">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: "#14B8A8" }}
            >
              Privacy &amp; Security
            </span>
            <h2
              className="text-3xl sm:text-4xl font-bold text-white"
            >
              Designed with privacy in mind.
            </h2>
            <p
              className="mt-4 text-base leading-relaxed"
              style={{ color: "rgb(255 255 255 / 0.6)" }}
            >
              The system is intended for private clinical use with secure
              login, protected access, and careful handling of sensitive
              medical information.
            </p>
          </div>

          {/* Points */}
          <ul className="space-y-6">
            {privacyPoints.map((point) => (
              <li key={point.title} className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: "rgb(13 148 136 / 0.2)",
                    color: "#14B8A8",
                  }}
                >
                  <CheckIcon />
                </div>

                {/* Text */}
                <div>
                  <p className="text-white font-semibold text-sm">
                    {point.title}
                  </p>
                  <p
                    className="text-sm mt-1 leading-relaxed"
                    style={{ color: "rgb(255 255 255 / 0.6)" }}
                  >
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
