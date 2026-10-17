import { beforeEach, describe, expect, it, vi } from "vitest";

const info = vi.fn();
const warn = vi.fn();
vi.mock("firebase-functions", () => ({ logger: { info, warn, error: vi.fn() } }));

const { logPrefixTokensOnce, resetPrefixStatsForTests } = await import("../src/prefixStats.js");
const { CONTEXT } = await import("../src/config.js");

function fakeProvider(tokens: number | Error) {
  return {
    name: "fake",
    generate: vi.fn(),
    stream: vi.fn(),
    countTokens: vi.fn(async () => {
      if (tokens instanceof Error) throw tokens;
      return tokens;
    }),
  };
}

const prefix = { role: "opponent" as const, committeeId: "X", model: "m", systemInstruction: "SYS" };

beforeEach(() => {
  info.mockReset();
  warn.mockReset();
  resetPrefixStatsForTests();
});

describe("logPrefixTokensOnce", () => {
  it("conta uma única vez por papel + comitê + modelo", async () => {
    const p = fakeProvider(5000);
    await logPrefixTokensOnce(p, prefix);
    await logPrefixTokensOnce(p, prefix);
    await logPrefixTokensOnce(p, { ...prefix, committeeId: "Y" });
    await logPrefixTokensOnce(p, { ...prefix, role: "turnAnalysis" });
    expect(p.countTokens).toHaveBeenCalledTimes(3);
    expect(p.countTokens).toHaveBeenCalledWith("m", "SYS");
  });

  it(`≥ ${CONTEXT.cachePrefixMinTokens} → info elegível`, async () => {
    await logPrefixTokensOnce(fakeProvider(CONTEXT.cachePrefixMinTokens), prefix);
    expect(info).toHaveBeenCalledWith("prefix_tokens", expect.objectContaining({ tokens: CONTEXT.cachePrefixMinTokens, cacheEligible: true }));
    expect(warn).not.toHaveBeenCalled();
  });

  it(`< ${CONTEXT.cachePrefixMinTokens} → aviso`, async () => {
    await logPrefixTokensOnce(fakeProvider(180), prefix);
    expect(warn).toHaveBeenCalledWith("prefix_tokens", expect.objectContaining({ tokens: 180, cacheEligible: false }));
  });

  it("falha na contagem não derruba nada e permite tentar de novo", async () => {
    const bad = fakeProvider(new Error("rede"));
    await expect(logPrefixTokensOnce(bad, prefix)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("prefix_tokens_failed", expect.anything());
    const good = fakeProvider(5000);
    await logPrefixTokensOnce(good, prefix);
    expect(good.countTokens).toHaveBeenCalledTimes(1);
  });
});
