export default function LetterHeader() {
  return (
    <div style={{ padding: "16px 40px 12px", display: "flex", justifyContent: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/clinic-logo.png"
        alt="Dr. Sumit Chatterji Clinic"
        style={{ maxHeight: 220, objectFit: "contain" }}
      />
    </div>
  );
}
