// Bolhas do chat do Debate Trainer (fala, réplica e "digitando…").

export function MessageBubble({ entry, isUser }) {
  const { country, text } = entry;
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }} className="anim-fade-up">
      <div style={{
        maxWidth: "78%",
        background: isUser
          ? "color-mix(in hsl, var(--brand-500) 15%, transparent)"
          : "var(--bg-overlay)",
        border: `1px solid ${isUser ? "color-mix(in hsl, var(--brand-500) 30%, transparent)" : "var(--border)"}`,
        borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
        padding: "10px 14px",
      }}>
        <div style={{
          fontSize: "0.68rem",
          color: "var(--text-muted)",
          marginBottom: 5,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            color: "var(--brand-400)",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "0px 5px",
            fontSize: "0.62rem",
            letterSpacing: "0.04em",
          }}>{country.code2}</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{country.name}</span>
        </div>
        <p style={{
          fontSize: "var(--fs-small)",
          color: "var(--text-primary)",
          margin: 0,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}>{text}</p>
      </div>
    </div>
  );
}

export function TypingIndicator({ country, label }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border)",
        borderRadius: "4px 12px 12px 12px",
        padding: "10px 14px",
      }}>
        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontFamily: "var(--font-mono)", color: "var(--brand-400)",
            background: "var(--bg-base)", border: "1px solid var(--border)",
            borderRadius: 4, padding: "0px 5px", fontSize: "0.62rem", letterSpacing: "0.04em",
          }}>{country.code2}</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{country.name}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", height: 14 }}>
          {label && (
            <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginRight: 6 }}>
              {label}
            </span>
          )}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "var(--brand-400)",
                animation: `blink 1.2s ease-in-out ${i * 0.18}s infinite`,
                display: "block",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
