// Chat dos comitês de blocos (ex.: TPI) pelo callable debateTurn: réplica em
// streaming, debate guardado no servidor (cota, resumo, análise por turno).
//
// O rascunho do aluno só é apagado depois que o servidor confirma o turno: em
// erro de rede, cota ou reenvio ele continua na caixa de texto.

import { useEffect, useRef, useState } from "react";
import { useDebateReport } from "../../hooks/useDebateReport";
import { useDebateTurn } from "../../hooks/useDebateTurn";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import { useTurnAnalyses } from "../../hooks/useTurnAnalyses";
import { MessageBubble, TypingIndicator } from "./Bubbles";
import DisputeControl from "./DisputeControl";
import JudgePanel from "./JudgePanel";
import ReportPanel from "./ReportPanel";
import { canEndDebate } from "../../lib/debateUi";
import { CARD, GHOST_BTN, GOLD_BTN, GOLD_OUTLINE_BTN, INPUT, PRIMARY_BTN } from "./styles";

const FORMULATING = "O delegado está formulando a resposta";

export default function BlocChatScreen({ session, onExit }) {
  const { committee, topic, userBloc, aiBloc, setup } = session;
  const { debateId, send, pending, streamingText, error } = useDebateTurn({ committeeId: committee.id, setup });
  const analyses = useTurnAnalyses(debateId);
  const report = useDebateReport(debateId);
  const [turns, setTurns] = useState([]); // [{ index, userText, opponentText }]
  const [draft, setDraft] = useState("");
  const [sendingText, setSendingText] = useState(null); // fala em envio (bolha provisória)
  const [showEndModal, setShowEndModal] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const scrollRef = useRef(null);
  // Ditado: cada trecho final entra no fim do rascunho, que segue editável.
  const speech = useSpeechInput({
    lang: "pt-BR",
    onFinal: (text) => text && setDraft((d) => (d && !/\s$/.test(d) ? `${d} ${text}` : `${d}${text}`)),
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, pending, streamingText, analyses, reportOpen, report.status]);

  // Relatório já pedido (ou pronto, ao reabrir o debate): a sessão fica encerrada.
  const showReport = reportOpen || report.status === "done";
  const canEnd = canEndDebate(turns.length) && !pending && !showReport;

  function confirmEnd() {
    setShowEndModal(false);
    setReportOpen(true);
    report.generate();
  }

  async function submit() {
    const text = draft.trim();
    if (!text || pending) return;
    speech.stop();
    setSendingText(text);
    const result = await send(text);
    setSendingText(null);
    if (!result) return; // erro: o rascunho continua intacto
    setTurns((prev) => [...prev, { index: result.turnIndex, userText: text, opponentText: result.text }]);
    // Só limpa se o aluno não mexeu no rascunho enquanto esperava a réplica.
    setDraft((current) => (current.trim() === text ? "" : current));
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const userEntry = (text) => ({ country: { code2: userBloc.code2, name: userBloc.name }, text });
  const aiEntry = (text) => ({ country: { code2: aiBloc.code2, name: aiBloc.name }, text });
  const busy = error?.code === "unavailable" || error?.reason === "model-busy";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", padding: "20px 24px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
      {/* Header — terminal style */}
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-card)",
        boxShadow: "0 0 0 1px hsl(220 15% 96% / 0.05), var(--glow-brand)",
        padding: "14px 18px",
        marginBottom: 16,
        fontFamily: "var(--font-mono)",
        fontSize: "0.78rem",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }} aria-hidden="true">
          {["#EF4444", "#F59E0B", "#22C55E"].map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "block" }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, color: "var(--text-muted)" }}>
            <span><span style={{ color: "var(--brand-400)" }}>Comitê:</span> {committee.short}</span>
            <span><span style={{ color: "var(--brand-400)" }}>Tema:</span> {topic}</span>
            <span><span style={{ color: "var(--brand-400)" }}>Você:</span> {userBloc.name}</span>
            <span><span style={{ color: "var(--brand-400)" }}>vs:</span> {aiBloc.name}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {canEnd && (
              <button
                className="btn-gold-outline"
                onClick={() => setShowEndModal(true)}
                style={{ ...GOLD_OUTLINE_BTN, padding: "5px 12px", fontSize: "var(--fs-tiny)" }}
              >
                Encerrar e gerar relatório
              </button>
            )}
            <button onClick={onExit} style={{ ...GHOST_BTN, padding: "5px 12px", fontSize: "var(--fs-tiny)" }}>
              ↺ Nova sessão
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "12px 4px", minHeight: 0 }}
      >
        {turns.length === 0 && !pending && (
          <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)", textAlign: "center", padding: "40px 20px", lineHeight: 1.7 }}>
            <div style={{ color: "var(--accent-400)", fontSize: "var(--fs-tiny)", letterSpacing: "0.08em", marginBottom: 8 }}>
              [SESSÃO ABERTA]
            </div>
            Apresente sua prova e explique o que ela demonstra sobre o tema do ciclo.
            <br />
            <span style={{ fontSize: "var(--fs-tiny)" }}>
              O {aiBloc.name} responde e termina com uma pergunta, como num interrogatório.
            </span>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.index} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MessageBubble entry={userEntry(t.userText)} isUser />
            <MessageBubble entry={aiEntry(t.opponentText)} isUser={false} />
            {/* Depois da réplica: a análise chega depois e não empurra a resposta. */}
            <JudgePanel
              turn={analyses[t.index] ?? { analysisStatus: "pending" }}
              defaultOpen={t.index === turns.at(-1).index}
              renderFallacyActions={(_, i) => (
                <DisputeControl debateId={debateId} turnId={analyses[t.index].id} index={i} existing={analyses[t.index].disputes?.[i]} />
              )}
            />
          </div>
        ))}

        {sendingText && <MessageBubble entry={userEntry(sendingText)} isUser />}
        {pending && (streamingText ? (
          <MessageBubble entry={aiEntry(streamingText)} isUser={false} />
        ) : (
          <TypingIndicator country={aiBloc} label={`${FORMULATING}…`} />
        ))}

        {showReport && (
          <ReportPanel report={report} onRetry={report.generate} onBack={() => setReportOpen(false)} onExit={onExit} />
        )}
      </div>

      {!showReport && (
        <>
          {error && !pending && (
            <p
              role="status"
              style={{ fontSize: "var(--fs-small)", color: busy ? "var(--text-secondary)" : "var(--danger)", margin: "8px 0", fontFamily: "var(--font-mono)" }}
            >
              {busy ? `${FORMULATING}. Sua fala continua na caixa abaixo: envie de novo em alguns segundos.` : error.message}
            </p>
          )}

          {/* Input */}
          <div style={{
            display: "flex",
            gap: 10,
            marginTop: 12,
            padding: "12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            flexShrink: 0,
          }}>
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stop : speech.start}
                aria-pressed={speech.listening}
                title={speech.listening ? "Parar o ditado" : "Ditar pelo microfone (pt-BR)"}
                style={{
                  ...GHOST_BTN,
                  alignSelf: "stretch",
                  color: speech.listening ? "var(--accent-400)" : "var(--text-secondary)",
                  borderColor: speech.listening ? "var(--accent-400)" : "var(--border)",
                }}
              >
                {speech.listening ? "■ Parar" : "🎙 Falar"}
              </button>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="Sua prova e a explicação…  (Enter = enviar · Shift+Enter = nova linha)"
              rows={3}
              maxLength={2000}
              style={{ ...INPUT, resize: "none", fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)", lineHeight: 1.5 }}
            />
            <button
              onClick={submit}
              disabled={pending || !draft.trim()}
              style={{
                ...PRIMARY_BTN,
                opacity: pending || !draft.trim() ? 0.5 : 1,
                cursor: pending || !draft.trim() ? "not-allowed" : "pointer",
                alignSelf: "stretch",
              }}
            >
              {pending ? "…" : error ? "Reenviar" : "Enviar"}
            </button>
          </div>
          <p style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: "6px 4px 0", minHeight: "1.2em" }}>
            {speech.error
              ? speech.error
              : speech.listening
                ? `Ouvindo… ${speech.interim}`
                : !speech.supported
                  ? "Ditado por voz indisponível neste navegador: digite sua fala."
                  : "Use o microfone ou digite; revise o texto antes de enviar."}
          </p>
        </>
      )}

      {/* Modal de confirmação de encerramento */}
      {showEndModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowEndModal(false)}
          style={{ position: "fixed", inset: 0, background: "hsl(210 42% 3% / 0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ ...CARD, maxWidth: 440, width: "100%", padding: 28 }}>
            <h3 style={{ fontSize: "var(--fs-h3)", fontFamily: "var(--font-ui)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>
              Encerrar sessão
            </h3>
            <p style={{ fontSize: "var(--fs-small)", color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 24px" }}>
              O debate será encerrado e um relatório da sua atuação será gerado. Isso pode levar até 2 minutos.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowEndModal(false)} style={{ ...GHOST_BTN, padding: "9px 18px" }}>
                Cancelar
              </button>
              <button onClick={confirmEnd} style={{ ...GOLD_BTN, padding: "9px 18px", fontSize: "var(--fs-small)" }}>
                Encerrar e gerar relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
