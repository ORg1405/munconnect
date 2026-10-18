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
import { PEDAGOGICAL_NOTICE, canEndDebate, secondsUntil, turnErrorMessage } from "../../lib/debateUi";
import { CARD, GHOST_BTN, GOLD_BTN, GOLD_OUTLINE_BTN, INPUT, PRIMARY_BTN } from "./styles";

const FORMULATING = "O delegado está formulando a resposta";

export default function BlocChatScreen({ session, onExit }) {
  const { committee, topic, userBloc, aiBloc, setup } = session;
  const { debateId, send, pending, streamingText, error, quota } = useDebateTurn({ committeeId: committee.id, setup });
  const analyses = useTurnAnalyses(debateId);
  const report = useDebateReport(debateId);
  const [turns, setTurns] = useState([]); // [{ index, userText, opponentText }]
  const [draft, setDraft] = useState("");
  const [sendingText, setSendingText] = useState(null); // fala em envio (bolha provisória)
  const [showEndModal, setShowEndModal] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
    if (!text || blockedInput) return;
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

  // Cota: o servidor decide; aqui só evitamos o envio que ele recusaria e
  // mostramos a contagem regressiva ao vivo (intervalo mínimo entre falas).
  const cooldownAt = error?.reason === "cooldown" ? error.resetsAt : quota?.nextTurnAvailableAt;
  const cooldownLeft = secondsUntil(cooldownAt, new Date(now));
  const outOfTurns = quota?.turnsLeftInDebate === 0 || error?.reason === "debate-turns";
  const dailyBlocked = error?.reason === "daily-debates";
  const ticking = cooldownLeft > 0 || dailyBlocked;
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);
  const errorUi = error && !pending ? turnErrorMessage(error, new Date(now)) : null;
  const blockedInput = pending || cooldownLeft > 0 || outOfTurns || dailyBlocked;
  const sendDisabled = blockedInput || !draft.trim();
  const toneColor = { busy: "var(--text-secondary)", quota: "var(--warning)", blocked: "var(--danger)", error: "var(--danger)" };

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
            {quota && <span><span style={{ color: "var(--brand-400)" }}>Falas restantes:</span> {quota.turnsLeftInDebate}</span>}
            {quota && <span><span style={{ color: "var(--brand-400)" }}>Debates hoje:</span> {quota.debatesLeftToday} restantes</span>}
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

      <p style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", margin: "-6px 4px 10px", lineHeight: 1.5, flexShrink: 0 }}>
        {PEDAGOGICAL_NOTICE}
      </p>

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
          {errorUi ? (
            <p role="status" style={{ fontSize: "var(--fs-small)", color: toneColor[errorUi.tone], margin: "8px 0", fontFamily: "var(--font-mono)" }}>
              {errorUi.message}
            </p>
          ) : outOfTurns ? (
            <p role="status" style={{ fontSize: "var(--fs-small)", color: "var(--warning)", margin: "8px 0", fontFamily: "var(--font-mono)" }}>
              Você usou todas as falas deste debate. Encerre para receber seu relatório.
            </p>
          ) : null}

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
              disabled={sendDisabled}
              style={{
                ...PRIMARY_BTN,
                opacity: sendDisabled ? 0.5 : 1,
                cursor: sendDisabled ? "not-allowed" : "pointer",
                alignSelf: "stretch",
                minWidth: 96,
              }}
            >
              {pending ? "…" : cooldownLeft > 0 ? `${cooldownLeft} s` : error ? "Reenviar" : "Enviar"}
            </button>
          </div>
          <p style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: "6px 4px 0", minHeight: "1.2em" }}>
            {speech.error
              ? speech.error
              : speech.listening
                ? `Ouvindo… ${speech.interim}`
                : !speech.supported
                  ? "Ditado por voz indisponível neste navegador: digite sua fala."
                  : cooldownLeft > 0 && !errorUi
                    ? `Você poderá falar de novo em ${cooldownLeft} s. Enquanto isso, prepare sua fala.`
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
