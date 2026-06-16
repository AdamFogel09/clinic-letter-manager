export default function LetterHeader() {
  return (
    <div className="letter-header-wrap" style={{ padding: "8px 40px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/updatedLogo.png"
        alt="Dr. Sumit Chatterji Clinic"
        style={{ maxHeight: 220, objectFit: "contain", display: "block" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mirpaat.png"
        alt="מרפאת ריאות"
        style={{ maxHeight: 32, objectFit: "contain", display: "block", marginTop: 6 }}
      />
    </div>
  );
}
