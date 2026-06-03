import Link from "next/link";
import MockLetterCard from "./MockLetterCard";

export default function HeroSection() {
  return (
    <section className="section-pad" style={{ backgroundColor: "#ffffff" }}>
      <div className="section-container">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: copy */}
          <div>
            {/* Eyebrow */}
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest mb-6"
              style={{ color: "#0D9488" }}
            >
              Private Practice Software
            </span>

            {/* Headline */}
            <h1
              className="text-4xl sm:text-5xl font-bold leading-tight"
              style={{ color: "#1A2B4A", lineHeight: "1.15" }}
            >
              Private Clinic Letter
              <br />
              Management,{" "}
              <span style={{ color: "#4A90D9" }}>Simplified.</span>
            </h1>

            {/* Subheadline */}
            <p
              className="mt-6 text-lg leading-relaxed max-w-md"
              style={{ color: "#64748B" }}
            >
              A secure workspace for creating, translating, reviewing, and
              preparing professional clinic letters with a faster and cleaner
              workflow.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 items-start">
              <Link href="/login" className="btn-primary">
                Doctor Login
              </Link>
              <span
                className="text-sm font-medium self-center"
                style={{ color: "#64748B" }}
              >
                Built for private clinical use
              </span>
            </div>

            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap gap-6">
              {[
                { icon: "🔒", text: "Secure access" },
                { icon: "📄", text: "Professional format" },
                { icon: "⚡", text: "Fast workflow" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-base">{icon}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#64748B" }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: mock letter card */}
          <div className="relative lg:rotate-1">
            <MockLetterCard />
          </div>
        </div>
      </div>
    </section>
  );
}
