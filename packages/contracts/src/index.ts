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
    expiresAt: z.iso.datetime().nullable(),
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

export function parseSession(value: unknown): SessionPlan {
  const plan = SessionPlanSchema.parse(value);
  if (plan.expiresAt && Date.parse(plan.expiresAt) <= Date.now())
    throw new Error("Session plan has expired");
  return plan;
}

export function createHttpProvider(endpoint: string): SessionProvider {
  httpsUrl.parse(endpoint);
  return {
    async load(signal) {
      const request = new AbortController();
      const abort = () => request.abort();
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 15_000);
      try {
        const response = await fetch(endpoint, {
          signal: request.signal,
          credentials: "omit",
          headers: { Accept: "application/json" },
        });
        if (!response.ok)
          throw new Error(`Session request failed (${response.status})`);
        // No fixture fallback. Invalid, expired and failed API responses remain errors.
        return parseSession(await response.json());
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
