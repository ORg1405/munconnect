// Compara o MESMO prompt do oponente em dois modelos, lado a lado, com tokens,
// latência e custo — para decidir se o 3.1 Flash-Lite aguenta ou se vale subir
// o oponente para o 3.8 Flash.
//
// Uso (dentro de functions/):
//   npm run compare -- --file scripts/compare-args.example.json
//   npm run compare -- --file meus-args.json --models gemini-3.1-flash-lite,gemini-3.8-flash
//
// Chave: variável GEMINI_API_KEY ou, se ausente, functions/.secret.local
// (mesmo arquivo que o emulador usa). Faz chamadas REAIS (cobradas).
//
// Formato do arquivo:
//   { "committeeId": "SOLIDARNOSC", "locale": "pt-BR",
//     "setup": { ...mesmo formato do debateTurn... },
//     "arguments": ["fala 1", "fala 2", ...] }

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { CONTEXT, MODEL_IDS, ROLES, SAFETY_SETTINGS } from "../src/config.js";
import { buildOpponentPrompt, loadDossier } from "../src/context.js";
import { GeminiProvider } from "../src/llm/gemini.js";
import type { LLMResult } from "../src/llm/provider.js";
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

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if ((line + " " + word).trim().length > width) {
        lines.push(line);
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    lines.push(line);
  }
  return lines;
}

function sideBySide(a: string, b: string, width: number): string {
  const la = wrap(a, width);
  const lb = wrap(b, width);
  const n = Math.max(la.length, lb.length);
  return Array.from({ length: n }, (_, i) => `${(la[i] ?? "").padEnd(width)} │ ${lb[i] ?? ""}`).join("\n");
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface Row {
  result: LLMResult | null;
  error: string | null;
  latencyMs: number;
  costUsd: number;
}

async function main() {
  const file = arg("file") ?? join(import.meta.dirname, "compare-args.example.json");
  const models = (arg("models") ?? `${ROLES.opponent.model},${MODEL_IDS.flash38}`).split(",").map((m) => m.trim());
  if (models.length !== 2) throw new Error("--models precisa de exatamente 2 modelos separados por vírgula");

  const spec = JSON.parse(readFileSync(file, "utf8"));
  const committeeId: string = spec.committeeId;
  const locale: string = spec.locale ?? "pt-BR";
  const setup = parseSetup(spec.setup, committeeId);
  const dossier = loadDossier(committeeId);
  const key = apiKey();
  const provider = new GeminiProvider(key);
  const role = ROLES.opponent;

  // Tamanho do prefixo fixo — o cache implícito só ativa a partir de ~4.096 tokens.
  const sample = buildOpponentPrompt({ dossier, setup, summary: "", window: [], userText: "x", locale });
  const ai = new GoogleGenAI({ apiKey: key });
  const prefix = await ai.models.countTokens({ model: models[0], contents: sample.systemInstruction });
  const prefixTokens = prefix.totalTokens ?? 0;
  console.log(`\nComitê ${committeeId} · prefixo fixo (system + dossiê): ${prefixTokens} tokens` +
    (prefixTokens < CONTEXT.cachePrefixMinTokens ? `  ⚠ abaixo de ${CONTEXT.cachePrefixMinTokens}: cache implícito não deve ativar` : "  ✓ elegível para cache implícito"));

  const width = Math.max(40, Math.floor(((process.stdout.columns || 140) - 3) / 2));
  const totals = models.map(() => ({ cost: 0, latency: 0, in: 0, out: 0, think: 0, cached: 0, ok: 0 }));

  for (const [i, userText] of (spec.arguments as string[]).entries()) {
    const prompt = buildOpponentPrompt({ dossier, setup, summary: "", window: [], userText, locale });
    const rows: Row[] = await Promise.all(
      models.map(async (model): Promise<Row> => {
        const t0 = Date.now();
        try {
          const result = await provider.generate({
            model,
            ...prompt,
            thinkingLevel: role.thinkingLevel === "minimal" && !model.includes("flash-lite") ? "low" : role.thinkingLevel,
            maxOutputTokens: role.maxOutputTokens,
            temperature: role.temperature,
            safetySettings: SAFETY_SETTINGS,
            timeoutMs: 120_000,
          });
          return { result, error: null, latencyMs: Date.now() - t0, costUsd: estimateCostUsd(model, result.usage, result.serviceTier) };
        } catch (e) {
          return { result: null, error: (e as Error).message.slice(0, 200), latencyMs: Date.now() - t0, costUsd: 0 };
        }
      }),
    );

    console.log(`\n${"═".repeat(width * 2 + 3)}\nArgumento ${i + 1}: ${userText}\n${"─".repeat(width * 2 + 3)}`);
    console.log(sideBySide(models[0], models[1], width));
    console.log("─".repeat(width * 2 + 3));
    console.log(sideBySide(rows[0].result?.text ?? `ERRO: ${rows[0].error}`, rows[1].result?.text ?? `ERRO: ${rows[1].error}`, width));
    const meta = rows.map((r) => {
      if (!r.result) return `latência ${r.latencyMs} ms`;
      const u = r.result.usage;
      return `${words(r.result.text)} palavras · in ${u.inputTokens} (cache ${u.cachedTokens}) · out ${u.outputTokens} + raciocínio ${u.thoughtsTokens} · ${r.latencyMs} ms · US$ ${r.costUsd.toFixed(6)}`;
    });
    console.log("─".repeat(width * 2 + 3));
    console.log(sideBySide(meta[0], meta[1], width));

    rows.forEach((r, k) => {
      if (!r.result) return;
      const t = totals[k];
      t.ok++;
      t.cost += r.costUsd;
      t.latency += r.latencyMs;
      t.in += r.result.usage.inputTokens;
      t.out += r.result.usage.outputTokens;
      t.think += r.result.usage.thoughtsTokens;
      t.cached += r.result.usage.cachedTokens;
    });
  }

  console.log(`\n${"═".repeat(width * 2 + 3)}\nRESUMO`);
  models.forEach((m, k) => {
    const t = totals[k];
    const avgCost = t.ok ? t.cost / t.ok : 0;
    console.log(
      `${m.padEnd(26)} ok ${t.ok}/${spec.arguments.length} · latência média ${t.ok ? Math.round(t.latency / t.ok) : "-"} ms · ` +
        `custo médio/turno US$ ${avgCost.toFixed(6)} · por 1.000 turnos US$ ${(avgCost * 1000).toFixed(2)} · ` +
        `tokens in ${t.in} (cache ${t.cached}) / out ${t.out} / raciocínio ${t.think}`,
    );
  });
  console.log("\nObs.: sem histórico nem resumo — mede só o turno isolado. Preço do 3.8 Flash dobra em 01/01/2027 (ver config.ts).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
