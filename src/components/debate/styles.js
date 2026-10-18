// Átomos de estilo do Debate Trainer (estilos inline com as variáveis CSS do
// tema em index.css), compartilhados entre a tela de configuração e os chats.

export const SECTION_LABEL = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 600,
  color: "var(--brand-400)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 10,
  fontFamily: "var(--font-mono)",
};

export const CARD = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-card)",
  padding: 24,
};

export const INPUT = {
  width: "100%",
  background: "var(--bg-overlay)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-btn)",
  padding: "10px 14px",
  fontSize: "var(--fs-body)",
  fontFamily: "var(--font-ui)",
  color: "var(--text-primary)",
  outline: "none",
  transition: "border-color 200ms",
};

export const PRIMARY_BTN = {
  background: "var(--grad-brand)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-btn)",
  padding: "11px 22px",
  fontSize: "var(--fs-body)",
  fontWeight: 600,
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  boxShadow: "var(--glow-brand)",
  transition: "transform 180ms var(--ease-out-expo), opacity 180ms",
};

export const GHOST_BTN = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-btn)",
  padding: "9px 16px",
  fontSize: "var(--fs-small)",
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  transition: "color 180ms, border-color 180ms",
};

// Gold primary (cápsula gold, texto navy) — modal de encerrar + botões do relatório.
export const GOLD_BTN = {
  background: "var(--accent-500)",
  color: "hsl(210 42% 8%)",
  border: "none",
  borderRadius: "var(--radius-btn)",
  padding: "11px 22px",
  fontSize: "var(--fs-body)",
  fontWeight: 600,
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  transition: "opacity 180ms, transform 180ms var(--ease-out-expo)",
};

// Gold outline (secundário) — botão "Encerrar sessão" no header. Hover via .btn-gold-outline.
export const GOLD_OUTLINE_BTN = {
  background: "transparent",
  color: "var(--accent-400)",
  border: "1px solid var(--accent-400)",
  borderRadius: "var(--radius-btn)",
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
};
