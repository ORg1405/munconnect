import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildJudgePrompt,
  buildOpponentPrompt,
  buildReportPrompt,
  buildSummaryPrompt,
  loadDossier,
  selectWindow,
  shouldUpdateSummary,
  type DebateSetup,
  type TurnRecord,
} from "../src/context.js";
import { JUDGE_SYSTEM } from "../src/prompts/judge.js";
import { OPPONENT_SYSTEM } from "../src/prompts/opponent.js";
import { placeholdersOf, render } from "../src/prompts/template.js";

const setup: DebateSetup = {
  committeeName: "Comitê Teste",
  topic: "Tópico Teste",
  userCountry: { code2: "AA", name: "Delegação A" },
  aiDelegation: { code2: "BB", name: "Delegação B" },
  difficulty: "intermediate",
  nivelDelegado: "Não informado",
  simsAnteriores: null,
};

const turns = (from: number, to: number): TurnRecord[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    index: from + i,
    userText: `fala-aluno-${from + i}`,
    opponentText: `replica-${from + i}`,
  }));

const WINDOW = { windowTurns: 4, maxWindowTurns: 7 };

describe("selectWindow (janela + resumo)", () => {
  it("vazio no primeiro turno", () => {
    expect(selectWindow([], 0, WINDOW)).toEqual([]);
  });

  it("menos de 4 turnos: manda todos", () => {
    expect(selectWindow(turns(1, 2), 0, WINDOW).map((t) => t.index)).toEqual([1, 2]);
  });

  it("resumo em dia: só os últimos 4", () => {
    // 9 turnos concluídos, resumo cobre 1..9 → janela 6..9.
    expect(selectWindow(turns(3, 9), 9, WINDOW).map((t) => t.index)).toEqual([6, 7, 8, 9]);
    // resumo cobre 1..6 → turnos 7..9 não resumidos já estão na janela 6..9.
    expect(selectWindow(turns(3, 9), 6, WINDOW).map((t) => t.index)).toEqual([6, 7, 8, 9]);
  });

  it("resumo atrasado: a janela recua para cobrir os turnos não resumidos", () => {
    // resumo cobre só 1..3, último turno 9 → precisa de 4..9 (6 turnos ≤ teto 7).
    expect(selectWindow(turns(3, 9), 3, WINDOW).map((t) => t.index)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("a janela nunca passa do teto", () => {
    // sem resumo nenhum e 11 turnos → teto de 7: 5..11.
    expect(selectWindow(turns(1, 11), 0, WINDOW).map((t) => t.index)).toEqual([5, 6, 7, 8, 9, 10, 11]);
  });

  it("aceita entrada fora de ordem", () => {
    expect(selectWindow(turns(1, 5).reverse(), 0, WINDOW).map((t) => t.index)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("shouldUpdateSummary", () => {
  it("a cada 3 turnos", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 9, 12].filter((i) => shouldUpdateSummary(i, 3))).toEqual([3, 6, 9, 12]);
    expect(shouldUpdateSummary(0, 3)).toBe(false);
  });
});

describe("prompts", () => {
  it("prefixo fixo do oponente/juiz só tem {{dossie}} (estável para cache)", () => {
    expect(placeholdersOf(OPPONENT_SYSTEM)).toEqual(["dossie"]);
    expect(placeholdersOf(JUDGE_SYSTEM)).toEqual(["dossie"]);
  });

  it("system instruction do oponente é idêntica entre debates/turnos diferentes do mesmo comitê", () => {
    const a = buildOpponentPrompt({ dossier: "D", setup, summary: "s1", window: turns(1, 2), userText: "x", locale: "pt-BR" });
    const b = buildOpponentPrompt({
      dossier: "D",
      setup: { ...setup, userCountry: { code2: "CC", name: "Outra" } },
      summary: "s2",
      window: turns(5, 8),
      userText: "y",
      locale: "en",
    });
    expect(a.systemInstruction).toBe(b.systemInstruction);
    expect(a.systemInstruction).toContain("D");
  });

  it("parte variável traz resumo, janela e fala atual, com a fala no fim", () => {
    const p = buildOpponentPrompt({ dossier: "D", setup, summary: "RESUMO-X", window: turns(6, 9), userText: "FALA-ATUAL", locale: "pt-BR" });
    expect(p.userContent).toContain("RESUMO-X");
    expect(p.userContent).toContain("fala-aluno-6");
    expect(p.userContent).toContain("replica-9");
    expect(p.userContent).not.toContain("fala-aluno-5");
    expect(p.userContent.trimEnd().endsWith("FALA-ATUAL\n</fala_do_delegado>")).toBe(true);
    expect(p.userContent.indexOf("RESUMO-X")).toBeLessThan(p.userContent.indexOf("fala-aluno-6"));
    expect(p.userContent).not.toMatch(/\{\{\w+\}\}/);
  });

  it("sem resumo, usa um aviso em vez de deixar vazio", () => {
    const p = buildOpponentPrompt({ dossier: "D", setup, summary: "", window: [], userText: "x", locale: "pt-BR" });
    expect(p.userContent).toContain("ainda não há resumo");
    expect(p.userContent).toContain("nenhum turno anterior");
  });

  it("idioma segue o locale", () => {
    expect(buildOpponentPrompt({ dossier: "D", setup, summary: "", window: [], userText: "x", locale: "en" }).userContent).toContain("English");
  });

  it("juiz, resumo e relatório renderizam sem placeholders sobrando", () => {
    const j = buildJudgePrompt({ dossier: "D", setup, summary: "", turn: turns(1, 1)[0], locale: "pt-BR" });
    const s = buildSummaryPrompt({ setup, previousSummary: "", newTurns: turns(1, 3) });
    const r = buildReportPrompt({ dossier: "D", setup, turns: turns(1, 4) });
    for (const p of [j, s, r]) {
      expect(p.systemInstruction).not.toMatch(/\{\{\w+\}\}/);
      expect(p.userContent).not.toMatch(/\{\{\w+\}\}/);
    }
    expect(r.userContent).toContain("Delegação Delegação A: fala-aluno-1");
    expect(r.systemInstruction).toContain("Simulações anteriores: Não informado");
  });

  it("render falha alto com placeholder sem valor", () => {
    expect(() => render("a {{x}} b", {})).toThrow(/x/);
  });
});

describe("loadDossier", () => {
  it("carrega o dossiê do comitê sem os comentários HTML", () => {
    const text = loadDossier("SOLIDARNOSC");
    expect(text).toContain("PLACEHOLDER");
    expect(text).not.toContain("<!--");
  });

  it("comitê sem arquivo (ou id malicioso) cai no _default.md", () => {
    const dir = mkdtempSync(join(tmpdir(), "dossie-"));
    writeFileSync(join(dir, "_default.md"), "PADRAO");
    writeFileSync(join(dir, "X.md"), "<!-- nota -->\nDOSSIE X");
    expect(loadDossier("X", dir)).toBe("DOSSIE X");
    expect(loadDossier("NAO_EXISTE", dir)).toBe("PADRAO");
    expect(loadDossier("../../etc/passwd", dir)).toBe("PADRAO");
  });
});
