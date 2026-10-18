// Roda os MESMOS argumentos em vários cenários (modelo + thinkingLevel) no
// prompt do oponente e, com --judge, também no juiz (análise por turno), com
// tokens, latência, custo e truncamento — para decidir modelo/raciocínio.
//
// Uso (dentro de functions/):
//   npm run compare -- --file scripts/compare-args.example.json
//   npm run compare -- --file scripts/compare-args.tpi.json --judge \
//     --scenarios gemini-3.1-flash-lite:low,gemini-3.1-flash-lite:minimal,gemini-3.5-flash-lite:low
//   --out resultado.json grava tudo em JSON; --args 1,3 roda só esses argumentos;
//   --judge-max-tokens N troca o teto de saída do juiz (diagnóstico de truncamento).
//
// Chave: variável GEMINI_API_KEY ou, se ausente, functions/.secret.local
// (mesmo arquivo que o emulador usa). Faz chamadas REAIS (cobradas).
//
// Formato do arquivo:
//   { "committeeId": "TPI", "locale": "pt-BR",
//     "setup": { ...mesmo formato do debateTurn... },
//     "arguments": ["fala 1", { "text": "fala 2", "aluno": "Bloco da Defesa", "tema": "..." }, ...] }
// Em comitê de blocos, "aluno" escolhe o bloco do estudante e o oponente fica
// com o bloco contrário; "tema" substitui setup.topic (tema do ciclo).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTEXT, MODEL_IDS, ROLES, SAFETY_SETTINGS, type ThinkingLevel } from "../src/config.js";
import { buildJudgePrompt, buildOpponentPrompt, loadDossier, promptsFor, type DebateSetup } from "../src/context.js";
import { GeminiProvider } from "../src/llm/gemini.js";
import type { LLMResult } from "../src/llm/provider.js";
import { logPrefixTokensOnce } from "../src/prefixStats.js";
import { TURN_ANALYSIS_SCHEMA } from "../src/schemas/turnAnalysis.js";
import { estimateCostUsd } from "../src/telemetry.js";
import { parseSetup } from "../src/validation.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function apiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const file = join(import.meta.dirname, "..", ".secret.local");
  if (existsSync(file)) {
    const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith("GEMINI_API_KEY="));
    if (line) return line.slice("GEMINI_API_KEY=".length).trim().replace(/^"|"$/g, "");
  }
  throw new Error("Defina GEMINI_API_KEY ou crie functions/.secret.local");
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface Scenario {
  label: string;
  model: string;
  thinkingLevel: ThinkingLevel;
}

function parseScenarios(raw: string): Scenario[] {
  return raw.split(",").map((s) => {
    const [model, level = ROLES.opponent.thinkingLevel] = s.trim().split(":");
    if (!["minimal", "low", "medium", "high"].includes(level)) throw new Error(`thinkingLevel inválido em "${s}"`);
    return { label: `${model}:${level}`, model, thinkingLevel: level as ThinkingLevel };
  });
}

interface ArgSpec {
  text: string;
  aluno?: string;
  tema?: string;
}

interface Call {
  result: LLMResult | null;
  error: string | null;
  latencyMs: number;
  costUsd: number;
  truncated: boolean;
}

function setupFor(base: DebateSetup, a: ArgSpec, blocs: readonly [string, string] | undefined): DebateSetup {
  const setup = { ...base, topic: a.tema ?? base.topic };
  if (blocs && a.aluno) {
    const oponente = blocs.find((b) => b !== a.aluno)!;
    setup.userCountry = { code2: "ALUNO", name: a.aluno };
    setup.aiDelegation = { code2: "IA", name: oponente };
  }
  return setup;
}

async function main() {
  const file = arg("file") ?? join(import.meta.dirname, "compare-args.example.json");
  const scenarios = parseScenarios(arg("scenarios") ?? `${ROLES.opponent.model}:${ROLES.opponent.thinkingLevel},${MODEL_IDS.flash38}:low`);
  const withJudge = process.argv.includes("--judge");
  const out = arg("out");
  const judgeMaxTokens = arg("judge-max-tokens") ? Number(arg("judge-max-tokens")) : ROLES.turnAnalysis.maxOutputTokens;
  const only = arg("args")?.split(",").map(Number);

  const spec = JSON.parse(readFileSync(file, "utf8"));
  const committeeId: string = spec.committeeId;
  const locale: string = spec.locale ?? "pt-BR";
  const blocs = promptsFor(committeeId).blocs;
  const args: ArgSpec[] = (spec.arguments as Array<string | ArgSpec>).map((a) => (typeof a === "string" ? { text: a } : a));
  const baseSetup = parseSetup(spec.setup, committeeId);
  const dossier = loadDossier(committeeId);
  const provider = new GeminiProvider(apiKey());

  // Tamanho do prefixo fixo: mesmo log "prefix_tokens" das funções em produção.
  const sampleSetup = setupFor(baseSetup, args[0], blocs);
  const sampleTurn = { index: 1, userText: "x", opponentText: "y" };
  const opponentPrefix = buildOpponentPrompt({ committeeId, dossier, setup: sampleSetup, summary: "", window: [], userText: "x", locale }).systemInstruction;
  const judgePrefix = buildJudgePrompt({ committeeId, dossier, setup: sampleSetup, summary: "", turn: sampleTurn, locale }).systemInstruction;
  console.log(`\nComitê ${committeeId} · prefixo fixo (system + dossiê) — mínimo do cache implícito: ${CONTEXT.cachePrefixMinTokens} tokens`);
  for (const model of new Set(scenarios.map((s) => s.model))) {
    await logPrefixTokensOnce(provider, { role: "opponent", committeeId, model, systemInstruction: opponentPrefix });
    if (withJudge) await logPrefixTokensOnce(provider, { role: "turnAnalysis", committeeId, model, systemInstruction: judgePrefix });
  }

  const call = async (s: Scenario, prompt: { systemInstruction: string; userContent: string }, judge: boolean): Promise<Call> => {
    const role = judge ? ROLES.turnAnalysis : ROLES.opponent;
    // Alguns modelos não aceitam "minimal" (ex.: 3.8 Flash) — usa "low", como o router.
    const thinkingLevel = s.thinkingLevel === "minimal" && !s.model.includes("flash-lite") ? "low" : s.thinkingLevel;
    const t0 = Date.now();
    try {
      const result = await provider.generate({
        model: s.model,
        ...prompt,
        thinkingLevel,
        maxOutputTokens: judge ? judgeMaxTokens : role.maxOutputTokens,
        temperature: role.temperature,
        responseJsonSchema: judge ? (TURN_ANALYSIS_SCHEMA as unknown as Record<string, unknown>) : undefined,
        safetySettings: SAFETY_SETTINGS,
        timeoutMs: 120_000,
      });
      return {
        result,
        error: null,
        latencyMs: Date.now() - t0,
        costUsd: estimateCostUsd(s.model, result.usage, result.serviceTier),
        truncated: result.finishReason === "MAX_TOKENS",
      };
    } catch (e) {
      return { result: null, error: (e as Error).message.slice(0, 300), latencyMs: Date.now() - t0, costUsd: 0, truncated: false };
    }
  };

  const meta = (c: Call): string => {
    if (!c.result) return `ERRO após ${c.latencyMs} ms: ${c.error}`;
    const u = c.result.usage;
    return (
      `${c.latencyMs} ms · in ${u.inputTokens} (cache ${u.cachedTokens}) · out ${u.outputTokens} + raciocínio ${u.thoughtsTokens} · ` +
      `finish ${c.result.finishReason}${c.truncated ? " ⚠ TRUNCADA" : ""} · US$ ${c.costUsd.toFixed(6)}`
    );
  };

  const rule = "═".repeat(100);
  const records: unknown[] = [];
  const totals = new Map(scenarios.map((s) => [s.label, { opp: [] as Call[], judge: [] as Call[] }]));

  for (const [i, a] of args.entries()) {
    if (only && !only.includes(i + 1)) continue;
    const setup = setupFor(baseSetup, a, blocs);
    console.log(`\n${rule}\nArgumento ${i + 1} · estudante: ${setup.userCountry.name} · oponente: ${setup.aiDelegation.name} · tema: ${setup.topic}\n«${a.text}»`);
    for (const s of scenarios) {
      const opp = await call(s, buildOpponentPrompt({ committeeId, dossier, setup, summary: "", window: [], userText: a.text, locale }), false);
      totals.get(s.label)!.opp.push(opp);
      const reply = opp.result?.text.trim() ?? "";
      console.log(`\n── ${s.label} · OPONENTE ── ${meta(opp)}`);
      if (opp.result) console.log(`${words(reply)} palavras · ${(reply.match(/\?/g) ?? []).length} "?"\n${reply}`);

      let judge: Call | null = null;
      let analysis: unknown = null;
      if (withJudge && reply) {
        const turn = { index: 1, userText: a.text, opponentText: reply };
        judge = await call(s, buildJudgePrompt({ committeeId, dossier, setup, summary: "", turn, locale }), true);
        totals.get(s.label)!.judge.push(judge);
        console.log(`\n── ${s.label} · JUIZ ── ${meta(judge)}`);
        if (judge.result) {
          try {
            analysis = JSON.parse(judge.result.text);
            const m = (analysis as { melhorias_prioritarias?: unknown[] }).melhorias_prioritarias;
            console.log(`melhorias_prioritarias: ${m?.length ?? "?"} item(ns)${m && m.length > 3 ? " ⚠ passou de 3" : ""}`);
            console.log(JSON.stringify(analysis, null, 2));
          } catch {
            console.log(`⚠ JSON inválido:\n${judge.result.text}`);
          }
        }
      }
      records.push({ argument: i + 1, ...a, scenario: s.label, opponent: { ...opp, text: reply }, judge: judge && { ...judge, analysis } });
    }
  }

  console.log(`\n${rule}\nRESUMO POR CENÁRIO`);
  const avg = (calls: Call[], f: (c: Call) => number) => {
    const ok = calls.filter((c) => c.result);
    return ok.length ? Math.round(ok.reduce((n, c) => n + f(c), 0) / ok.length) : 0;
  };
  for (const s of scenarios) {
    const t = totals.get(s.label)!;
    for (const [name, calls] of [["oponente", t.opp], ["juiz", t.judge]] as const) {
      if (calls.length === 0) continue;
      const ok = calls.filter((c) => c.result).length;
      const cost = calls.reduce((n, c) => n + c.costUsd, 0) / Math.max(1, ok);
      console.log(
        `${s.label.padEnd(30)} ${name.padEnd(8)} ok ${ok}/${calls.length} · latência média ${avg(calls, (c) => c.latencyMs)} ms · ` +
          `in médio ${avg(calls, (c) => c.result!.usage.inputTokens)} (cache ${avg(calls, (c) => c.result!.usage.cachedTokens)}) · ` +
          `out médio ${avg(calls, (c) => c.result!.usage.outputTokens)} + raciocínio ${avg(calls, (c) => c.result!.usage.thoughtsTokens)} · ` +
          `truncadas ${calls.filter((c) => c.truncated).length} · US$ ${cost.toFixed(6)}/chamada`,
      );
    }
  }
  console.log("\nObs.: sem histórico nem resumo — mede só o turno isolado. Preço do 3.8 Flash dobra em 01/01/2027 (ver config.ts).");
  if (out) writeFileSync(out, JSON.stringify(records, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
