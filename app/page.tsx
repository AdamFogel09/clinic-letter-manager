import Link from "next/link";

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#F4F6F9" }}
    >
      {/* Top bar */}
      <header className="px-6 sm:px-10 pt-8">
        <span
          className="text-sm font-semibold tracking-tight"
          style={{ color: "#1A2B4A" }}
        >
          Dr. Sumit Chatterji
        </span>
      </header>

      {/* Center content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-sm w-full">
          <h1
            className="text-3xl sm:text-4xl font-bold leading-tight mb-4"
            style={{ color: "#1A2B4A" }}
          >
            Clinic Letter Workspace
          </h1>

          <p
            className="text-sm leading-relaxed mb-10"
            style={{ color: "#64748B" }}
          >
            Private workspace for preparing, reviewing, and exporting clinic
            letters.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 text-sm font-semibold rounded-xl transition-colors duration-150"
            style={{
              backgroundColor: "#1A2B4A",
              color: "#ffffff",
            }}
          >
            Login
          </Link>

          <p className="mt-4 text-xs" style={{ color: "#94A3B8" }}>
            Authorized access only.
          </p>
        </div>
      </main>
    </div>
  );
}
