import {
  createHttpProvider,
  SessionLoadError,
  parseSession,
  type SessionPlan,
  DEFAULT_SESSION_API_URL,
} from "@mofied/contracts";

const configuredEndpoint = import.meta.env.VITE_SESSION_API_URL;
const query =
  import.meta.env.DEV && !configuredEndpoint
    ? new URLSearchParams(location.search)
    : null;
export const usesFixture =
  import.meta.env.DEV &&
  !!query &&
  (query.has("test-session") ||
    ["normal", "long-title", "missing-portrait", "unavailable"].includes(
      query.get("fixture") ?? "",
    ));

export async function loadSession(
  signal?: AbortSignal,
  start?: string,
): Promise<SessionPlan> {
  if (import.meta.env.DEV && usesFixture) {
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
      const response = await fetch(
        `/__test/session${start ? `?start=${encodeURIComponent(start)}` : ""}`,
        { signal },
      );
      if (!response.ok)
        throw new SessionLoadError(
          "http",
          "Test session request failed",
          response.status,
        );
      return parseSession(await response.json());
    }
    signal?.throwIfAborted();
    return fixture(selected, start);
  }
  const endpoint = configuredEndpoint || DEFAULT_SESSION_API_URL;
  if (import.meta.env.DEV && !configuredEndpoint) {
    return createHttpProvider(endpoint, (url, init) =>
      fetch(`/__mofied/session${new URL(String(url)).search}`, init),
    ).load(signal, { start });
  }
  return createHttpProvider(endpoint).load(signal, { start });
}
