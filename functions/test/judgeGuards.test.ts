import { describe, expect, it, vi } from "vitest";

const warn = vi.fn();
vi.mock("firebase-functions", () => ({ logger: { warn, info: vi.fn(), error: vi.fn() } }));

const { applyJudgeGuards, citesSpecificSource, normalizeForMatch, parseTurnAnalysis, quoteAppearsIn } = await import("../src/judgeGuards.js");
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

describe("guardas da 2ª rodada", () => {
  it("citesSpecificSource: artigo, regra, resolução ou decisão nominal (heurística)", () => {
    expect(citesSpecificSource("Pelo art. 12 do Estatuto, a Corte é competente.")).toBe(true);
    expect(citesSpecificSource("O artigo 8(2)(b)(xxv) tipifica a fome.")).toBe(true);
    expect(citesSpecificSource("Conforme a regra 20 do estudo do CICV.")).toBe(true);
    expect(citesSpecificSource("A Resolução nº 2334 do Conselho.")).toBe(true);
    expect(citesSpecificSource("A decisão de 21/11/2024 rejeitou o desafio.")).toBe(true);
    expect(citesSpecificSource("Como no caso Bemba, a responsabilidade de comando exige controle.")).toBe(true);
    expect(citesSpecificSource("A Câmara de Instrução Prévia I rejeitou o desafio.")).toBe(true);
    expect(citesSpecificSource("A Palestina aderiu ao Estatuto de Roma em 2015, então a Corte é competente.")).toBe(false);
    expect(citesSpecificSource("Se ele é corrupto, então o mandado se justifica.")).toBe(false);
    expect(citesSpecificSource("Isso é parte do problema.")).toBe(false);
  });

  it("sem fonte específica, notas acima de 3 viram 3; com fonte, ficam", () => {
    const rubrica = { estrutura: 4, logica: 5, evidencia: 3, refutacao: 4, persuasao: 2, adequacao_comite: 4 };
    const semFonte = applyJudgeGuards(analysis({ rubrica }), { ...ctx, userText: "A Corte é competente porque a Palestina aderiu em 2015." });
    expect(semFonte.analysis.rubrica).toEqual({ estrutura: 3, logica: 3, evidencia: 3, refutacao: 3, persuasao: 2, adequacao_comite: 3 });
    expect(semFonte.report).toMatchObject({ citesSource: false, scoresCapped: 4 });
    const comFonte = applyJudgeGuards(analysis({ rubrica }), { ...ctx, userText: "Pelo art. 12, a Corte é competente." });
    expect(comFonte.analysis.rubrica).toEqual(rubrica);
    expect(comFonte.report).toMatchObject({ citesSource: true, scoresCapped: 0 });
  });

  it("limite de nota convive com refutacao null no turno 1", () => {
    const r = applyJudgeGuards(analysis({ rubrica: { estrutura: 5, logica: 4, evidencia: 4, refutacao: 4, persuasao: 4, adequacao_comite: 4 } }), {
      ...ctx,
      turnIndex: 1,
      userText: "sem fonte",
    });
    expect(r.analysis.rubrica.refutacao).toBeNull();
    expect(r.analysis.rubrica.estrutura).toBe(3);
  });

  it('falácia "outra" fica no máximo em "possivel"; outros tipos mantêm a confiança', () => {
    const outra = { ...fallacy("Se ele é corrupto, não dá para confiar"), tipo: "outra" as const };
    const r = applyJudgeGuards(
      analysis({ falacias: [outra, { ...outra, confianca: "possivel" }, fallacy("Se ele é corrupto, não dá para confiar")] }),
      ctx,
    );
    expect(r.analysis.falacias.map((f) => f.confianca)).toEqual(["possivel", "possivel", "alta"]);
    expect(r.report.otherFallacyDowngraded).toBe(1);
  });
});
