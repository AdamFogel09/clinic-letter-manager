export default function LetterHeader() {
  return (
    <div style={{ padding: "8px 40px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/clinic-logo.png"
        alt="Dr. Sumit Chatterji Clinic"
        style={{ maxHeight: 170, objectFit: "contain" }}
      />
    </div>
  );
}
