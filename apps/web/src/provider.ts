import {
  createHttpProvider,
  SessionLoadError,
  parseSession,
  type SessionPlan,
} from "@mofied/contracts";

export async function loadSession(signal?: AbortSignal): Promise<SessionPlan> {
  if (import.meta.env.DEV && !import.meta.env.VITE_SESSION_API_URL) {
    // A same-origin development endpoint lets E2E tests exercise the real transport.
    // Production builds contain neither the fixture import nor this branch.
    const { fixture } = await import("@mofied/fixtures");
    const name = new URLSearchParams(location.search).get("fixture");
    const selected =
      name === "long-title" ||
      name === "missing-portrait" ||
      name === "unavailable"
        ? name
        : "normal";
    if (new URLSearchParams(location.search).has("test-session")) {
      const response = await fetch("/__test/session", { signal });
      if (!response.ok)
        throw new SessionLoadError(
          "http",
          "Test session request failed",
          response.status,
        );
      return parseSession(await response.json());
    }
    signal?.throwIfAborted();
    return fixture(selected);
  }
  const endpoint = import.meta.env.VITE_SESSION_API_URL;
  if (!endpoint)
    throw new SessionLoadError(
      "configuration",
      "Session API is not configured",
    );
  return createHttpProvider(endpoint).load(signal);
}
