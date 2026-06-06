export default function LetterHeader() {
  return (
    <div className="letter-header-wrap" style={{ padding: "8px 40px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/clinic-logo.png"
        alt="Dr. Sumit Chatterji Clinic"
        style={{ maxHeight: 220, objectFit: "contain" }}
      />
    </div>
  );
}
