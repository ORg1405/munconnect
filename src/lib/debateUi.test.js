import { describe, expect, it } from "vitest";
import { QUOTA } from "../../functions/src/config";
import { findCommitteeById } from "../data/munCommittees";
import { MIN_USER_TURNS_FOR_REPORT, blocDebateSetup, canEndDebate, isBlocCommittee, opposingBloc, reportErrorMessage } from "./debateUi";

const tpi = findCommitteeById("TPI");
const [acusacao, defesa] = tpi.blocs;

describe("comitês de blocos", () => {
  it("TPI é comitê de blocos; os demais não", () => {
    expect(isBlocCommittee(tpi)).toBe(true);
    expect(isBlocCommittee(findCommitteeById("UNSC"))).toBe(false);
  });

  it("o oponente fica sempre com o bloco oposto", () => {
    expect(opposingBloc(tpi, acusacao)).toEqual(defesa);
    expect(opposingBloc(tpi, defesa)).toEqual(acusacao);
  });

  it("monta o setup do debateTurn com os dois blocos", () => {
    const setup = blocDebateSetup({
      committee: tpi,
      userBloc: defesa,
      topic: tpi.topics[1],
      difficulty: "advanced",
      nivelDelegado: "Não informado",
      simsAnteriores: null,
    });
    expect(setup).toEqual({
      committeeName: "TPI: O Julgamento de Benjamin Netanyahu",
      topic: "Fome como método de guerra",
      userCountry: { code2: "DEF", name: "Bloco da Defesa" },
      aiDelegation: { code2: "ACUS", name: "Bloco da Acusação" },
      difficulty: "advanced",
      nivelDelegado: "Não informado",
      simsAnteriores: null,
    });
  });
});

describe("encerrar o debate (regra das 4 falas)", () => {
  it("só libera com 4 ou mais falas do aluno", () => {
    expect([0, 1, 3].map(canEndDebate)).toEqual([false, false, false]);
    expect([4, 5, 12].map(canEndDebate)).toEqual([true, true, true]);
  });

  it("o mínimo é o mesmo do backend (QUOTA.minUserTurnsForReport)", () => {
    expect(MIN_USER_TURNS_FOR_REPORT).toBe(QUOTA.minUserTurnsForReport);
  });

  it("valores inválidos não liberam", () => {
    expect(canEndDebate(undefined)).toBe(false);
    expect(canEndDebate(4.5)).toBe(false);
    expect(canEndDebate("4")).toBe(false);
  });

  it("mensagens de erro do relatório sem detalhe técnico", () => {
    expect(reportErrorMessage({ reason: "too-few-turns" })).toMatch(/pelo menos 4 falas/);
    expect(reportErrorMessage({ reason: "stale" })).toMatch(/Tente de novo/);
    expect(reportErrorMessage({ code: "internal", message: "Error: 13 INTERNAL" })).not.toMatch(/INTERNAL/);
    expect(reportErrorMessage(null)).toMatch(/Tente de novo/);
  });
});
