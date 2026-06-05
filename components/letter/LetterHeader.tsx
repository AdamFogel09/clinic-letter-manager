export default function LetterHeader() {
  return (
    <div style={{ padding: "8px 40px 36px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/clinic-logo.png"
        alt="Dr. Sumit Chatterji Clinic"
        style={{ maxHeight: 170, objectFit: "contain" }}
      />
      <p style={{
        margin: "10px 0 0",
        fontFamily: "'Avenir Next', 'Avenir', sans-serif",
        fontSize: "21px",
        fontWeight: 700,
        letterSpacing: "0.01em",
        color: "#1a1a1a",
      }}>
        מרפאת ריאות
      </p>
    </div>
  );
}
