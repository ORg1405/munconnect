import { describe, expect, it } from "vitest";
import { QUOTA } from "../src/config.js";
import { checkTurnQuota, type TurnQuotaInput } from "../src/quota.js";
import { dayKey, formatDuration, nextMidnight } from "../src/time.js";

// 2026-11-10 15:00 em São Paulo (UTC-3) = 18:00 UTC.
const NOW = new Date("2026-11-10T18:00:00Z");

function input(over: Partial<TurnQuotaInput> = {}): TurnQuotaInput {
  return {
    now: NOW,
    isNewDebate: false,
    debatesToday: 1,
    userLastTurnAt: null,
    debateTurnCount: 3,
    debatePendingTurnAt: null,
    ...over,
  };
}

describe("checkTurnQuota", () => {
  it("libera um turno normal e calcula o restante", () => {
    const d = checkTurnQuota(input());
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.turnIndex).toBe(4);
    expect(d.remaining.turnsLeftInDebate).toBe(QUOTA.turnsPerDebate - 4);
    expect(d.remaining.debatesLeftToday).toBe(QUOTA.debatesPerDay - 1);
    expect(d.remaining.nextTurnAvailableAt).toBe(new Date(NOW.getTime() + QUOTA.minSecondsBetweenTurns * 1000).toISOString());
  });

  it("debate novo consome um debate do dia e começa no turno 1", () => {
    const d = checkTurnQuota(input({ isNewDebate: true, debatesToday: 2, debateTurnCount: 0 }));
    expect(d.ok && d.turnIndex).toBe(1);
    expect(d.ok && d.remaining.debatesLeftToday).toBe(0);
  });

  it("bloqueia o 4º debate do dia e informa a renovação à meia-noite de Brasília", () => {
    const d = checkTurnQuota(input({ isNewDebate: true, debatesToday: QUOTA.debatesPerDay, debateTurnCount: 0 }));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.violation.reason).toBe("daily-debates");
    // Meia-noite de 11/11 em São Paulo = 03:00 UTC.
    expect(d.violation.resetsAt).toBe("2026-11-11T03:00:00.000Z");
    expect(d.violation.message).toContain("horário de Brasília");
    expect(d.violation.message).toContain("9h");
  });

  it("debate existente continua mesmo com a cota diária de debates esgotada", () => {
    const d = checkTurnQuota(input({ debatesToday: QUOTA.debatesPerDay }));
    expect(d.ok).toBe(true);
  });

  it("bloqueia o 13º turno", () => {
    const d = checkTurnQuota(input({ debateTurnCount: QUOTA.turnsPerDebate }));
    expect(!d.ok && d.violation.reason).toBe("debate-turns");
  });

  it("aplica o intervalo mínimo entre turnos com tempo de espera", () => {
    const d = checkTurnQuota(input({ userLastTurnAt: new Date(NOW.getTime() - 12_000) }));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.violation.reason).toBe("cooldown");
    expect(d.violation.retryAfterSeconds).toBe(QUOTA.minSecondsBetweenTurns - 12);
  });

  it("libera exatamente no fim do intervalo", () => {
    const d = checkTurnQuota(input({ userLastTurnAt: new Date(NOW.getTime() - QUOTA.minSecondsBetweenTurns * 1000) }));
    expect(d.ok).toBe(true);
  });

  it("recusa turno enquanto outro está em andamento, mas ignora trava expirada", () => {
    const busy = checkTurnQuota(input({ debatePendingTurnAt: new Date(NOW.getTime() - 5_000) }));
    expect(!busy.ok && busy.violation.reason).toBe("turn-in-progress");
    const stale = checkTurnQuota(input({ debatePendingTurnAt: new Date(NOW.getTime() - (QUOTA.turnLockSeconds + 1) * 1000) }));
    expect(stale.ok).toBe(true);
  });

  it("respeita uma configuração de cota customizada", () => {
    const d = checkTurnQuota(input({ isNewDebate: true, debatesToday: 1, quota: { ...QUOTA, debatesPerDay: 1 } }));
    expect(!d.ok && d.violation.reason).toBe("daily-debates");
  });
});

describe("helpers de tempo", () => {
  it("dayKey usa o fuso de São Paulo, não UTC", () => {
    // 01:30 UTC de 11/11 ainda é 22:30 de 10/11 em São Paulo.
    expect(dayKey(new Date("2026-11-11T01:30:00Z"), "America/Sao_Paulo")).toBe("2026-11-10");
    expect(dayKey(new Date("2026-11-11T03:00:00Z"), "America/Sao_Paulo")).toBe("2026-11-11");
  });

  it("nextMidnight cruza virada de mês", () => {
    expect(nextMidnight(new Date("2026-11-30T20:00:00Z"), "America/Sao_Paulo").toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("formatDuration", () => {
    expect(formatDuration(30_000)).toBe("30s");
    expect(formatDuration(45 * 60_000)).toBe("45min");
    expect(formatDuration(9 * 3600_000)).toBe("9h");
    expect(formatDuration(3 * 3600_000 + 12 * 60_000)).toBe("3h 12min");
  });
});
