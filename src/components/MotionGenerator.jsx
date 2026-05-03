import { useState } from "react";

const CATEGORIES = [
  { id: "politics",  label: "Políticas e Governança",   labelEn: "Politics & Governance",    emoji: "🏛️" },
  { id: "rights",    label: "Direitos Humanos",          labelEn: "Human Rights",             emoji: "⚖️" },
  { id: "environment", label: "Meio Ambiente",           labelEn: "Environment",              emoji: "🌿" },
  { id: "security", label: "Segurança Internacional",    labelEn: "International Security",   emoji: "🛡️" },
  { id: "economy",  label: "Economia Global",            labelEn: "Global Economy",           emoji: "📊" },
  { id: "tech",     label: "Tecnologia e Inovação",      labelEn: "Technology & Innovation",  emoji: "💡" },
  { id: "ludic",    label: "Lúdicas e Criativas",        labelEn: "Creative & Playful",       emoji: "🎭" },
  { id: "current",  label: "Atuais",                     labelEn: "Current Events",           emoji: "📰" },
];

const STEP = { SELECT: "select", MOTIONS: "motions", ARGUMENTS: "arguments" };

export default function MotionGenerator() {
  const [lang, setLang] = useState("pt");
  const [category, setCategory] = useState(null);
  const [step, setStep] = useState(STEP.SELECT);
  const [motions, setMotions] = useState([]);
  const [selectedMotion, setSelectedMotion] = useState(null);
  const [args, setArgs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPt = lang === "pt";

  async function callClaude(prompt) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  async function generateMotions() {
    if (!category) return;
    setLoading(true);
    setError("");
    setStep(STEP.MOTIONS);
    setMotions([]);
    try {
      const cat = CATEGORIES.find(c => c.id === category);
      const catLabel = isPt ? cat.label : cat.labelEn;
      const prompt = isPt
        ? `Você é um especialista em Model United Nations (MUN). IMPORTANTE: responda EXCLUSIVAMENTE em português brasileiro.
Gere exatamente 3 moções para debate na categoria "${catLabel}".
As moções devem ser formais, diplomáticas e adequadas para um comitê MUN.
TODAS as moções devem estar escritas em português brasileiro.
Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato exato:
{"motions": ["moção em português 1", "moção em português 2", "moção em português 3"]}`
        : `You are a Model United Nations (MUN) expert. IMPORTANT: respond EXCLUSIVELY in English.
Generate exactly 3 motions for debate in the category "${catLabel}".
Motions must be formal, diplomatic and suitable for a MUN committee.
ALL motions must be written in English.
Respond ONLY with valid JSON, no text before or after, in this exact format:
{"motions": ["motion 1", "motion 2", "motion 3"]}`;

      const text = await callClaude(prompt);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setMotions(parsed.motions || []);
    } catch {
      setError(isPt ? "Erro ao gerar moções. Tente novamente." : "Error generating motions. Please try again.");
      setStep(STEP.SELECT);
    }
    setLoading(false);
  }

  async function generateArguments(motion) {
    setSelectedMotion(motion);
    setLoading(true);
    setError("");
    setStep(STEP.ARGUMENTS);
    setArgs(null);
    try {
      const prompt = isPt
        ? `Você é um diplomata especialista em debates de Model United Nations (MUN). IMPORTANTE: responda EXCLUSIVAMENTE em português brasileiro.
Para a seguinte moção: "${motion}"

Gere dois argumentos curtos e densos (máximo 4 frases cada), em tom extremamente formal, diplomático e inteligente.
AMBOS os argumentos devem estar escritos em português brasileiro.
Responda APENAS com JSON válido neste formato exato:
{"favor": "argumento a favor em português aqui", "contra": "argumento contra em português aqui"}`
        : `You are a diplomat and Model United Nations (MUN) debate expert. IMPORTANT: respond EXCLUSIVELY in English.
For the following motion: "${motion}"

Generate two short, dense arguments (maximum 4 sentences each), in an extremely formal, diplomatic and intelligent tone.
BOTH arguments must be written in English.
Respond ONLY with valid JSON in this exact format:
{"favor": "argument in favor in English here", "contra": "argument against in English here"}`;

      const text = await callClaude(prompt);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setArgs(parsed);
    } catch {
      setError(isPt ? "Erro ao gerar argumentos. Tente novamente." : "Error generating arguments. Please try again.");
    }
    setLoading(false);
  }

  function reset() {
    setStep(STEP.SELECT);
    setCategory(null);
    setMotions([]);
    setSelectedMotion(null);
    setArgs(null);
    setError("");
  }

  return (
    <div style={{ padding: 28, maxWidth: 780 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
            {isPt ? "Gerador de Moções" : "Motion Generator"}
          </h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
            {isPt ? "Moções para debate MUN geradas por IA" : "AI-generated MUN debate motions"}
          </p>
        </div>
        {/* Language toggle */}
        <div style={{ display: "flex", border: "0.5px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
          {["pt", "en"].map(l => (
            <button key={l} onClick={() => { setLang(l); reset(); }} style={{
              padding: "6px 14px", fontSize: 12, fontWeight: lang === l ? 600 : 400,
              background: lang === l ? "#1a1a1a" : "#fff",
              color: lang === l ? "#fff" : "#555",
              border: "none", cursor: "pointer",
            }}>
              {l === "pt" ? "PT" : "EN"}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1 — Category selection */}
      {step === STEP.SELECT && (
        <>
          <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
            {isPt ? "Selecione uma categoria para gerar moções:" : "Select a category to generate motions:"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, marginBottom: 20 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                padding: "12px 14px",
                border: category === cat.id ? "1.5px solid #1D9E75" : "0.5px solid #ddd",
                borderRadius: 10,
                background: category === cat.id ? "#E1F5EE" : "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{cat.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: category === cat.id ? "#0F6E56" : "#1a1a1a" }}>
                  {isPt ? cat.label : cat.labelEn}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={generateMotions}
            disabled={!category}
            style={{
              padding: "9px 24px", fontSize: 13, fontWeight: 500,
              background: category ? "#1D9E75" : "#ccc",
              color: "#fff", border: "none", borderRadius: 8,
              cursor: category ? "pointer" : "not-allowed",
            }}
          >
            {isPt ? "Gerar moções →" : "Generate motions →"}
          </button>
        </>
      )}

      {/* STEP 2 — Motion selection */}
      {step === STEP.MOTIONS && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={reset} style={backBtnStyle}>← {isPt ? "Voltar" : "Back"}</button>
            <span style={{ fontSize: 13, color: "#888" }}>
              {isPt ? "Escolha uma moção para debater:" : "Choose a motion to debate:"}
            </span>
          </div>

          {loading && (
            <div style={loadingStyle}>
              <div style={spinnerStyle} />
              <span style={{ fontSize: 13, color: "#888" }}>
                {isPt ? "Gerando moções..." : "Generating motions..."}
              </span>
            </div>
          )}

          {!loading && motions.map((motion, i) => (
            <div key={i} onClick={() => generateArguments(motion)} style={{
              padding: "14px 16px",
              border: "0.5px solid #ddd",
              borderRadius: 10,
              marginBottom: 10,
              cursor: "pointer",
              background: "#fff",
              transition: "border-color 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#1D9E75"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#ddd"}
            >
              <div style={{ fontSize: 11, color: "#1D9E75", fontWeight: 600, marginBottom: 4 }}>
                {isPt ? `MOÇÃO ${i + 1}` : `MOTION ${i + 1}`}
              </div>
              <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.5 }}>{motion}</div>
            </div>
          ))}

          {error && <p style={{ fontSize: 13, color: "#cc0000" }}>{error}</p>}
        </>
      )}

      {/* STEP 3 — Arguments */}
      {step === STEP.ARGUMENTS && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <button onClick={() => { setStep(STEP.MOTIONS); setArgs(null); }} style={backBtnStyle}>
              ← {isPt ? "Voltar" : "Back"}
            </button>
          </div>

          {/* Selected motion */}
          <div style={{
            padding: "14px 16px", background: "#f9f9f8",
            border: "0.5px solid #e0ddd6", borderRadius: 10, marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, color: "#888", fontWeight: 600, marginBottom: 4 }}>
              {isPt ? "MOÇÃO SELECIONADA" : "SELECTED MOTION"}
            </div>
            <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.5 }}>{selectedMotion}</div>
          </div>

          {loading && (
            <div style={loadingStyle}>
              <div style={spinnerStyle} />
              <span style={{ fontSize: 13, color: "#888" }}>
                {isPt ? "Elaborando argumentos..." : "Elaborating arguments..."}
              </span>
            </div>
          )}

          {!loading && args && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* A favor */}
              <div style={{ padding: 18, background: "#E1F5EE", border: "0.5px solid #1D9E75", borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0F6E56", marginBottom: 10, letterSpacing: "0.05em" }}>
                  {isPt ? "✓ A FAVOR" : "✓ IN FAVOR"}
                </div>
                <p style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.7, margin: 0 }}>{args.favor}</p>
              </div>
              {/* Contra */}
              <div style={{ padding: 18, background: "#FCEBEB", border: "0.5px solid #E24B4A", borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A32D2D", marginBottom: 10, letterSpacing: "0.05em" }}>
                  {isPt ? "✗ CONTRA" : "✗ AGAINST"}
                </div>
                <p style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.7, margin: 0 }}>{args.contra}</p>
              </div>
            </div>
          )}

          {!loading && args && (
            <button onClick={reset} style={{
              marginTop: 20, padding: "8px 20px", fontSize: 13,
              background: "#fff", border: "0.5px solid #ddd",
              borderRadius: 8, cursor: "pointer", color: "#555",
            }}>
              {isPt ? "Gerar nova moção" : "Generate new motion"}
            </button>
          )}

          {error && <p style={{ fontSize: 13, color: "#cc0000" }}>{error}</p>}
        </>
      )}
    </div>
  );
}

const backBtnStyle = {
  padding: "5px 12px", fontSize: 12,
  border: "0.5px solid #ddd", borderRadius: 6,
  background: "#fff", cursor: "pointer", color: "#555",
};

const loadingStyle = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "20px 0",
};

const spinnerStyle = {
  width: 16, height: 16,
  border: "2px solid #e0ddd6",
  borderTop: "2px solid #1D9E75",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};
