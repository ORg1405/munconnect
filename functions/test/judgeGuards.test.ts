import { describe, expect, it, vi } from "vitest";

const warn = vi.fn();
vi.mock("firebase-functions", () => ({ logger: { warn, info: vi.fn(), error: vi.fn() } }));

const { applyJudgeGuards, normalizeForMatch, parseTurnAnalysis, quoteAppearsIn } = await import("../src/judgeGuards.js");
type TurnAnalysis = import("../src/schemas/turnAnalysis.js").TurnAnalysis;

const userText = "Netanyahu responde por corrupção em Israel. Se ele é corrupto, não dá para confiar em nada do que seu governo diz sobre Gaza.";
const opponentText = "A Defesa sustenta que o argumento não trata do ponto em discussão. Como a Acusação prova o dolo?";

function analysis(over: Partial<TurnAnalysis> = {}): TurnAnalysis {
  return {
    turno: 2,
    argumento_estudante: {
      alegacao: "a",
      dados: [],
      garantia: "g",
      premissas: [],
    },
    premissas_oponente: [],
    falacias: [],
    rubrica: { estrutura: 2, logica: 1, evidencia: 1, refutacao: 1, persuasao: 1, adequacao_comite: 0 },
    pontos_fortes: [],
    melhorias_prioritarias: [],
    sugestao_de_replica: "",
    ...over,
  };
}

const ctx = { turnIndex: 2, userText, opponentText, debateId: "d1" };
const fallacy = (trecho: string, lado: "estudante" | "oponente" = "estudante") =>
  ({ lado, tipo: "ataque_pessoal", trecho, confianca: "alta", explicacao: "e" }) as const;
const premise = (tipo: "fatual" | "valor" | "inferencial" | "implicita", status: "sustentada" | "fraca" | "falsa" | "nao_verificavel", evidencia_dossie?: string) =>
  ({ texto: "p", tipo, status, comentario: "c", ...(evidencia_dossie === undefined ? {} : { evidencia_dossie }) });

describe("normalização do trecho", () => {
  it("ignora maiúsculas, pontuação e espaços", () => {
    expect(normalizeForMatch("  Se ELE é corrupto,   não dá!  ")).toBe("se ele é corrupto não dá");
    expect(quoteAppearsIn("se ele é CORRUPTO não dá para confiar", userText)).toBe(true);
    expect(quoteAppearsIn("“Netanyahu responde por corrupção”", userText)).toBe(true);
  });

  it("aceita reticências entre pedaços na ordem certa", () => {
    expect(quoteAppearsIn("Netanyahu responde... sobre Gaza", userText)).toBe(true);
    expect(quoteAppearsIn("sobre Gaza… Netanyahu responde", userText)).toBe(false);
  });

  it("trecho inexistente ou vazio não casa", () => {
    expect(quoteAppearsIn("o Hamas desvia ajuda", userText)).toBe(false);
    expect(quoteAppearsIn("", userText)).toBe(false);
  });
});

describe("applyJudgeGuards", () => {
  it("descarta falácia com trecho fora das duas falas e registra judge_trecho_invalido", () => {
    warn.mockClear();
    const { analysis: a, report } = applyJudgeGuards(
      analysis({
        falacias: [fallacy("Se ele é corrupto, não dá para confiar"), fallacy("argumento não trata do ponto", "oponente"), fallacy("menciona o caso Bemba", "oponente")],
      }),
      ctx,
    );
    expect(a.falacias.map((f) => f.trecho)).toEqual(["Se ele é corrupto, não dá para confiar", "argumento não trata do ponto"]);
    expect(report.fallaciesDropped).toBe(1);
    expect(warn).toHaveBeenCalledWith("judge_trecho_invalido", { debateId: "d1", turnIndex: 2, lado: "oponente", tipo: "ataque_pessoal" });
  });

  it("valor + falsa vira fraca; falsa sem evidencia_dossie vira nao_verificavel; falsa com evidência fica", () => {
    const { analysis: a, report } = applyJudgeGuards(
      analysis({
        argumento_estudante: {
          alegacao: "a",
          dados: [],
          garantia: "g",
          premissas: [premise("valor", "falsa", "trecho do dossiê"), premise("inferencial", "falsa"), premise("fatual", "falsa", "   "), premise("fatual", "falsa", "Israel nunca o ratificou"), premise("fatual", "sustentada")],
        },
      }),
      ctx,
    );
    expect(a.argumento_estudante.premissas.map((p) => p.status)).toEqual(["fraca", "nao_verificavel", "nao_verificavel", "falsa", "sustentada"]);
    expect(report).toMatchObject({ valueFalseToWeak: 1, falseWithoutEvidence: 2 });
  });

  it("turno 1: refutacao = null; turnos seguintes mantêm a nota", () => {
    expect(applyJudgeGuards(analysis(), { ...ctx, turnIndex: 1 }).analysis.rubrica.refutacao).toBeNull();
    expect(applyJudgeGuards(analysis(), ctx).analysis.rubrica.refutacao).toBe(1);
  });

  it("não altera a análise original", () => {
    const original = analysis({ falacias: [fallacy("inexistente")] });
    applyJudgeGuards(original, { ...ctx, turnIndex: 1 });
    expect(original.falacias).toHaveLength(1);
    expect(original.rubrica.refutacao).toBe(1);
  });
});

describe("parseTurnAnalysis", () => {
  it("aceita a análise completa e recusa JSON truncado ou incompleto", () => {
    expect(parseTurnAnalysis(JSON.stringify(analysis())).turno).toBe(2);
    expect(() => parseTurnAnalysis('{"turno": 1, "argu')).toThrow();
    expect(() => parseTurnAnalysis('{"turno": 1}')).toThrow(/argumento_estudante/);
  });
});
