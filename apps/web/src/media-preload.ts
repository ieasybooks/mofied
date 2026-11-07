import type { MediaItem } from "@mofied/contracts";
import type Hls from "hls.js";
import type {
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
} from "hls.js";

export const PRELOAD_BYTES = 2 * 1024 * 1024;
const MP4_BYTES = 1024 * 1024;
type Resource = { data: ArrayBuffer; url: string; loadMs: number };
export type MediaWarmup = Map<string, Resource>;

/** One next item, two HLS segments at most, no playback or session callbacks.
 * Native HLS uses the browser HTTP cache; hls.js also consumes these bytes
 * directly. A browser may choose not to reuse its native media HTTP cache. */
export class MediaPreloader {
  private url: string | null = null;
  private abort: AbortController | null = null;
  private resources: MediaWarmup = new Map();

  prepare(item: MediaItem, nativeHls = false): Promise<void> {
    if (this.url === item.playback.url) return Promise.resolve();
    this.clear();
    this.url = item.playback.url;
    const abort = new AbortController();
    this.abort = abort;
    const resources = this.resources;
    const timer = setTimeout(() => abort.abort(), 8000);
    return this.load(item, resources, abort.signal, nativeHls)
      .catch(() => {
        /* Speculation must never fail or replace the current item. */
      })
      .finally(() => clearTimeout(timer));
  }

  suspend() {
    this.abort?.abort();
  }
  clear() {
    this.suspend();
    this.url = null;
    this.resources = new Map();
  }
  take(url: string): MediaWarmup {
    if (this.url !== url) return new Map();
    const resources = this.resources;
    this.clear();
    return resources;
  }

  private async load(
    item: MediaItem,
    resources: MediaWarmup,
    signal: AbortSignal,
    nativeHls: boolean,
  ) {
    let remaining = PRELOAD_BYTES;
    const read = async (url: string, limit: number, range = false) => {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password)
        throw new Error("Unsupported preload URL");
      signal.throwIfAborted();
      const started = performance.now();
      const response = await fetch(url, {
        signal,
        credentials: "omit",
        priority: "low",
        ...(range ? { headers: { Range: `bytes=0-${limit - 1}` } } : {}),
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
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
          throw new Error("Preload too large");
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit || size > remaining)
            throw new Error("Preload limit");
          chunks.push(value);
        }
        signal.throwIfAborted();
      } finally {
        await reader.cancel().catch(() => {});
      }
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
      // Partial MP4 bytes warm the HTTP cache but are never treated as a file.
      const contentRange = response.headers.get("content-range");
      const complete =
        response.status === 200 ||
        (contentRange &&
          new RegExp(`^bytes 0-${size - 1}/${size}$`).test(contentRange));
      if (!range || complete) resources.set(url, result);
      return result;
    };
    if (item.playback.mimeType === "video/mp4") {
      await read(item.playback.url, MP4_BYTES, true);
      return;
    }
    let url = item.playback.url;
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
        // Native HLS starts from the server's first rendition. hls.js starts
        // from its lowest level before estimating bandwidth. Warm one only.
        if (!nativeHls) variants.sort((a, b) => a.bandwidth - b.bandwidth);
        url = new URL(variants[0]!.path, resource.url).href;
        continue;
      }
      // Avoid stale live manifests and guessing encrypted/byte-range layouts.
      if (!lines.includes("#EXT-X-ENDLIST")) {
        resources.clear();
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

/** Keep hls.js lazy: this adapter has only type imports from the large engine. */
export function warmLoader(HlsClass: typeof Hls, resources: MediaWarmup) {
  return class extends HlsClass.DefaultConfig.loader {
    private stopped = false;
    override abort() {
      this.stopped = true;
      super.abort();
    }
    override destroy() {
      this.stopped = true;
      super.destroy();
    }
    override load(
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
    ) {
      const cached =
        !context.rangeStart && !context.rangeEnd
          ? resources.get(context.url)
          : undefined;
      if (!cached) return super.load(context, config, callbacks);
      this.context = context;
      this.stats.loaded = this.stats.total = cached.data.byteLength;
      const now = performance.now();
      // Use measured network time, not memory speed, for ABR estimation.
      this.stats.loading = {
        start: now - cached.loadMs,
        first: now - cached.loadMs,
        end: now,
      };
      queueMicrotask(() => {
        if (this.stopped) return;
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
