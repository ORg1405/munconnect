import { describe, expect, it } from "vitest";
import { QUOTA } from "../../functions/src/config";
import { findCommitteeById } from "../data/munCommittees";
import {
  MIN_USER_TURNS_FOR_REPORT,
  QUOTA_LIMITS,
  QUOTA_TIME_ZONE,
  blocDebateSetup,
  canEndDebate,
  formatDuration,
  formatResetTime,
  isBlocCommittee,
  opposingBloc,
  quotaMessage,
  reportErrorMessage,
  turnErrorMessage,
} from "./debateUi";

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

describe("cota: mensagens e horário de reset", () => {
  // 18:00 em Brasília (UTC−3, sem horário de verão).
  const now = new Date("2026-10-18T21:00:00Z");

  it("limites iguais aos do backend", () => {
    expect(QUOTA_LIMITS).toEqual({
      debatesPerDay: QUOTA.debatesPerDay,
      turnsPerDebate: QUOTA.turnsPerDebate,
      minSecondsBetweenTurns: QUOTA.minSecondsBetweenTurns,
    });
    expect(QUOTA_TIME_ZONE).toBe(QUOTA.timeZone);
  });

  it("formatDuration arredonda para cima", () => {
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(19_200)).toBe("20 s");
    expect(formatDuration(61_000)).toBe("2 min");
    expect(formatDuration(6 * 3600_000)).toBe("6 h");
    expect(formatDuration(3 * 3600_000 + 5 * 60_000)).toBe("3 h 5 min");
    expect(formatDuration(-5000)).toBe("0 s");
  });

  it("formatResetTime: meia-noite e horário no fuso de Brasília", () => {
    expect(formatResetTime(new Date("2026-10-19T03:00:00Z"), now)).toBe("à meia-noite (horário de Brasília), daqui a 6 h");
    expect(formatResetTime("2026-10-18T21:20:00Z", now)).toBe("às 18:20 (horário de Brasília), daqui a 20 min");
    expect(formatResetTime("data inválida", now)).toBe("");
  });

  it("uma mensagem clara por motivo de cota", () => {
    expect(quotaMessage({ reason: "daily-debates", resetsAt: "2026-10-19T03:00:00Z" }, now)).toBe(
      "Você já usou seus 3 debates de hoje. Sua cota renova à meia-noite (horário de Brasília), daqui a 6 h.",
    );
    expect(quotaMessage({ reason: "debate-turns" }, now)).toMatch(/limite de 12 falas/);
    expect(quotaMessage({ reason: "cooldown", resetsAt: "2026-10-18T21:00:14Z" }, now)).toMatch(/em 14 s/);
    expect(quotaMessage({ reason: "cooldown", resetsAt: "2026-10-18T20:59:00Z" }, now)).toMatch(/já pode enviar/);
    expect(quotaMessage({ reason: "cooldown", retryAfterSeconds: 7 }, now)).toMatch(/em 7 s/);
    expect(quotaMessage({ reason: "turn-in-progress" }, now)).toMatch(/ainda está respondendo/);
    expect(quotaMessage({ reason: "model-busy" }, now)).toBeNull();
  });

  it("erros técnicos nunca aparecem para o aluno", () => {
    const technical = { code: "internal", reason: "internal", message: "FirebaseError: INTERNAL 13 stack" };
    expect(turnErrorMessage(technical, now)).toEqual({ tone: "busy", message: expect.stringMatching(/formulando a resposta/) });
    expect(turnErrorMessage({ code: "unavailable", reason: "model-busy" }, now).tone).toBe("busy");
    expect(turnErrorMessage({ code: "deadline-exceeded" }, now).tone).toBe("busy");
    expect(turnErrorMessage({ code: "resource-exhausted", reason: "daily-debates" }, now).tone).toBe("quota");
    expect(turnErrorMessage({ code: "failed-precondition", reason: "blocked" }, now).tone).toBe("blocked");
    expect(turnErrorMessage({ code: "invalid-argument", message: "Campo muito longo: userText" }, now).message).not.toMatch(/userText/);
  });
});
