import { describe, expect, it, vi } from "vitest";
import {
  createHttpProvider,
  parseSession,
  parseStart,
  sessionLoadDiagnostic,
  SessionPlanSchema,
  sharedStart,
  shareLink,
} from "./index";
import { fixture } from "@mofied/fixtures";

describe("session contract", () => {
  it("requests a fresh plan with HTTP caching disabled on every load", async () => {
    let calls = 0;
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        expect(init?.cache).toBe("no-store");
        return new Response(
          JSON.stringify({ ...fixture(), id: `fresh-${++calls}` }),
        );
      },
    );
    const provider = createHttpProvider(
      "https://api.example.test/session",
      fetcher as typeof fetch,
    );
    expect((await provider.load()).id).toBe("fresh-1");
    expect((await provider.load()).id).toBe("fresh-2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
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
  it("distinguishes configuration, network, HTTP, malformed, invalid and cancelled requests", async () => {
    const original = globalThis.fetch;
    try {
      expect(() => createHttpProvider("http://example.test")).toThrow("HTTPS");
      const provider = createHttpProvider("https://api.example.test/session");
      for (const [response, code] of [
        [new Response("", { status: 503 }), "http"],
        [new Response("not json"), "invalid-json"],
        [Response.json({ schemaVersion: 99 }), "invalid-plan"],
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
  it("builds share links and reads only real shares back", () => {
    expect(shareLink("4321")).toBe("https://mofied.com/?start=4321");
    expect(sharedStart(shareLink("4321"))).toBe("4321");
    for (const [link, start] of [
      ["https://mofied.com/?start=7&utm_source=x", "7"],
      ["https://www.mofied.com/?start=7", "7"],
      ["https://mofied.com?start=7", "7"],
      ["mofied://?start=7", "7"],
      ["mofied:///?start=7", "7"],
      ["https://mofied.com/", undefined],
      ["https://mofied.com/privacy/?start=7", undefined],
      ["http://mofied.com/?start=7", undefined],
      ["https://mofied.com.evil.test/?start=7", undefined],
      ["https://mofied.com/?start=0", undefined],
      ["https://mofied.com/?start=-1", undefined],
      ["https://mofied.com/?start=7x", undefined],
      ["https://mofied.com/?start=" + "9".repeat(20), undefined],
      ["not a url", undefined],
      [null, undefined],
    ] as const)
      expect(sharedStart(link), String(link)).toBe(start);
    expect(parseStart("12")).toBe("12");
    expect(parseStart(" 12")).toBeUndefined();
  });
  it("asks the API for a valid shared media and never for anything else", async () => {
    const original = globalThis.fetch;
    try {
      const fetch = vi
        .fn()
        .mockImplementation(async () => Response.json(fixture()));
      globalThis.fetch = fetch;
      const provider = createHttpProvider(
        "https://faqieh.com/api/v1/mofied/session?locale=ar",
      );
      await provider.load(undefined, { start: "4321" });
      await provider.load(undefined, { start: "4321&locale=en" });
      await provider.load();
      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        "https://faqieh.com/api/v1/mofied/session?locale=ar&start=4321",
        "https://faqieh.com/api/v1/mofied/session?locale=ar",
        "https://faqieh.com/api/v1/mofied/session?locale=ar",
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });
});
