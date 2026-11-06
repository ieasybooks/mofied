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
export const sessionStorageKey = `mofied.session.v1.${usesFixture ? "development" : "production"}`;

export async function loadSession(signal?: AbortSignal): Promise<SessionPlan> {
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
    );
  }
  return createHttpProvider(configuredEndpoint || DEFAULT_SESSION_API_URL).load(
    signal,
  );
}
