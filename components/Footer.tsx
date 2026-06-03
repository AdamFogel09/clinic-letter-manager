export default function Footer() {
  return (
    <footer
      className="bg-white"
      style={{ borderTop: "1px solid #E2E8F0" }}
    >
      <div className="section-container py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span
            className="text-sm font-semibold"
            style={{ color: "#1A2B4A" }}
          >
            Dr. [Name] Clinic
          </span>

          <span
            className="text-xs text-center"
            style={{ color: "#64748B" }}
          >
            Private clinical correspondence system. Authorised access only.
          </span>

          <span className="text-xs" style={{ color: "#64748B" }}>
            &copy; {new Date().getFullYear()} Dr. [Name] Clinic
          </span>
        </div>
      </div>
    </footer>
  );
}
