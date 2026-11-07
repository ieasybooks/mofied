import type { MediaItem } from "@mofied/contracts";
import type Hls from "hls.js";
import type {
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
} from "hls.js";

export const PRELOAD_BYTES = 2 * 1024 * 1024;
const MP4_BYTES = 1024 * 1024;
const DEADLINE_MS = 8000;
const RETRY_DELAYS = [300, 1200];
type Resource = { data: ArrayBuffer; url: string; loadMs: number };
class PreloadLimit extends Error {}

/** A bounded, session-local warmup. Claiming it transfers ownership to the
 * current player, including in-flight reads; only that player may then dispose it. */
export class MediaWarmup extends Map<string, Resource> {
  private pending = new Map<string, Promise<Resource>>();
  private controller: AbortController | null = null;
  private running: Promise<void> | null = null;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private failures = 0;
  private enabled = false;
  private claimed = false;
  private complete = false;
  private disposed = false;

  constructor(
    readonly item: MediaItem,
    private nativeHls: boolean,
  ) {
    super();
  }

  resume(): Promise<void> {
    if (this.disposed || this.complete || this.claimed)
      return Promise.resolve();
    if (this.enabled) return this.running ?? Promise.resolve();
    this.enabled = true;
    this.failures = 0;
    return this.start();
  }

  suspend() {
    this.enabled = false;
    this.generation++;
    clearTimeout(this.retryTimer);
    clearTimeout(this.deadline);
    this.controller?.abort();
    this.controller = null;
    this.running = null;
    this.pending.clear();
  }

  reconnect() {
    if (!this.enabled || this.running) return;
    clearTimeout(this.retryTimer);
    this.enabled = false;
    void this.resume();
  }

  claim() {
    this.claimed = true;
    // The active loader owns retries now. Keep its already-started work alive.
    clearTimeout(this.retryTimer);
    return this;
  }

  dispose() {
    this.disposed = true;
    this.suspend();
    this.clear();
  }

  /** Never blocks on speculative retries or on a different rendition. */
  async wait(url: string): Promise<Resource | undefined> {
    const cached = this.get(url);
    if (cached) return cached;
    await this.pending.get(url)?.catch(() => undefined);
    return this.get(url);
  }

  private start(): Promise<void> {
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.deadline = setTimeout(() => controller.abort(), DEADLINE_MS);
    this.running = this.load(controller.signal)
      .then(() => {
        if (generation === this.generation) this.complete = true;
      })
      .catch((error: unknown) => {
        if (generation !== this.generation) return;
        if (error instanceof PreloadLimit) this.complete = true;
        else if (this.enabled && !this.claimed) {
          const delay = RETRY_DELAYS[this.failures++];
          if (delay !== undefined)
            this.retryTimer = setTimeout(() => {
              if (
                generation === this.generation &&
                this.enabled &&
                !this.claimed
              )
                void this.start();
            }, delay);
        }
      })
      .finally(() => {
        if (generation === this.generation) {
          clearTimeout(this.deadline);
          this.running = null;
          this.controller = null;
        }
      });
    return this.running;
  }

  private async load(signal: AbortSignal) {
    let remaining =
      PRELOAD_BYTES -
      [...this.values()].reduce((n, r) => n + r.data.byteLength, 0);
    const read = (
      url: string,
      limit: number,
      range = false,
    ): Promise<Resource> => {
      signal.throwIfAborted();
      const cached = this.get(url);
      if (cached) return Promise.resolve(cached);
      const request = (async () => {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password)
          throw new PreloadLimit("Unsupported preload URL");
        const started = performance.now();
        const response = await fetch(url, {
          signal,
          credentials: "omit",
          priority: "low",
          ...(range ? { headers: { Range: `bytes=0-${limit - 1}` } } : {}),
        });
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          )
            throw new PreloadLimit("Preload unavailable");
          throw new Error("Preload unavailable");
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          if (
            Number(response.headers.get("content-length")) >
            Math.min(limit, remaining)
          )
            throw new PreloadLimit("Preload too large");
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit || size > remaining)
              throw new PreloadLimit("Preload limit");
            chunks.push(value);
          }
          signal.throwIfAborted();
        } finally {
          await reader.cancel().catch(() => {});
        }
        // Suspension can race the asynchronous reader cleanup as well as reads.
        signal.throwIfAborted();
        remaining -= size;
        const data = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.length;
        }
        const result = {
          data: data.buffer,
          url: response.url || url,
          loadMs: Math.max(1, performance.now() - started),
        };
        const contentRange = response.headers.get("content-range");
        const complete =
          response.status === 200 ||
          (contentRange &&
            new RegExp(`^bytes 0-${size - 1}/${size}$`).test(contentRange));
        // Partial MP4 bytes may warm HTTP cache, but cannot become a playable blob.
        if (!range || complete) this.set(url, result);
        return result;
      })();
      this.pending.set(url, request);
      void request
        .finally(() => {
          if (this.pending.get(url) === request) this.pending.delete(url);
        })
        .catch(() => {});
      return request;
    };
    if (this.item.playback.mimeType === "video/mp4") {
      await read(this.item.playback.url, MP4_BYTES, true);
      return;
    }
    let url = this.item.playback.url;
    for (let depth = 0; depth < 3; depth++) {
      const resource = await read(url, 64 * 1024);
      const text = new TextDecoder().decode(resource.data);
      if (!text.startsWith("#EXTM3U")) return;
      const lines = text.split(/\r?\n/).map((line) => line.trim());
      const variants = lines.flatMap((line, index) => {
        if (!line.startsWith("#EXT-X-STREAM-INF:")) return [];
        const path = lines[index + 1];
        return path && !path.startsWith("#")
          ? [
              {
                path,
                bandwidth: Number(
                  /(?:^|,)BANDWIDTH=(\d+)/.exec(line.slice(18))?.[1] ??
                    Infinity,
                ),
              },
            ]
          : [];
      });
      if (variants.length) {
        if (!this.nativeHls) variants.sort((a, b) => a.bandwidth - b.bandwidth);
        url = new URL(variants[0]!.path, resource.url).href;
        continue;
      }
      if (!lines.includes("#EXT-X-ENDLIST")) {
        this.clear();
        return;
      }
      if (lines.some((line) => /^#EXT-X-(KEY|BYTERANGE):/.test(line))) return;
      const map = lines.find((line) => line.startsWith("#EXT-X-MAP:"));
      if (map) {
        if (map.includes("BYTERANGE=")) return;
        const uri = /URI="([^"]+)"/.exec(map)?.[1];
        if (uri) await read(new URL(uri, resource.url).href, remaining);
      }
      const segments = lines
        .filter((line) => line && !line.startsWith("#"))
        .slice(0, 2);
      for (const segment of segments)
        await read(new URL(segment, resource.url).href, remaining);
      return;
    }
  }
}

/** One upcoming item. Completed bytes survive pause; cancelled work can resume. */
export class MediaPreloader {
  private target: MediaWarmup | null = null;
  prepare(item: MediaItem, nativeHls = false): Promise<void> {
    if (this.target?.item.playback.url !== item.playback.url) {
      this.clear();
      this.target = new MediaWarmup(item, nativeHls);
    }
    return this.target!.resume();
  }
  suspend() {
    this.target?.suspend();
  }
  reconnect() {
    this.target?.reconnect();
  }
  clear() {
    this.target?.dispose();
    this.target = null;
  }
  take(url: string): MediaWarmup | undefined {
    if (this.target?.item.playback.url !== url) return undefined;
    const target = this.target;
    this.target = null;
    return target.claim();
  }
}

/** No runtime engine import here: MP4 and unsupported browsers keep it lazy. */
export function warmLoader(HlsClass: typeof Hls, resources?: MediaWarmup) {
  return class extends HlsClass.DefaultConfig.loader {
    private generation = 0;
    override abort() {
      this.generation++;
      super.abort();
    }
    override destroy() {
      this.generation++;
      super.destroy();
    }
    override load(
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
    ) {
      const generation = ++this.generation;
      const pending =
        !context.rangeStart && !context.rangeEnd
          ? resources?.wait(context.url)
          : undefined;
      if (!pending) return super.load(context, config, callbacks);
      this.context = context;
      void pending.then((cached) => {
        if (generation !== this.generation) return;
        if (!cached) return super.load(context, config, callbacks);
        this.stats.loaded = this.stats.total = cached.data.byteLength;
        const now = performance.now();
        // Network speed, not memory speed, must feed the quality estimator.
        this.stats.loading = {
          start: now - cached.loadMs,
          first: now - cached.loadMs,
          end: now,
        };
        callbacks.onSuccess(
          {
            url: cached.url,
            code: 200,
            data:
              context.responseType === "arraybuffer"
                ? cached.data.slice(0)
                : new TextDecoder().decode(cached.data),
          },
          this.stats,
          context,
          null,
        );
      });
    }
  };
}

export function permitsPreload(connection?: {
  saveData?: boolean;
  effectiveType?: string;
}) {
  return (
    !connection?.saveData &&
    !["slow-2g", "2g"].includes(connection?.effectiveType ?? "")
  );
}
