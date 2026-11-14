import {
  createHttpProvider,
  DEFAULT_SESSION_API_URL,
  type SessionPlan,
} from "@mofied/contracts";

const configuredEndpoint = process.env.EXPO_PUBLIC_SESSION_API_URL;
const fixtureName = __DEV__ ? process.env.EXPO_PUBLIC_FIXTURE : undefined;
const usesFixture =
  __DEV__ &&
  !configuredEndpoint &&
  ["normal", "long-title", "missing-portrait", "unavailable"].includes(
    fixtureName ?? "",
  );

export async function loadSession(
  signal?: AbortSignal,
  start?: string,
): Promise<SessionPlan> {
  if (__DEV__ && usesFixture) {
    const { fixture } = await import("@mofied/fixtures");
    signal?.throwIfAborted();
    const name = process.env.EXPO_PUBLIC_FIXTURE;
    return fixture(
      name === "long-title" ||
        name === "missing-portrait" ||
        name === "unavailable"
        ? name
        : "normal",
      start,
    );
  }
  return createHttpProvider(configuredEndpoint || DEFAULT_SESSION_API_URL).load(
    signal,
    { start },
  );
}
