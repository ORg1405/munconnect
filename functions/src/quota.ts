// Regras de cota por usuário — funções PURAS (sem Firestore), usadas dentro da
// transação em store.ts e testadas isoladamente em test/quota.test.ts.

import { QUOTA } from "./config.js";
import { formatDuration, nextMidnight } from "./time.js";

export interface QuotaConfig {
  debatesPerDay: number;
  turnsPerDebate: number;
  minSecondsBetweenTurns: number;
  timeZone: string;
  timeZoneLabel: string;
  turnLockSeconds: number;
}

export type QuotaReason = "daily-debates" | "debate-turns" | "cooldown" | "turn-in-progress";

export interface QuotaViolation {
  reason: QuotaReason;
  message: string;
  resetsAt: string | null; // ISO — quando a cota renova / o bloqueio acaba
  retryAfterSeconds: number | null;
}

export interface QuotaRemaining {
  debatesLeftToday: number;
  turnsLeftInDebate: number;
  nextTurnAvailableAt: string; // ISO
  dailyResetAt: string; // ISO
}

export interface TurnQuotaInput {
  now: Date;
  isNewDebate: boolean;
  debatesToday: number;
  userLastTurnAt: Date | null;
  debateTurnCount: number; // turnos já reservados neste debate (0 se novo)
  debatePendingTurnAt: Date | null; // trava de turno em andamento
  quota?: QuotaConfig;
}

export type TurnQuotaDecision =
  | { ok: true; turnIndex: number; remaining: QuotaRemaining }
  | { ok: false; violation: QuotaViolation };

export function checkTurnQuota(input: TurnQuotaInput): TurnQuotaDecision {
  const q = input.quota ?? QUOTA;
  const now = input.now;
  const dailyReset = nextMidnight(now, q.timeZone);

  if (input.debatePendingTurnAt && now.getTime() - input.debatePendingTurnAt.getTime() < q.turnLockSeconds * 1000) {
    return {
      ok: false,
      violation: {
        reason: "turn-in-progress",
        message: "A delegação ainda está respondendo à sua fala anterior. Aguarde a resposta antes de enviar outra.",
        resetsAt: null,
        retryAfterSeconds: 5,
      },
    };
  }

  if (input.isNewDebate && input.debatesToday >= q.debatesPerDay) {
    return {
      ok: false,
      violation: {
        reason: "daily-debates",
        message:
          `Você já usou seus ${q.debatesPerDay} debates de hoje. ` +
          `Sua cota renova à meia-noite (${q.timeZoneLabel}), daqui a ${formatDuration(dailyReset.getTime() - now.getTime())}.`,
        resetsAt: dailyReset.toISOString(),
        retryAfterSeconds: Math.ceil((dailyReset.getTime() - now.getTime()) / 1000),
      },
    };
  }

  if (!input.isNewDebate && input.debateTurnCount >= q.turnsPerDebate) {
    return {
      ok: false,
      violation: {
        reason: "debate-turns",
        message:
          `Este debate chegou ao limite de ${q.turnsPerDebate} falas. ` +
          "Encerre a sessão para receber seu relatório ou comece um novo debate.",
        resetsAt: null,
        retryAfterSeconds: null,
      },
    };
  }

  if (input.userLastTurnAt) {
    const readyAt = input.userLastTurnAt.getTime() + q.minSecondsBetweenTurns * 1000;
    if (now.getTime() < readyAt) {
      const wait = Math.ceil((readyAt - now.getTime()) / 1000);
      return {
        ok: false,
        violation: {
          reason: "cooldown",
          message: `Respire e prepare o próximo argumento: você poderá falar de novo em ${wait}s.`,
          resetsAt: new Date(readyAt).toISOString(),
          retryAfterSeconds: wait,
        },
      };
    }
  }

  const turnIndex = input.debateTurnCount + 1;
  return {
    ok: true,
    turnIndex,
    remaining: {
      debatesLeftToday: q.debatesPerDay - input.debatesToday - (input.isNewDebate ? 1 : 0),
      turnsLeftInDebate: q.turnsPerDebate - turnIndex,
      nextTurnAvailableAt: new Date(now.getTime() + q.minSecondsBetweenTurns * 1000).toISOString(),
      dailyResetAt: dailyReset.toISOString(),
    },
  };
}
