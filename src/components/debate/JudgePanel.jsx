// Feedback do juiz para UMA fala do aluno. Chega de forma assíncrona: a réplica
// aparece primeiro e a análise surge quando o trigger onTurnCreated grava
// `analysis` no doc do turno. Falácias são sempre apresentadas como hipótese.

import {
  FALLACY_CONFIDENCE,
  FALLACY_TYPES,
  PREMISE_STATUS,
  PREMISE_TYPES,
  RUBRIC_LABELS,
  formatScore,
} from "../../lib/debateUi";

const BOX = {
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-btn)",
  padding: "12px 14px",
  fontSize: "var(--fs-small)",
  color: "var(--text-secondary)",
  lineHeight: 1.55,
};

const H = {
  fontSize: "var(--fs-tiny)",
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--brand-400)",
  margin: "14px 0 6px",
};

const STATUS_NOTES = {
  pending: "O juiz está analisando sua fala…",
  running: "O juiz está analisando sua fala…",
  error: "Não foi possível analisar esta fala. O debate continua normalmente.",
  blocked: "Esta fala não pôde ser analisada pelos filtros de segurança.",
};

function Badge({ color, children }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: "0.66rem",
      color,
      border: `1px solid color-mix(in hsl, ${color} 45%, transparent)`,
      borderRadius: 4,
      padding: "0 6px",
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export default function JudgePanel({ turn, defaultOpen = false, renderFallacyActions }) {
  if (!turn || turn.analysisStatus === "skipped") return null;
  const a = turn.analysis;
  if (turn.analysisStatus !== "done" || !a) {
    const note = STATUS_NOTES[turn.analysisStatus] ?? STATUS_NOTES.pending;
    return <div style={{ ...BOX, fontFamily: "var(--font-mono)", fontSize: "var(--fs-tiny)", alignSelf: "flex-end", maxWidth: "78%" }}>{note}</div>;
  }
  const arg = a.argumento_estudante ?? {};
  const capped = turn.analysisGuards?.scoresCapped > 0;

  return (
    <details open={defaultOpen} style={{ ...BOX, alignSelf: "flex-end", maxWidth: "78%", width: "100%" }} className="anim-fade-up">
      <summary style={{ cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--fs-tiny)", color: "var(--text-primary)" }}>
        Feedback do juiz (automático, pode errar) ·{" "}
        {RUBRIC_LABELS.map(([k]) => formatScore(a.rubrica?.[k]).replace("/5", "")).join(" · ")}
      </summary>

      <div style={H}>Rubrica (0 a 5)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
        {RUBRIC_LABELS.map(([k, label]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{label}</span>
            <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{formatScore(a.rubrica?.[k])}</strong>
          </div>
        ))}
      </div>
      {capped && (
        <p style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", margin: "6px 0 0" }}>
          Notas limitadas a 3: a fala não citou fonte específica (artigo, regra ou decisão).
        </p>
      )}

      <div style={H}>Estrutura do argumento (Toulmin)</div>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 12px" }}>
        <dt>Alegação</dt><dd style={{ margin: 0, color: "var(--text-primary)" }}>{arg.alegacao || "—"}</dd>
        <dt>Dados</dt>
        <dd style={{ margin: 0, color: "var(--text-primary)" }}>{arg.dados?.length ? arg.dados.join(" · ") : "—"}</dd>
        <dt>Garantia</dt><dd style={{ margin: 0, color: "var(--text-primary)" }}>{arg.garantia || "—"}</dd>
        <dt>Qualificador</dt><dd style={{ margin: 0, color: "var(--text-primary)" }}>{arg.qualificador || "—"}</dd>
      </dl>

      {arg.premissas?.length > 0 && (
        <>
          <div style={H}>Premissas</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {arg.premissas.map((p, i) => {
              const st = PREMISE_STATUS[p.status] ?? PREMISE_STATUS.nao_verificavel;
              return (
                <li key={i}>
                  <span style={{ color: "var(--text-primary)" }}>{p.texto}</span>{" "}
                  <Badge color={st.color}>{st.label}</Badge>{" "}
                  <Badge color="var(--text-muted)">{PREMISE_TYPES[p.tipo] ?? p.tipo}</Badge>
                  {p.comentario && <div>{p.comentario}</div>}
                  {p.evidencia_dossie && <div style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>Dossiê: {p.evidencia_dossie}</div>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {a.falacias?.length > 0 && (
        <>
          <div style={H}>Possíveis falácias</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {a.falacias.map((f, i) => (
              <li key={i}>
                <Badge color="var(--warning)">Hipótese · confiança {FALLACY_CONFIDENCE[f.confianca] ?? f.confianca}</Badge>{" "}
                <strong style={{ color: "var(--text-primary)" }}>{FALLACY_TYPES[f.tipo] ?? f.tipo}</strong>{" "}
                <span style={{ fontSize: "var(--fs-tiny)" }}>({f.lado === "oponente" ? "na fala do oponente" : "na sua fala"})</span>
                <div style={{ fontStyle: "italic" }}>“{f.trecho}”</div>
                <div>{f.explicacao}</div>
                {renderFallacyActions?.(f, i)}
              </li>
            ))}
          </ul>
        </>
      )}

      {a.premissas_oponente?.length > 0 && (
        <>
          <div style={H}>Pontos frágeis do oponente</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {a.premissas_oponente.map((p, i) => (
              <li key={i}>
                <span style={{ color: "var(--text-primary)" }}>{p.texto}</span>
                <div>{p.problema}</div>
                <div style={{ color: "var(--text-primary)" }}>Como refutar: {p.como_refutar}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {a.pontos_fortes?.length > 0 && (
        <>
          <div style={H}>Pontos fortes</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{a.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </>
      )}

      {a.melhorias_prioritarias?.length > 0 && (
        <>
          <div style={H}>Melhorias prioritárias</div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>{a.melhorias_prioritarias.map((m, i) => <li key={i}>{m}</li>)}</ol>
        </>
      )}

      {a.sugestao_de_replica && (
        <>
          <div style={H}>Sugestão de réplica</div>
          <p style={{ margin: 0, color: "var(--text-primary)" }}>{a.sugestao_de_replica}</p>
        </>
      )}
    </details>
  );
}
