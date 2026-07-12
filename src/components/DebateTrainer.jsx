import { useEffect, useRef, useState } from "react";
import { MUN_COUNTRIES, findCountryByCode } from "../data/munCountries";
import { MUN_COMMITTEES, findCommitteeById } from "../data/munCommittees";

// ─── shared atoms ──────────────────────────────────────────────────────────
const SECTION_LABEL = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 600,
  color: "var(--brand-400)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 10,
  fontFamily: "var(--font-mono)",
};

const CARD = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-card)",
  padding: 24,
};

const INPUT = {
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

const PRIMARY_BTN = {
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

const GHOST_BTN = {
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

// ─── Setup screen ──────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [countryCode, setCountryCode] = useState("BR");
  const [committeeId, setCommitteeId] = useState("UNSC");
  const [topic, setTopic] = useState(MUN_COMMITTEES[0].topics[0]);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(null); // [{code2, name, rationale}]
  const [selectedAi, setSelectedAi] = useState([]); // [code2]
  const [error, setError] = useState("");

  const committee = findCommitteeById(committeeId);

  async function suggestDelegations() {
    setError("");
    setSuggesting(true);
    setSuggested(null);
    try {
      const userCountry = findCountryByCode(countryCode);
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "suggest",
          userCountry: { code2: userCountry.code2, name: userCountry.name },
          committee: committee.name,
          topic,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const sugg = (data.delegations || []).filter((d) => d.code2 !== countryCode);
      setSuggested(sugg);
      setSelectedAi(sugg.map((d) => d.code2));
    } catch (e) {
      setError("Falha ao sugerir delegações. Você pode escolher manualmente.");
      setSuggested([]);
      setSelectedAi([]);
    }
    setSuggesting(false);
  }

  function toggleAi(code2) {
    setSelectedAi((prev) =>
      prev.includes(code2) ? prev.filter((c) => c !== code2) : [...prev, code2]
    );
  }

  function start() {
    if (!selectedAi.length) {
      setError("Selecione pelo menos uma delegação para a IA interpretar.");
      return;
    }
    const userCountry = findCountryByCode(countryCode);
    const aiDelegations = selectedAi.map((c2) => {
      const found = findCountryByCode(c2);
      if (found) return { code2: found.code2, name: found.name, flag: found.flag };
      const sugg = suggested?.find((s) => s.code2 === c2);
      return { code2: sugg.code2, name: sugg.name, flag: "🏳️" };
    });
    onStart({
      userCountry: { ...userCountry },
      committee: { id: committee.id, name: committee.name, short: committee.short },
      topic,
      difficulty,
      aiDelegations,
    });
  }

  return (
    <div style={{ padding: "32px 28px", maxWidth: 760, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ fontSize: "var(--fs-tiny)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
          Treinador de Debate
        </div>
        <h1 style={{ fontSize: "var(--fs-h2)", fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: 0 }}>
          Configurar{" "}
          <em style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, background: "var(--grad-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            sessão
          </em>
        </h1>
        <p style={{ fontSize: "var(--fs-small)", color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.6 }}>
          Escolha sua delegação, o comitê e o tópico. A IA vai sugerir oponentes com base na geopolítica real.
        </p>
      </header>

      {/* Country */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        <div style={SECTION_LABEL}>Sua delegação</div>
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          style={{ ...INPUT, appearance: "none", cursor: "pointer" }}
        >
          {MUN_COUNTRIES.map((c) => (
            <option key={c.code2} value={c.code2}>
              {c.flag} {c.name} ({c.code2}) — {c.bloc}
            </option>
          ))}
        </select>
      </section>

      {/* Committee + topic */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        <div style={SECTION_LABEL}>Comitê</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {MUN_COMMITTEES.map((c) => {
            const selected = c.id === committeeId;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setCommitteeId(c.id);
                  setTopic(c.topics[0]);
                  setSuggested(null);
                  setSelectedAi([]);
                }}
                style={{
                  background: selected ? "color-mix(in hsl, var(--brand-500) 18%, transparent)" : "var(--bg-overlay)",
                  border: `1px solid ${selected ? "color-mix(in hsl, var(--brand-500) 45%, transparent)" : "var(--border)"}`,
                  color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                  borderRadius: "var(--radius-badge)",
                  padding: "6px 14px",
                  fontSize: "var(--fs-small)",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  transition: "background 180ms, border-color 180ms",
                }}
              >
                {c.short}
              </button>
            );
          })}
        </div>

        <div style={SECTION_LABEL}>Tópico</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {committee.topics.map((t) => {
            const selected = t === topic;
            return (
              <button
                key={t}
                onClick={() => {
                  setTopic(t);
                  setSuggested(null);
                  setSelectedAi([]);
                }}
                style={{
                  textAlign: "left",
                  background: selected ? "color-mix(in hsl, var(--brand-500) 12%, transparent)" : "transparent",
                  border: `1px solid ${selected ? "color-mix(in hsl, var(--brand-500) 35%, transparent)" : "var(--border)"}`,
                  borderRadius: "var(--radius-btn)",
                  padding: "10px 14px",
                  fontSize: "var(--fs-small)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-ui)",
                  cursor: "pointer",
                  transition: "background 180ms, border-color 180ms",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setSuggested(null);
            setSelectedAi([]);
          }}
          placeholder="Ou digite um tópico próprio…"
          style={INPUT}
        />
      </section>

      {/* Difficulty */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        <div style={SECTION_LABEL}>Dificuldade</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "beginner", label: "Iniciante", desc: "didático" },
            { id: "intermediate", label: "Intermediário", desc: "parlamentar completo" },
            { id: "advanced", label: "Avançado", desc: "contra-argumentos afiados" },
          ].map((d) => {
            const selected = d.id === difficulty;
            return (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                style={{
                  flex: 1,
                  background: selected ? "color-mix(in hsl, var(--brand-500) 15%, transparent)" : "var(--bg-overlay)",
                  border: `1px solid ${selected ? "color-mix(in hsl, var(--brand-500) 40%, transparent)" : "var(--border)"}`,
                  borderRadius: "var(--radius-btn)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "background 180ms, border-color 180ms",
                }}
              >
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 600, color: "var(--text-primary)" }}>{d.label}</div>
                <div style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{d.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* AI delegations */}
      <section style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Delegações da IA</div>
          <button
            onClick={suggestDelegations}
            disabled={suggesting}
            style={{ ...GHOST_BTN, opacity: suggesting ? 0.6 : 1 }}
          >
            {suggesting ? "Sugerindo…" : suggested ? "Sugerir de novo" : "Sugerir automaticamente"}
          </button>
        </div>

        {!suggested && !suggesting && (
          <p style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)", marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
            Clique em <span style={{ color: "var(--brand-400)", fontFamily: "var(--font-mono)" }}>"Sugerir automaticamente"</span> para a IA propor 2 oponentes relevantes com base no comitê e tópico.
          </p>
        )}

        {suggested && suggested.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {suggested.map((d) => {
              const on = selectedAi.includes(d.code2);
              return (
                <button
                  key={d.code2}
                  onClick={() => toggleAi(d.code2)}
                  style={{
                    textAlign: "left",
                    background: on ? "color-mix(in hsl, var(--brand-500) 12%, transparent)" : "var(--bg-overlay)",
                    border: `1px solid ${on ? "color-mix(in hsl, var(--brand-500) 40%, transparent)" : "var(--border)"}`,
                    borderRadius: "var(--radius-btn)",
                    padding: "12px 14px",
                    cursor: "pointer",
                    transition: "background 180ms, border-color 180ms",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "var(--fs-tiny)",
                      color: "var(--brand-400)", background: "var(--bg-base)",
                      border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px",
                    }}>{d.code2}</span>
                    <span style={{ fontSize: "var(--fs-small)", fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</span>
                    {on && <span style={{ marginLeft: "auto", fontSize: "var(--fs-tiny)", color: "var(--accent-400)", fontFamily: "var(--font-mono)" }}>SELECTED</span>}
                  </div>
                  <div style={{ fontSize: "var(--fs-tiny)", color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-mono)" }}>
                    {d.rationale}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Manual override */}
        <details style={{ marginTop: 14 }}>
          <summary style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Ou escolher manualmente
          </summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {MUN_COUNTRIES.filter((c) => c.code2 !== countryCode).map((c) => {
              const on = selectedAi.includes(c.code2);
              return (
                <button
                  key={c.code2}
                  onClick={() => {
                    toggleAi(c.code2);
                    if (!suggested) setSuggested([]);
                  }}
                  style={{
                    background: on ? "color-mix(in hsl, var(--brand-500) 18%, transparent)" : "var(--bg-overlay)",
                    border: `1px solid ${on ? "color-mix(in hsl, var(--brand-500) 40%, transparent)" : "var(--border)"}`,
                    color: "var(--text-primary)",
                    borderRadius: "var(--radius-badge)",
                    padding: "4px 10px",
                    fontSize: "var(--fs-tiny)",
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                  }}
                >
                  {c.code2}
                </button>
              );
            })}
          </div>
        </details>
      </section>

      {error && (
        <p style={{ fontSize: "var(--fs-small)", color: "var(--danger)", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
          {error}
        </p>
      )}

      <button
        onClick={start}
        disabled={!selectedAi.length}
        style={{ ...PRIMARY_BTN, opacity: selectedAi.length ? 1 : 0.5, cursor: selectedAi.length ? "pointer" : "not-allowed" }}
      >
        Iniciar sessão →
      </button>
    </div>
  );
}

// ─── Chat screen ───────────────────────────────────────────────────────────
function MessageBubble({ entry, isUser }) {
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

function TypingIndicator({ country }) {
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

function ChatScreen({ session, onExit }) {
  const { userCountry, committee, topic, difficulty, aiDelegations } = session;
  const [history, setHistory] = useState([]); // [{role, country, text}]
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [nextAiIdx, setNextAiIdx] = useState(0); // round-robin
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, pending]);

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setError("");
    setDraft("");

    const userTurn = {
      role: "user",
      country: { code2: userCountry.code2, name: userCountry.name },
      text,
    };
    const newHistory = [...history, userTurn];
    setHistory(newHistory);

    const aiDelegation = aiDelegations[nextAiIdx % aiDelegations.length];
    setNextAiIdx((i) => i + 1);
    setPending(true);

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reply",
          userCountry: { code2: userCountry.code2, name: userCountry.name },
          committee: committee.name,
          topic,
          aiDelegation: { code2: aiDelegation.code2, name: aiDelegation.name },
          difficulty,
          history: newHistory.map((h) => ({
            role: h.role,
            country: h.country,
            text: h.text,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          country: { code2: data.delegation.code2, name: data.delegation.name },
          text: data.text,
        },
      ]);
    } catch (e) {
      setError("Erro ao consultar a delegação. Tente novamente.");
    }
    setPending(false);
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const pendingDelegation =
    pending ? aiDelegations[(nextAiIdx - 1 + aiDelegations.length) % aiDelegations.length] : null;

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
            <span><span style={{ color: "var(--brand-400)" }}>Committee:</span> {committee.short}</span>
            <span><span style={{ color: "var(--brand-400)" }}>Topic:</span> {topic}</span>
            <span><span style={{ color: "var(--brand-400)" }}>You:</span> {userCountry.code2}</span>
            <span><span style={{ color: "var(--brand-400)" }}>vs:</span> {aiDelegations.map((d) => d.code2).join(" · ")}</span>
          </div>
          <button onClick={onExit} style={{ ...GHOST_BTN, padding: "5px 12px", fontSize: "var(--fs-tiny)" }}>
            ↺ Nova sessão
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "12px 4px",
          minHeight: 0,
        }}
      >
        {history.length === 0 && !pending && (
          <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)", textAlign: "center", padding: "40px 20px", lineHeight: 1.7 }}>
            <div style={{ color: "var(--accent-400)", fontSize: "var(--fs-tiny)", letterSpacing: "0.08em", marginBottom: 8 }}>
              [SESSION OPEN]
            </div>
            Sessão aberta. Faça sua primeira intervenção — uma motion, point of information ou statement.
            <br />
            <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-tiny)" }}>
              ex: "A delegação de {userCountry.name} solicita uma moderated caucus de 10 minutos, com tempo de fala de 60 segundos, sobre cooperação humanitária."
            </span>
          </div>
        )}

        {history.map((entry, i) => (
          <MessageBubble key={i} entry={entry} isUser={entry.role === "user"} />
        ))}

        {pending && pendingDelegation && <TypingIndicator country={pendingDelegation} />}
      </div>

      {error && (
        <p style={{ fontSize: "var(--fs-small)", color: "var(--danger)", margin: "8px 0", fontFamily: "var(--font-mono)" }}>
          {error}
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
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Sua fala, motion ou point…  (Enter = enviar · Shift+Enter = nova linha)"
          rows={2}
          style={{
            ...INPUT,
            resize: "none",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-small)",
            lineHeight: 1.5,
            background: "var(--bg-overlay)",
          }}
        />
        <button
          onClick={send}
          disabled={pending || !draft.trim()}
          style={{
            ...PRIMARY_BTN,
            opacity: pending || !draft.trim() ? 0.5 : 1,
            cursor: pending || !draft.trim() ? "not-allowed" : "pointer",
            alignSelf: "stretch",
          }}
        >
          {pending ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────
// EXTENSION POINTS (future milestones — not in scope now):
// - Persist `session` + `history` to Firestore under user's uid.
// - Add scoring/feedback panel after N turns (delegado evaluation).
// - Modes: 1v1, multi-bloc plenary, voting simulation.
// - Streaming via SSE in /api/debate for token-by-token bubbles.
export default function DebateTrainer() {
  const [session, setSession] = useState(null);

  if (!session) return <SetupScreen onStart={setSession} />;
  return <ChatScreen session={session} onExit={() => setSession(null)} />;
}
