import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Gemini mockado: substitui o SDK @google/genai inteiro ────────────────────
const generateContent = vi.fn();
const generateContentStream = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent, generateContentStream };
  },
}));

const { GeminiProvider, apiKeyProblem, toLLMError } = await import("../src/llm/gemini.js");
const { callModel } = await import("../src/llm/router.js");
const { backoffDelay, withRetryAndFallback } = await import("../src/llm/retry.js");
const { LLMError, errorDetail, redactSecrets } = await import("../src/llm/provider.js");
const { Semaphore, SemaphoreTimeoutError } = await import("../src/llm/semaphore.js");
const { MODEL_IDS, RETRY, ROLES } = await import("../src/config.js");
const { estimateCostUsd } = await import("../src/telemetry.js");

function apiError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function okResponse(text: string, model = "gemini-3.1-flash-lite") {
  return {
    text,
    modelVersion: model,
    candidates: [{ finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100, thoughtsTokenCount: 50, cachedContentTokenCount: 400 },
  };
}

async function* streamOf(...pieces: string[]) {
  for (const [i, p] of pieces.entries()) {
    yield {
      text: p,
      modelVersion: "gemini-3.1-flash-lite",
      candidates: [{ finishReason: i === pieces.length - 1 ? "STOP" : undefined }],
      usageMetadata: i === pieces.length - 1 ? { promptTokenCount: 10, candidatesTokenCount: 5 } : undefined,
    };
  }
}

const sleeps: number[] = [];
const retryDeps = { sleep: async (ms: number) => void sleeps.push(ms), random: () => 0.5 };
const provider = new GeminiProvider("test-key");
const base = { systemInstruction: "SYS", userContent: "USER", retryDeps };

beforeEach(() => {
  generateContent.mockReset();
  generateContentStream.mockReset();
  sleeps.length = 0;
});

describe("backoffDelay", () => {
  it("1 s, 2 s, 4 s, 8 s sem jitter (random = 0.5)", () => {
    expect([1, 2, 3, 4].map((a) => backoffDelay(a, RETRY, () => 0.5))).toEqual([1000, 2000, 4000, 8000]);
  });

  it("jitter fica em ±30% e respeita o teto de 8 s", () => {
    expect(backoffDelay(1, RETRY, () => 0)).toBe(700);
    expect(backoffDelay(1, RETRY, () => 0.9999)).toBeLessThanOrEqual(1300);
    expect(backoffDelay(10, RETRY, () => 0.5)).toBe(8000);
  });
});

describe("callModel com Gemini mockado", () => {
  it("sucesso de primeira: sem espera, usa o modelo principal e calcula custo com cache", async () => {
    generateContent.mockResolvedValueOnce(okResponse("réplica"));
    const r = await callModel(provider, { role: "opponent", ...base });
    expect(r.text).toBe("réplica");
    expect(r.usedFallback).toBe(false);
    expect(sleeps).toEqual([]);
    expect(r.usage).toEqual({ inputTokens: 1000, outputTokens: 100, thoughtsTokens: 50, cachedTokens: 400 });
    // Oponente no 3.5 Flash-Lite: 600 × 0.3 + 400 × 0.03 + 150 × 2.5 (por 1M)
    expect(r.costUsd).toBeCloseTo((600 * 0.3 + 400 * 0.03 + 150 * 2.5) / 1e6, 9);
    const req = generateContent.mock.calls[0][0];
    expect(req.model).toBe(ROLES.opponent.model);
    expect(req.config.systemInstruction).toBe("SYS");
    expect(req.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(req.config.safetySettings.length).toBeGreaterThan(0);
  });

  it("429/503 → retry com backoff 1 s, 2 s e sucesso na 3ª tentativa", async () => {
    generateContent.mockRejectedValueOnce(apiError(429)).mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce(okResponse("ok"));
    const r = await callModel(provider, { role: "opponent", ...base });
    expect(r.text).toBe("ok");
    expect(sleeps).toEqual([1000, 2000]);
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(r.usedFallback).toBe(false);
  });

  it("4 falhas no principal → cai no modelo de reserva", async () => {
    generateContent
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce(okResponse("reserva", ROLES.opponent.fallbackModel!));
    const r = await callModel(provider, { role: "opponent", ...base });
    expect(r.text).toBe("reserva");
    expect(r.usedFallback).toBe(true);
    expect(sleeps).toEqual([1000, 2000, 4000]);
    const models = generateContent.mock.calls.map((c) => c[0].model);
    expect(models).toEqual([...Array(RETRY.maxAttempts).fill(ROLES.opponent.model), ROLES.opponent.fallbackModel]);
  });

  it("principal e reserva esgotados → LLMError transitório (vira 'tente de novo')", async () => {
    generateContent.mockRejectedValue(apiError(503));
    await expect(callModel(provider, { role: "opponent", ...base })).rejects.toMatchObject({ kind: "unavailable", retryable: true });
    expect(generateContent).toHaveBeenCalledTimes(RETRY.maxAttempts + RETRY.fallbackMaxAttempts);
  });

  it("erro não-transitório (400) não é re-tentado", async () => {
    generateContent.mockRejectedValueOnce(apiError(400));
    await expect(callModel(provider, { role: "opponent", ...base })).rejects.toMatchObject({ kind: "bad_request" });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("bloqueio de segurança não é re-tentado e expõe só as categorias", async () => {
    generateContent.mockResolvedValueOnce({
      text: "",
      candidates: [{ finishReason: "SAFETY", safetyRatings: [{ category: "HARM_CATEGORY_HATE_SPEECH", probability: "HIGH", blocked: true }] }],
      usageMetadata: {},
    });
    const err = await callModel(provider, { role: "opponent", ...base }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe("blocked");
    expect(err.blockInfo).toEqual({ reason: "SAFETY", categories: ["HARM_CATEGORY_HATE_SPEECH"] });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("streaming: entrega chunks e re-tenta se falhar ANTES do primeiro chunk", async () => {
    generateContentStream.mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(streamOf("Olá, ", "delegado."));
    const chunks: string[] = [];
    const r = await callModel(provider, { role: "opponent", ...base, onChunk: (c) => void chunks.push(c) });
    expect(chunks).toEqual(["Olá, ", "delegado."]);
    expect(r.text).toBe("Olá, delegado.");
    expect(sleeps).toEqual([1000]);
  });

  it("streaming: falha DEPOIS de entregar texto não é re-tentada", async () => {
    async function* broken() {
      yield { text: "parcial", candidates: [{}] };
      throw apiError(503);
    }
    generateContentStream.mockResolvedValueOnce(broken());
    const err = await callModel(provider, { role: "opponent", ...base, onChunk: () => undefined }).catch((e) => e);
    expect(err.partialOutput).toBe(true);
    expect(generateContentStream).toHaveBeenCalledTimes(1);
  });

  it("saída estruturada: passa o JSON Schema como responseJsonSchema", async () => {
    generateContent.mockResolvedValueOnce(okResponse('{"ok":true}'));
    const schema = { type: "object", properties: { ok: { type: "boolean" } } };
    await callModel(provider, { role: "turnAnalysis", ...base, responseJsonSchema: schema });
    const cfg = generateContent.mock.calls[0][0].config;
    expect(cfg.responseMimeType).toBe("application/json");
    expect(cfg.responseJsonSchema).toBe(schema);
  });

  it("finishReason MAX_TOKENS marca a resposta como truncada", async () => {
    generateContent.mockResolvedValueOnce({ ...okResponse("cortad"), candidates: [{ finishReason: "MAX_TOKENS" }] });
    const r = await callModel(provider, { role: "opponent", ...base });
    expect(r.truncated).toBe(true);
    generateContent.mockResolvedValueOnce(okResponse("inteira"));
    expect((await callModel(provider, { role: "opponent", ...base })).truncated).toBe(false);
  });

  it("reserva usa o próprio thinkingLevel (oponente: 3.5 low → 3.1 minimal)", async () => {
    for (let i = 0; i < RETRY.maxAttempts; i++) generateContent.mockRejectedValueOnce(apiError(503));
    generateContent.mockResolvedValueOnce(okResponse("x", ROLES.opponent.fallbackModel!));
    await callModel(provider, { role: "opponent", ...base });
    const calls = generateContent.mock.calls.map((c) => [c[0].model, c[0].config.thinkingConfig.thinkingLevel]);
    expect(calls[0]).toEqual([MODEL_IDS.flashLite35, "LOW"]);
    expect(calls[RETRY.maxAttempts]).toEqual([MODEL_IDS.flashLite31, "MINIMAL"]);
  });

  it("MALFORMED_RESPONSE, resposta vazia e finishReason inesperado são re-tentados", async () => {
    generateContent
      .mockResolvedValueOnce({ text: "", candidates: [{ finishReason: "MALFORMED_RESPONSE" }], usageMetadata: {} })
      .mockResolvedValueOnce({ ...okResponse("  "), candidates: [{ finishReason: "STOP" }] })
      .mockResolvedValueOnce({ ...okResponse("meia frase"), candidates: [{ finishReason: "OTHER" }] })
      .mockResolvedValueOnce(okResponse("ok"));
    const r = await callModel(provider, { role: "opponent", ...base });
    expect(r.text).toBe("ok");
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it("resposta inutilizável no principal inteiro → cai na reserva", async () => {
    generateContent.mockImplementation(async (req: { model: string }) =>
      req.model === ROLES.opponent.fallbackModel
        ? okResponse("reserva", req.model)
        : { text: "", candidates: [{ finishReason: "MALFORMED_RESPONSE" }], usageMetadata: {} },
    );
    const r = await callModel(provider, { role: "opponent", ...base });
    expect(r).toMatchObject({ text: "reserva", usedFallback: true });
  });

  it("streaming: resposta vazia antes de qualquer chunk é re-tentada", async () => {
    generateContentStream.mockResolvedValueOnce(streamOf("")).mockResolvedValueOnce(streamOf("Olá."));
    const r = await callModel(provider, { role: "opponent", ...base, onChunk: () => undefined });
    expect(r.text).toBe("Olá.");
    expect(generateContentStream).toHaveBeenCalledTimes(2);
  });

  it("validate: JSON inválido do juiz (ou truncado) conta como transitório", async () => {
    generateContent
      .mockResolvedValueOnce({ ...okResponse('{"turno": 1, "argu'), candidates: [{ finishReason: "MAX_TOKENS" }] })
      .mockResolvedValueOnce(okResponse('{"ok":true}'));
    const r = await callModel(provider, { role: "turnAnalysis", ...base, validate: (t) => void JSON.parse(t) });
    expect(r.text).toBe('{"ok":true}');
    expect(sleeps).toEqual([1000]);
  });

  it("análise: 3.1 Flash-Lite low com teto de 4096; reserva 3.5", () => {
    expect(ROLES.turnAnalysis).toMatchObject({ model: MODEL_IDS.flashLite31, thinkingLevel: "low", maxOutputTokens: 4096, fallbackModel: MODEL_IDS.flashLite35 });
  });
});

describe("toLLMError", () => {
  it("classifica erros do SDK e de rede", () => {
    expect(toLLMError(apiError(429))).toMatchObject({ kind: "rate_limit", retryable: true });
    expect(toLLMError(apiError(503))).toMatchObject({ kind: "unavailable", retryable: true });
    expect(toLLMError(apiError(500))).toMatchObject({ kind: "other", retryable: false });
    // Deadline estourado no servidor (httpOptions.timeout) volta como 504.
    expect(toLLMError(apiError(504))).toMatchObject({ kind: "timeout", retryable: true });
    // Timeout local do SDK: DOMException AbortError (code 20 não é status HTTP).
    const abort = Object.assign(new Error("This operation was aborted"), { name: "AbortError", code: 20 });
    expect(toLLMError(abort)).toMatchObject({ kind: "timeout", retryable: true });
    expect(toLLMError(new TypeError("fetch failed"))).toMatchObject({ kind: "network", retryable: true });
  });
});

describe("withRetryAndFallback sem modelo de reserva", () => {
  it("propaga o último erro", async () => {
    const call = vi.fn().mockRejectedValue(new LLMError("x", { kind: "rate_limit", status: 429, retryable: true }));
    await expect(
      withRetryAndFallback(call, { model: "m", fallbackModel: null, policy: RETRY, fallbackAttempts: 2, deadlineMs: 600_000, deps: retryDeps }),
    ).rejects.toMatchObject({ status: 429 });
    expect(call).toHaveBeenCalledTimes(RETRY.maxAttempts);
  });
});

describe("orçamento total de tempo (deadlineMs)", () => {
  it("não inicia tentativa sem tempo e limita o timeout da última ao que resta", async () => {
    // Relógio falso: cada chamada ao modelo "leva" 40 s e falha com 503.
    let clock = 0;
    const deps = {
      now: () => clock,
      random: () => 0.5,
      sleep: async (ms: number) => void (clock += ms),
    };
    generateContent.mockImplementation(async () => {
      clock += 40_000;
      throw apiError(503);
    });
    await expect(callModel(provider, { role: "opponent", ...base, retryDeps: deps })).rejects.toMatchObject({ kind: "unavailable" });
    // opponent: deadline 100 s, 25 s reservados à reserva, timeout 30 s/tentativa.
    // t=0 → principal #1 (falha em 40) · espera 1 s · t=41 → principal #2 (falha em 81)
    // principal sem orçamento (100 − 81 − 25 < 10) → reserva com os 19 s que
    // sobraram (falha em 121) → acabou o orçamento.
    const timeouts = generateContent.mock.calls.map((c) => c[0].config.httpOptions.timeout);
    expect(timeouts).toEqual([30_000, 30_000, 19_000]);
    const models = generateContent.mock.calls.map((c) => c[0].model);
    expect(models).toEqual([ROLES.opponent.model, ROLES.opponent.model, ROLES.opponent.fallbackModel]);
  });

  it("modelo principal lento não consome a reserva: o fallback sempre tem sua vez", async () => {
    // Relatório: cada tentativa no 3.8 Flash estoura o timeout inteiro (504).
    let clock = 0;
    const deps = { now: () => clock, random: () => 0.5, sleep: async (ms: number) => void (clock += ms) };
    generateContent.mockImplementation(async (req: { model: string; config: { httpOptions: { timeout: number } } }) => {
      if (req.model === ROLES.report.model) {
        clock += req.config.httpOptions.timeout;
        throw apiError(504);
      }
      clock += 4000;
      return okResponse('{"ok":true}', req.model);
    });
    const r = await callModel(provider, { role: "report", ...base, retryDeps: deps });
    expect(r.usedFallback).toBe(true);
    expect(clock).toBeLessThanOrEqual(ROLES.report.deadlineMs);
    const lastCall = generateContent.mock.calls.at(-1)![0];
    expect(lastCall.model).toBe(ROLES.report.fallbackModel);
    expect(lastCall.config.httpOptions.timeout).toBeGreaterThanOrEqual(ROLES.report.fallbackReserveMs - 1000);
  });

  it("nenhuma tentativa usa timeout abaixo de 10 s (a API recusa com 400)", async () => {
    let clock = 0;
    const deps = { now: () => clock, random: () => 0.5, sleep: async (ms: number) => void (clock += ms) };
    generateContent.mockImplementation(async (req: { config: { httpOptions: { timeout: number } } }) => {
      clock += Math.min(req.config.httpOptions.timeout, 13_000);
      throw apiError(503);
    });
    await callModel(provider, { role: "opponent", ...base, retryDeps: deps }).catch(() => undefined);
    const timeouts = generateContent.mock.calls.map((c) => c[0].config.httpOptions.timeout);
    expect(timeouts.length).toBeGreaterThan(2);
    expect(Math.min(...timeouts)).toBeGreaterThanOrEqual(RETRY.minAttemptMs);
  });

  it("o orçamento de cada papel cabe no timeout da função que o chama", async () => {
    const { FUNCTIONS, QUOTA } = await import("../src/config.js");
    expect(ROLES.opponent.deadlineMs).toBeLessThan(FUNCTIONS.debateTurn.timeoutSeconds * 1000);
    expect(ROLES.turnAnalysis.deadlineMs).toBeLessThan(FUNCTIONS.onTurnCreated.timeoutSeconds * 1000);
    expect(ROLES.summary.deadlineMs).toBeLessThan(FUNCTIONS.onTurnCreated.timeoutSeconds * 1000);
    expect(ROLES.report.deadlineMs).toBeLessThan(FUNCTIONS.debateReport.timeoutSeconds * 1000);
    expect(FUNCTIONS.debateReport.timeoutSeconds).toBeGreaterThanOrEqual(180);
    expect(QUOTA.turnLockSeconds).toBeGreaterThan(FUNCTIONS.debateTurn.timeoutSeconds);
    expect(QUOTA.reportLockSeconds).toBeGreaterThan(FUNCTIONS.debateReport.timeoutSeconds);
  });

  it("análise usa um modelo diferente do oponente (outro pool de limite)", () => {
    expect(ROLES.turnAnalysis.model).not.toBe(ROLES.opponent.model);
  });
});

describe("Semaphore", () => {
  it("limita concorrência e libera na ordem", async () => {
    const s = new Semaphore(2);
    const r1 = await s.acquire();
    const r2 = await s.acquire();
    let third = false;
    const p3 = s.acquire().then((r) => ((third = true), r));
    await Promise.resolve();
    expect(third).toBe(false);
    expect(s.queued).toBe(1);
    r1();
    const r3 = await p3;
    expect(third).toBe(true);
    expect(s.inUse).toBe(2);
    r2();
    r3();
    expect(s.inUse).toBe(0);
  });

  it("estoura timeout quando a fila não anda", async () => {
    const s = new Semaphore(1);
    await s.acquire();
    await expect(s.acquire(10)).rejects.toBeInstanceOf(SemaphoreTimeoutError);
    expect(s.queued).toBe(0);
  });
});

describe("estimateCostUsd", () => {
  const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, thoughtsTokens: 0, cachedTokens: 0 };
  it("3.8 Flash dobra de preço em 01/01/2027", () => {
    expect(estimateCostUsd("gemini-3.8-flash", usage, "standard", new Date("2026-12-31T12:00:00Z"))).toBeCloseTo(4.5);
    expect(estimateCostUsd("gemini-3.8-flash", usage, "standard", new Date("2027-01-01T12:00:00Z"))).toBeCloseTo(9);
  });
  it("Flex custa metade", () => {
    expect(estimateCostUsd("gemini-3.8-flash", usage, "flex", new Date("2026-12-31T12:00:00Z"))).toBeCloseTo(2.25);
  });
  it("modelo sem preço configurado → 0", () => {
    expect(estimateCostUsd("modelo-desconhecido", usage, "standard")).toBe(0);
  });
});

describe("chave da API e erros sem status", () => {
  const fakeKey = "AIzaSyFAKE_fake-0123456789abcdefghijklmn";
  const undiciHeaderError = () =>
    Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("invalid x-goog-api-key header"), { name: "InvalidArgumentError", code: "UND_ERR_INVALID_ARG" }),
    });

  it("apiKeyProblem: ausente, vazia, caractere de controle (Ctrl+V) e chave válida", () => {
    expect(apiKeyProblem(undefined)).toMatch(/ausente/);
    expect(apiKeyProblem("  ")).toMatch(/vazia/);
    expect(apiKeyProblem("\u0016")).toMatch(/1 caractere\(s\).*Ctrl\+V/);
    expect(apiKeyProblem(`${fakeKey} `)).toMatch(/inválida/);
    expect(apiKeyProblem(fakeKey)).toBeNull();
  });

  it("GeminiProvider com chave inválida falha na hora, como erro de configuração", () => {
    expect(() => new GeminiProvider("\u0016")).toThrow(expect.objectContaining({ kind: "config", retryable: false }));
    expect(() => new GeminiProvider(undefined)).toThrow(/GEMINI_API_KEY ausente/);
  });

  it("fetch recusando o cabeçalho vira 'config' (não re-tenta), com nome, mensagem e cause", () => {
    const e = toLLMError(undiciHeaderError());
    expect(e).toMatchObject({ kind: "config", retryable: false, status: null });
    expect(e.detail).toEqual({
      name: "TypeError",
      message: "fetch failed",
      cause: { name: "InvalidArgumentError", code: "UND_ERR_INVALID_ARG", message: "invalid x-goog-api-key header" },
    });
  });

  it("rede de verdade continua 'network' e re-tentável, agora com o detalhe", () => {
    const e = toLLMError(Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) }));
    expect(e).toMatchObject({ kind: "network", retryable: true });
    expect(e.detail?.cause).toEqual({ name: "Error", code: "ECONNREFUSED", message: "connect ECONNREFUSED" });
  });

  it("a chave nunca aparece na mensagem nem no detalhe", () => {
    const err = Object.assign(new Error(`falhou em https://x/v1?key=${fakeKey}&alt=sse com ${fakeKey}`), {
      cause: new Error(`cabeçalho ${fakeKey}`),
    });
    const e = toLLMError(err, fakeKey);
    for (const text of [e.message, e.detail!.message, e.detail!.cause!.message!]) expect(text).not.toContain(fakeKey);
    expect(redactSecrets(`x ${fakeKey} y`)).not.toContain(fakeKey); // mesmo sem passar a chave (padrão AIza…)
    expect(errorDetail("texto solto").message).toBe("texto solto");
  });

  it("callModel: erro de configuração não gasta retry nem reserva", async () => {
    generateContent.mockRejectedValue(undiciHeaderError());
    await expect(callModel(provider, { role: "opponent", ...base })).rejects.toMatchObject({ kind: "config" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });
});
