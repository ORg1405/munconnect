// Relatório final do debate (useDebateReport): gerando → pronto | erro, com
// "tentar de novo". O estado vem do doc do debate no Firestore, então segue
// certo mesmo se a chamada passar do timeout do cliente ou a página recarregar.

import { REPORT_CRITERIA_LABELS, reportErrorMessage } from "../../lib/debateUi";
import { CARD, GHOST_BTN, GOLD_BTN, SECTION_LABEL } from "./styles";

export default function ReportPanel({ report, onRetry, onBack, onExit }) {
  const { status, error } = report;
  const data = report.report;

  if (status === "generating" || status === "idle") {
    return (
      <div style={{ ...CARD, textAlign: "center" }} role="status">
        <div style={SECTION_LABEL}>Relatório final</div>
        <p style={{ color: "var(--text-primary)", margin: "0 0 6px" }}>Gerando seu relatório…</p>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-small)", margin: 0 }}>
          Pode levar até 2 minutos. Se você fechar a página, ele continua sendo gerado e aparece aqui quando você voltar ao debate.
        </p>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div style={CARD} role="alert">
        <div style={SECTION_LABEL}>Relatório final</div>
        <p style={{ color: "var(--text-primary)", margin: "0 0 16px" }}>{reportErrorMessage(error)}</p>
        <div style={{ display: "flex", gap: 10 }}>
          {error?.reason !== "too-few-turns" && error?.reason !== "TRANSCRIPT_INVALIDA" && (
            <button onClick={onRetry} style={{ ...GOLD_BTN, padding: "9px 18px", fontSize: "var(--fs-small)" }}>
              Tentar de novo
            </button>
          )}
          <button onClick={onBack} style={{ ...GHOST_BTN, padding: "9px 18px" }}>
            Voltar ao debate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 16 }} className="anim-fade-up">
      <div>
        <div style={SECTION_LABEL}>Relatório final</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: "var(--fs-h2)", fontWeight: 700, color: "var(--text-primary)" }}>{data.notaGeral.toFixed(1)}</span>
          <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/ 10 · nota geral</span>
        </div>
        <p style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", margin: "4px 0 0" }}>
          Avaliação automática: pode errar. Use como ponto de partida, não como veredito.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {REPORT_CRITERIA_LABELS.map(([k, label]) => {
          const c = data.criterios?.[k];
          if (!c) return null;
          return (
            <div key={k} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong style={{ color: "var(--text-primary)", fontSize: "var(--fs-small)" }}>{label}</strong>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--brand-400)" }}>{c.nota.toFixed(1)}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--fs-small)", color: "var(--text-secondary)", lineHeight: 1.55 }}>{c.feedback}</p>
            </div>
          );
        })}
      </div>

      <div>
        <div style={SECTION_LABEL}>Pontos de melhoria</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-small)", color: "var(--text-primary)", lineHeight: 1.6 }}>
          {data.pontosDeMelhoria?.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </div>

      {data.recomendacaoComite && (
        <div>
          <div style={SECTION_LABEL}>Próximo passo: {data.recomendacaoComite.tipo}</div>
          <p style={{ margin: 0, fontSize: "var(--fs-small)", color: "var(--text-secondary)", lineHeight: 1.55 }}>{data.recomendacaoComite.justificativa}</p>
        </div>
      )}

      {data.observacoes && <p style={{ margin: 0, fontSize: "var(--fs-small)", color: "var(--text-secondary)" }}>{data.observacoes}</p>}

      <div>
        <button onClick={onExit} style={{ ...GOLD_BTN, padding: "9px 18px", fontSize: "var(--fs-small)" }}>
          Novo debate
        </button>
      </div>
    </div>
  );
}
