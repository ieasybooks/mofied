import { afterEach, describe, expect, it, vi } from "vitest";
import { media } from "../../../tests/fixtures";
import { MediaPreloader, PRELOAD_BYTES, permitsPreload } from "./media-preload";

afterEach(() => vi.unstubAllGlobals());
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
    const preload = new MediaPreloader();
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
    const preload = new MediaPreloader();
    await preload.prepare(hls);
    await preload.prepare(hls);
    expect(requests.map((url) => new URL(url).pathname)).toEqual([
      "/master.m3u8",
      "/low.m3u8",
      "/init.mp4",
      "/a.m4s",
      "/b.m4s",
    ]);
    expect(preload.take(hls.playback.url).size).toBe(5);
    expect(preload.take(hls.playback.url).size).toBe(0);
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
    const preload = new MediaPreloader();
    await preload.prepare(hls);
    expect(canceled).toBe(true);
    expect(preload.take(hls.playback.url).size).toBe(1);
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
    const preload = new MediaPreloader();
    const old = preload.prepare(media("old"));
    await preload.prepare(media("new"));
    expect(signals[0]!.aborted).toBe(true);
    release(new Response("stale"));
    await old;
    expect(preload.take(media("new").playback.url).size).toBe(1);
    expect(preload.take(media("old").playback.url).size).toBe(0);
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
    const preload = new MediaPreloader();
    await preload.prepare(media("next"));
    expect(preload.take(media("next").playback.url).size).toBe(0);
  });
  for (const unsupported of [
    "#EXTM3U\n#EXTINF:4,\nlive.ts",
    '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:4,\nencrypted.ts\n#EXT-X-ENDLIST',
    "#EXTM3U\n#EXT-X-BYTERANGE:10@0\nfile.ts\n#EXT-X-ENDLIST",
  ]) {
    it(`does not speculate on unsupported HLS: ${unsupported.split("\n")[1]}`, async () => {
      const fetcher = vi.fn(async () => new Response(unsupported));
      vi.stubGlobal("fetch", fetcher);
      const preload = new MediaPreloader();
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
    const preload = new MediaPreloader();
    await expect(preload.prepare(hls)).resolves.toBeUndefined();
    expect(permitsPreload({ saveData: true })).toBe(false);
    expect(permitsPreload({ effectiveType: "2g" })).toBe(false);
    expect(permitsPreload()).toBe(true);
  });
});
