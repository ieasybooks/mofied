import { createHttpProvider, type SessionPlan } from "@mofied/contracts";

export async function loadSession(signal?: AbortSignal): Promise<SessionPlan> {
  const endpoint = process.env.EXPO_PUBLIC_SESSION_API_URL;
  if (__DEV__ && !endpoint) {
    const { fixture } = await import("@mofied/fixtures");
    signal?.throwIfAborted();
    const name = process.env.EXPO_PUBLIC_FIXTURE;
    return fixture(
      name === "long-title" ||
        name === "missing-portrait" ||
        name === "unavailable"
        ? name
        : "normal",
    );
  }
  if (!endpoint) throw new Error("Session API is not configured");
  return createHttpProvider(endpoint).load(signal);
}
