import Link from "next/link";

export default function CtaSection() {
  return (
    <section className="section-pad" style={{ backgroundColor: "#F4F6F9" }}>
      <div className="section-container">
        <div className="max-w-xl mx-auto text-center">
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: "#1A2B4A" }}
          >
            Ready to create a new clinic letter?
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "#64748B" }}>
            Log in to your secure workspace and get started in minutes.
          </p>

          <Link href="/login" className="btn-primary mt-8 mx-auto">
            Login to Workspace
          </Link>

          <p className="mt-4 text-xs" style={{ color: "#64748B" }}>
            Authorised users only. Access is restricted.
          </p>
        </div>
      </div>
    </section>
  );
}
