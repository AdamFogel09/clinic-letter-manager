export default function LetterHeader() {
  return (
    <div style={{ padding: "8px 40px 36px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/clinic-logo.png"
        alt="Dr. Sumit Chatterji Clinic"
        style={{ maxHeight: 170, objectFit: "contain" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lungistitute.png"
        alt="מרפאת ריאות"
        style={{ marginTop: "10px", maxHeight: 40, objectFit: "contain" }}
      />
    </div>
  );
}
