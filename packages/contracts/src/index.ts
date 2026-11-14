import { z } from "zod";

const httpsUrl = z
  .url()
  .refine((value) => new URL(value).protocol === "https:", "HTTPS is required");
const faqiehUrl = httpsUrl.refine(
  (value) => new URL(value).hostname === "faqieh.com",
  "Expected a Faqieh page",
);
const id = z.string().min(1).max(160);
const milliseconds = z.number().int().nonnegative();

export const MediaItemSchema = z.object({
  kind: z.literal("media"),
  id,
  mediaId: id,
  title: z.string().min(1).max(2000),
  pageUrl: faqiehUrl,
  posterUrl: httpsUrl.nullable(),
  durationMs: milliseconds.positive(),
  playback: z.object({
    url: httpsUrl,
    mimeType: z.enum(["application/vnd.apple.mpegurl", "video/mp4"]),
  }),
  speaker: z.object({
    id,
    name: z.string().min(1),
    pageUrl: faqiehUrl,
    imageUrl: httpsUrl.nullable(),
  }),
});

export const ReminderItemSchema = z.object({
  kind: z.literal("reminder"),
  id,
  durationMs: milliseconds.positive().max(300_000),
  content: z.object({
    kind: z.enum(["quran", "text"]),
    body: z.string().min(1).max(10_000),
    citation: z.string(),
    source: z.string(),
  }),
});

export const SessionItemSchema = z.discriminatedUnion("kind", [
  MediaItemSchema,
  ReminderItemSchema,
]);
export const SessionPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    locale: z.enum(["ar", "en"]),
    policy: z.object({
      maxActiveMs: milliseconds.positive().max(86_400_000),
      limitBehavior: z.literal("finish-current-item"),
      maxConsecutiveFailures: z.number().int().min(1).max(10),
    }),
    items: z.array(SessionItemSchema).min(1).max(250),
    replacements: z.array(MediaItemSchema).max(25),
    ending: z.object({ title: z.string().min(1), body: z.string().min(1) }),
  })
  .superRefine((plan, context) => {
    const ids = [...plan.items, ...plan.replacements].map((item) => item.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", message: "Item ids must be unique" });
  });

export type MediaItem = z.infer<typeof MediaItemSchema>;
export type ReminderItem = z.infer<typeof ReminderItemSchema>;
export type SessionItem = z.infer<typeof SessionItemSchema>;
export type SessionPlan = z.infer<typeof SessionPlanSchema>;
export type SessionProvider = {
  load(signal?: AbortSignal): Promise<SessionPlan>;
};

/** Public, anonymous Faqieh session endpoint. UI language never replaces a live plan. */
export const DEFAULT_SESSION_API_URL =
  "https://faqieh.com/api/v1/mofied/session?locale=ar";

export type SessionLoadErrorCode =
  | "configuration"
  | "network"
  | "http"
  | "invalid-json"
  | "invalid-plan"
  | "timeout"
  | "aborted";

export class SessionLoadError extends Error {
  constructor(
    readonly code: SessionLoadErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SessionLoadError";
  }
}

/** Keep diagnostics useful without logging signed URLs, payloads or user state. */
export function sessionLoadDiagnostic(error: unknown) {
  return error instanceof SessionLoadError
    ? {
        category: error.code,
        ...(error.status === undefined ? {} : { status: error.status }),
      }
    : { category: "unknown" as const };
}

export function parseSession(value: unknown): SessionPlan {
  const result = SessionPlanSchema.safeParse(value);
  if (!result.success)
    throw new SessionLoadError("invalid-plan", "Invalid session plan");
  return result.data;
}

export function createHttpProvider(
  endpoint: string,
  requestFetch?: typeof fetch,
): SessionProvider {
  if (!httpsUrl.safeParse(endpoint).success)
    throw new SessionLoadError(
      "configuration",
      "Session API must be configured with an HTTPS URL",
    );
  return {
    async load(signal) {
      if (signal?.aborted)
        throw new SessionLoadError("aborted", "Session request cancelled");
      const request = new AbortController();
      const abort = () => request.abort();
      signal?.addEventListener("abort", abort, { once: true });
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        abort();
      }, 15_000);
      try {
        const response = await (requestFetch ?? fetch)(endpoint, {
          signal: request.signal,
          credentials: "omit",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok)
          throw new SessionLoadError(
            "http",
            `Session request failed (${response.status})`,
            response.status,
          );
        const value = await response.json().catch((error: unknown) => {
          if (error instanceof SyntaxError)
            throw new SessionLoadError(
              "invalid-json",
              "Session response is not valid JSON",
            );
          throw error;
        });
        // No fixture fallback. Invalid and failed API responses remain errors.
        return parseSession(value);
      } catch (error) {
        if (error instanceof SessionLoadError) throw error;
        if (request.signal.aborted)
          throw new SessionLoadError(
            timedOut ? "timeout" : "aborted",
            timedOut
              ? "Session request timed out"
              : "Session request cancelled",
          );
        throw new SessionLoadError("network", "Session network request failed");
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
