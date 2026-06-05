export default function LetterFooter() {
  return (
    <div style={{
      borderTop: "1px solid #1A2B4A",
      padding: "10px 40px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexShrink: 0,
      gap: 16,
      fontFamily: "'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif",
    }}>
      {/* Left — licences + specialty */}
      <div style={{ flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: "#2D4080", fontWeight: 700, margin: "0 0 2px", lineHeight: 1.6, letterSpacing: "0.01em" }}>
          Israel Medical Licence 1-143320
        </p>
        <p style={{ fontSize: 11, color: "#2D4080", fontWeight: 700, margin: "0 0 2px", lineHeight: 1.6, letterSpacing: "0.01em" }}>
          General Medical Council (UK) Licence 4630182
        </p>
        <p style={{ fontSize: 11, color: "#2D4080", fontWeight: 700, margin: 0, lineHeight: 1.6, letterSpacing: "0.01em" }}>
          Internal Medicine and Pulmonology
        </p>
      </div>

      {/* Right — contact */}
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: 11, color: "#2D4080", fontWeight: 700, margin: "0 0 2px", lineHeight: 1.6, letterSpacing: "0.01em" }}>
          Email: lungdrsumit@gmail.com
        </p>
        <p style={{ fontSize: 11, color: "#2D4080", fontWeight: 700, margin: 0, lineHeight: 1.6, letterSpacing: "0.01em" }}>
          Telephone: +972 53 3065358
        </p>
      </div>
    </div>
  );
}
