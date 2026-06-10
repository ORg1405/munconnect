import { STATUS } from "../../data/mockConference";

/** Selo de status de um subitem da agenda (verde / amarelo* / cinza). */
export default function StatusBadge({ status }) {
  const meta = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{
        fontSize: "var(--fs-tiny)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: "var(--radius-badge)",
        padding: "3px 10px",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: meta.color,
          flexShrink: 0,
        }}
      />
      {meta.label}
      {meta.suffix && <span aria-hidden>{meta.suffix}</span>}
    </span>
  );
}
