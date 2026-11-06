import { describe, expect, it, vi } from "vitest";
import {
  createHttpProvider,
  parseSession,
  sessionLoadDiagnostic,
  SessionPlanSchema,
} from "./index";
import { fixture } from "@mofied/fixtures";

describe("session contract", () => {
  it("validates every fixture and rejects invalid item identity, schemes and versions", () => {
    for (const name of [
      "normal",
      "long-title",
      "missing-portrait",
      "unavailable",
    ] as const)
      expect(parseSession(fixture(name)).items).toHaveLength(3);
    const plan = fixture();
    expect(
      SessionPlanSchema.safeParse({ ...plan, schemaVersion: 2 }).success,
    ).toBe(false);
    expect(
      SessionPlanSchema.safeParse({
        ...plan,
        items: [plan.items[0], plan.items[0]],
      }).success,
    ).toBe(false);
    const media = plan.items[0]!;
    expect(
      SessionPlanSchema.safeParse({
        ...plan,
        items: [{ ...media, pageUrl: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
    expect(() =>
      parseSession({ ...plan, expiresAt: "2000-01-01T00:00:00.000Z" }),
    ).toThrow("expired");
  });
  it("does not substitute fixtures when the API fails or returns a different schema", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response("", { status: 503 }));
      await expect(
        createHttpProvider("https://faqieh.com/api/test").load(),
      ).rejects.toThrow("503");
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(Response.json({ schemaVersion: 99 }));
      await expect(
        createHttpProvider("https://faqieh.com/api/test").load(),
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = original;
    }
  });
  it("aborts an unresponsive API request rather than leaving the loading screen forever", async () => {
    vi.useFakeTimers();
    const original = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
      const result = expect(
        createHttpProvider("https://faqieh.com/api/test").load(),
      ).rejects.toMatchObject({ code: "timeout" });
      await vi.advanceTimersByTimeAsync(15_000);
      await result;
    } finally {
      globalThis.fetch = original;
      vi.useRealTimers();
    }
  });
  it("distinguishes configuration, network, HTTP, malformed, invalid, expired and cancelled requests", async () => {
    const original = globalThis.fetch;
    try {
      expect(() => createHttpProvider("http://example.test")).toThrow("HTTPS");
      const provider = createHttpProvider("https://api.example.test/session");
      for (const [response, code] of [
        [new Response("", { status: 503 }), "http"],
        [new Response("not json"), "invalid-json"],
        [Response.json({ schemaVersion: 99 }), "invalid-plan"],
        [
          Response.json({
            ...fixture(),
            expiresAt: "2000-01-01T00:00:00.000Z",
          }),
          "expired",
        ],
      ] as const) {
        globalThis.fetch = vi.fn().mockResolvedValue(response);
        await expect(provider.load()).rejects.toMatchObject({ code });
      }
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new TypeError("URL with private details"));
      const error = await provider.load().catch((error: unknown) => error);
      expect(sessionLoadDiagnostic(error)).toEqual({ category: "network" });
      const abort = new AbortController();
      abort.abort();
      await expect(provider.load(abort.signal)).rejects.toMatchObject({
        code: "aborted",
      });
    } finally {
      globalThis.fetch = original;
    }
  });
});
