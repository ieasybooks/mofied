import { afterEach, describe, expect, it, vi } from "vitest";
import { media } from "../../../tests/fixtures";
import { MediaPreloader, PRELOAD_BYTES, permitsPreload } from "./media-preload";

const preloaders: MediaPreloader[] = [];
const createPreloader = () => {
  const preloader = new MediaPreloader();
  preloaders.push(preloader);
  return preloader;
};
afterEach(() => {
  for (const preloader of preloaders.splice(0)) preloader.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const hls = {
  ...media("next"),
  playback: {
    url: "https://cdn.test/master.m3u8",
    mimeType: "application/vnd.apple.mpegurl" as const,
  },
};
const playlist =
  '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\na.m4s\n#EXTINF:4,\nb.m4s\n#EXTINF:4,\nc.m4s\n#EXT-X-ENDLIST';

describe("bounded next-media loading", () => {
  it("warms the first server rendition for native HLS", async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requests.push(url);
        return new Response(
          url.endsWith("master.m3u8")
            ? "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=900000\nfirst.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=200000\nlow.m3u8"
            : "#EXTM3U\n#EXT-X-ENDLIST",
        );
      }),
    );
    const preload = createPreloader();
    await preload.prepare(hls, true);
    expect(requests.map((url) => new URL(url).pathname)).toEqual([
      "/master.m3u8",
      "/first.m3u8",
    ]);
  });
  it("fetches one rendition, init and just two segments, reusing completed resources", async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push(url);
        expect(init.credentials).toBe("omit");
        return new Response(
          url.endsWith("master.m3u8")
            ? "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=900000\nhigh.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=200000\nlow.m3u8"
            : url.endsWith("low.m3u8")
              ? playlist
              : "bytes",
        );
      }),
    );
    const preload = createPreloader();
    await preload.prepare(hls);
    await preload.prepare(hls);
    expect(requests.map((url) => new URL(url).pathname)).toEqual([
      "/master.m3u8",
      "/low.m3u8",
      "/init.mp4",
      "/a.m4s",
      "/b.m4s",
    ]);
    expect(preload.take(hls.playback.url)?.size ?? 0).toBe(5);
    expect(preload.take(hls.playback.url)?.size ?? 0).toBe(0);
  });
  it("stops reading an oversized streaming response without a Content-Length", async () => {
    let canceled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(
            url.endsWith("m3u8")
              ? playlist
              : new ReadableStream({
                  pull(controller) {
                    controller.enqueue(new Uint8Array(PRELOAD_BYTES + 1));
                  },
                  cancel() {
                    canceled = true;
                  },
                }),
          ),
      ),
    );
    const preload = createPreloader();
    await preload.prepare(hls);
    expect(canceled).toBe(true);
    expect(preload.take(hls.playback.url)?.size ?? 0).toBe(1);
  });
  it("aborts the old target and never accepts its late result into the new warmup", async () => {
    const signals: AbortSignal[] = [];
    let release!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signals.push(init.signal!);
        return signals.length === 1
          ? new Promise<Response>((resolve) => {
              release = resolve;
            })
          : Promise.resolve(new Response("new"));
      }),
    );
    const preload = createPreloader();
    const old = preload.prepare(media("old"));
    await preload.prepare(media("new"));
    expect(signals[0]!.aborted).toBe(true);
    release(new Response("stale"));
    await old;
    expect(preload.take(media("new").playback.url)?.size ?? 0).toBe(1);
    expect(preload.take(media("old").playback.url)?.size ?? 0).toBe(0);
  });
  it("warms a bounded MP4 range but never treats a partial file as playable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        expect(init.headers).toEqual({ Range: "bytes=0-1048575" });
        return new Response("1234", {
          status: 206,
          headers: { "content-range": "bytes 0-3/9999999" },
        });
      }),
    );
    const preload = createPreloader();
    await preload.prepare(media("next"));
    expect(preload.take(media("next").playback.url)?.size ?? 0).toBe(0);
  });
  for (const unsupported of [
    "#EXTM3U\n#EXTINF:4,\nlive.ts",
    '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:4,\nencrypted.ts\n#EXT-X-ENDLIST',
    "#EXTM3U\n#EXT-X-BYTERANGE:10@0\nfile.ts\n#EXT-X-ENDLIST",
  ]) {
    it(`does not speculate on unsupported HLS: ${unsupported.split("\n")[1]}`, async () => {
      const fetcher = vi.fn(async () => new Response(unsupported));
      vi.stubGlobal("fetch", fetcher);
      const preload = createPreloader();
      await preload.prepare(hls);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  }
  it("suppresses speculative errors and honors reduced-data connections", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const preload = createPreloader();
    await expect(preload.prepare(hls)).resolves.toBeUndefined();
    expect(permitsPreload({ saveData: true })).toBe(false);
    expect(permitsPreload({ effectiveType: "2g" })).toBe(false);
    expect(permitsPreload()).toBe(true);
  });
});

const pausePlaylist =
  "#EXTM3U\n#EXTINF:2,\na.m4s\n#EXTINF:2,\nb.m4s\n#EXT-X-ENDLIST";

describe("preload ownership and recovery", () => {
  it("resumes cancelled work for the same item and preserves completed reads", async () => {
    const requests: string[] = [];
    let blocked!: () => void;
    const pending = new Promise<void>((resolve) => {
      blocked = resolve;
    });
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        requests.push(url);
        if (url.endsWith("m3u8")) return new Response(pausePlaylist);
        if (url.endsWith("b.m4s") && first) {
          first = false;
          blocked();
          await new Promise((_, reject) =>
            init.signal!.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            ),
          );
        }
        return new Response("bytes");
      }),
    );
    const preload = createPreloader();
    const old = preload.prepare(hls);
    await pending;
    preload.suspend();
    await preload.prepare(hls);
    await old;
    const warmed = preload.take(hls.playback.url)!;
    expect(warmed.size).toBe(3);
    expect(requests.filter((url) => url.endsWith("a.m4s"))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith("b.m4s"))).toHaveLength(2);
    warmed.dispose();
  });

  it("rejects a late cancelled response without overwriting a resumed download", async () => {
    let release!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(new Response("fresh"));
    vi.stubGlobal("fetch", fetcher);
    const preload = createPreloader();
    const old = preload.prepare(media("same"));
    preload.suspend();
    await preload.prepare(media("same"));
    release(new Response("stale"));
    await old;
    const warmed = preload.take(media("same").playback.url)!;
    expect(
      new TextDecoder().decode(warmed.get(media("same").playback.url)!.data),
    ).toBe("fresh");
    warmed.dispose();
  });

  it("automatically retries a transient failure while still eligible", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue(new Response("recovered"));
    vi.stubGlobal("fetch", fetcher);
    const preload = createPreloader();
    await preload.prepare(media("next"));
    await vi.advanceTimersByTimeAsync(300);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const warmed = preload.take(media("next").playback.url)!;
    expect(warmed.size).toBe(1);
    warmed.dispose();
  });

  it("rejects cancellation during reader cleanup before committing cached bytes", async () => {
    let closing!: () => void;
    let finishClose!: () => void;
    const atCleanup = new Promise<void>((resolve) => {
      closing = resolve;
    });
    const close = new Promise<void>((resolve) => {
      finishClose = resolve;
    });
    const stale = new Response("stale");
    const reader = stale.body!.getReader();
    const cancel = reader.cancel.bind(reader);
    reader.cancel = async () => {
      closing();
      await cancel();
      await close;
    };
    vi.spyOn(stale.body!, "getReader").mockReturnValue(reader as any);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(stale)
        .mockImplementation(async () => new Response("fresh")),
    );
    const preload = createPreloader();
    const old = preload.prepare(media("same"));
    await atCleanup;
    preload.suspend();
    await preload.prepare(media("same"));
    finishClose();
    await old;
    const warmed = preload.take(media("same").playback.url)!;
    expect(
      new TextDecoder().decode(warmed.get(media("same").playback.url)!.data),
    ).toBe("fresh");
    warmed.dispose();
  });

  it("retries an eight-second timeout instead of remembering it as completed", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        (_url, init) =>
          new Promise((_, reject) =>
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      )
      .mockResolvedValue(new Response("recovered"));
    vi.stubGlobal("fetch", fetcher);
    const preload = createPreloader();
    const attempt = preload.prepare(media("next"));
    await vi.advanceTimersByTimeAsync(8300);
    await attempt;
    expect(fetcher).toHaveBeenCalledTimes(2);
    const warmed = preload.take(media("next").playback.url)!;
    expect(warmed.size).toBe(1);
    warmed.dispose();
  });

  it("bounds speculative retries and cancels them on suspension or disposal", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetcher);
    const preload = createPreloader();
    await preload.prepare(media("next"));
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(3);
    preload.suspend();
    await preload.prepare(media("next"));
    preload.suspend();
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(4);
    await preload.prepare(media("next"));
    preload.clear();
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("transfers an in-flight download without cancellation or a second request", async () => {
    let release!: (response: Response) => void;
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) => {
        signals.push(init.signal!);
        return url.endsWith("next.mp4")
          ? new Promise<Response>((resolve) => {
              release = resolve;
            })
          : Promise.resolve(new Response("later"));
      }),
    );
    const preload = createPreloader();
    const started = preload.prepare(media("next"));
    const warmed = preload.take(media("next").playback.url)!;
    const resource = warmed.wait(media("next").playback.url);
    await preload.prepare(media("later"));
    preload.clear();
    expect(signals[0]!.aborted).toBe(false);
    release(new Response("opening bytes"));
    expect(new TextDecoder().decode((await resource)!.data)).toBe(
      "opening bytes",
    );
    await started;
    warmed.dispose();
    expect(signals).toHaveLength(2);
  });

  it("restarts exhausted retries on reconnect, but leaves suspended work alone", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetcher);
    const preload = createPreloader();
    await preload.prepare(media("next"));
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(3);
    preload.reconnect();
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(6);
    preload.suspend();
    preload.reconnect();
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(6);
    fetcher.mockImplementation(async () => new Response("recovered"));
    await preload.prepare(media("next"));
    preload.reconnect();
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(7);
    const warmed = preload.take(media("next").playback.url)!;
    expect(warmed.size).toBe(1);
    warmed.dispose();
  });

  it("does not interrupt an in-flight warmup when connectivity changes", async () => {
    let release!: (response: Response) => void;
    let signal!: AbortSignal;
    const fetcher = vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const preload = createPreloader();
    const started = preload.prepare(media("next"));
    preload.reconnect();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(false);
    release(new Response("bytes"));
    await started;
  });

  it("does not pass an in-flight partial MP4 range to the player as a complete file", async () => {
    let release!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const preload = createPreloader();
    const started = preload.prepare(media("next"));
    const warmed = preload.take(media("next").playback.url)!;
    const resource = warmed.wait(media("next").playback.url);
    release(
      new Response("1234", {
        status: 206,
        headers: { "content-range": "bytes 0-3/99999" },
      }),
    );
    expect(await resource).toBeUndefined();
    await started;
    warmed.dispose();
  });

  it("keeps the total byte bound across an interrupted and resumed warmup", async () => {
    let blocked!: () => void;
    const pending = new Promise<void>((resolve) => {
      blocked = resolve;
    });
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("m3u8")) return new Response(pausePlaylist);
        if (url.endsWith("b.m4s") && first) {
          first = false;
          blocked();
          await new Promise((_, reject) =>
            init.signal!.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          );
        }
        return new Response(new Uint8Array(PRELOAD_BYTES * 0.6), {
          headers: {
            "content-length": String(Math.floor(PRELOAD_BYTES * 0.6)),
          },
        });
      }),
    );
    const preload = createPreloader();
    const old = preload.prepare(hls);
    await pending;
    preload.suspend();
    await preload.prepare(hls);
    await old;
    const warmed = preload.take(hls.playback.url)!;
    expect(warmed.size).toBe(2);
    expect(
      [...warmed.values()].reduce((n, r) => n + r.data.byteLength, 0),
    ).toBeLessThanOrEqual(PRELOAD_BYTES);
    warmed.dispose();
  });
});
