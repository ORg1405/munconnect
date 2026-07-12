// Vercel serverless function — proxies Claude API for the Debate Trainer.
// Frontend NEVER sees the key. Set ANTHROPIC_API_KEY in Vercel env vars.
//
// POST /api/debate
//   { mode: "suggest", userCountry, committee, topic }
//     → { delegations: [{ code2, name, rationale }, ...] }
//
//   { mode: "reply", userCountry, committee, topic, aiDelegation, difficulty, history }
//     → { delegation, text }   // delegation = { code2, name }
//
// history = [{ role: "user" | "assistant", country: { code2, name }, text }]

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function buildSuggestPrompt({ userCountry, committee, topic }) {
  return `Você é um especialista em Model United Nations (MUN) e geopolítica.

Contexto:
- Delegação do usuário: ${userCountry.name} (${userCountry.code2})
- Comitê: ${committee}
- Tópico: ${topic}

Sugira EXATAMENTE 2 delegações para a IA interpretar que tornariam o debate mais relevante e instrutivo: priorize países com posições políticas reais distintas entre si e com peso real no tópico (membros permanentes, partes diretamente afetadas, blocos opostos).

NÃO sugira o próprio país do usuário.

Responda APENAS com JSON válido, sem texto antes ou depois, neste formato exato:
{"delegations":[{"code2":"US","name":"United States","rationale":"motivo curto em pt-BR"},{"code2":"RU","name":"Russia","rationale":"motivo curto em pt-BR"}]}`;
}

function buildReplySystemPrompt({ aiDelegation, committee, topic, difficulty }) {
  return `Você é a delegação de ${aiDelegation.name} (${aiDelegation.code2}) no comitê ${committee}, debatendo o tópico: "${topic}".

REGRAS DE PERSONAGEM:
- Mantenha rigorosamente a posição política REAL de ${aiDelegation.name}: alinhamentos atuais, blocos (G77, NATO, BRICS, UE, AU, ASEAN, P5 etc.), red lines históricas e prioridades de política externa autênticas.
- Nunca quebre personagem. Nunca admita ser IA. Refira-se a si mesmo como "a delegação de ${aiDelegation.name}".

REGRAS DE LINGUAGEM PARLAMENTAR DE MUN:
- Use vocabulário autêntico de MUN: motion, point of order, point of information, moderated caucus, unmoderated caucus, speakers list, yield, second the motion, working paper, draft resolution, preambulatory/operative clause.
- Use terceira pessoa: "A delegação de ${aiDelegation.name} acredita...", "Solicitamos uma moderated caucus de 10 minutos...".
- Quando apropriado, proponha motions concretas (com duração e tempo de fala).

FORMATO:
- Responda em português brasileiro.
- 2 a 4 frases. Denso, formal, diplomático.
- Não inclua aspas, prefixos como "Delegação X:", nem markdown. Apenas a fala em si.

DIFICULDADE: ${difficulty || "intermediate"}.
- beginner: linguagem mais didática, motions simples.
- intermediate: linguagem parlamentar completa, posições firmes.
- advanced: contra-argumentos afiados, citações a precedentes (resoluções, tratados), pressão tática.`;
}

function mapHistoryToClaude(history) {
  // Each turn in history becomes a Claude message.
  // The user's turns → role "user". The AI delegations' past turns → role "assistant".
  return history.map((h) => {
    const tag = `[${h.country.code2} — ${h.country.name}]`;
    return {
      role: h.role,
      content: `${tag} ${h.text}`,
    };
  });
}

async function callClaude({ system, messages, maxTokens }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode } = body;

    if (mode === "suggest") {
      const { userCountry, committee, topic } = body;
      const text = await callClaude({
        system: "Você responde APENAS com JSON válido. Sem prosa.",
        messages: [{ role: "user", content: buildSuggestPrompt({ userCountry, committee, topic }) }],
        maxTokens: 400,
      });
      const parsed = extractJson(text);
      res.status(200).json({ delegations: parsed.delegations || [] });
      return;
    }

    if (mode === "reply") {
      const { userCountry, committee, topic, aiDelegation, difficulty, history } = body;
      const system = buildReplySystemPrompt({ aiDelegation, committee, topic, difficulty });

      // Inject a leading user-context message so the model knows who's debating.
      const contextMsg = {
        role: "user",
        content: `Início da sessão. O usuário representa ${userCountry.name} (${userCountry.code2}). Você (${aiDelegation.name}) responde apenas às falas dele, mantendo personagem.`,
      };

      const messages = [contextMsg, ...mapHistoryToClaude(history)];

      const text = await callClaude({
        system,
        messages,
        maxTokens: 350,
      });

      res.status(200).json({
        delegation: { code2: aiDelegation.code2, name: aiDelegation.name },
        text: text.trim(),
      });
      return;
    }

    res.status(400).json({ error: `Unknown mode: ${mode}` });
  } catch (err) {
    console.error("[/api/debate] error:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}
