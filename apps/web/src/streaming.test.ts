import { afterEach, describe, expect, it, vi } from "vitest";
import { canBufferHls } from "./streaming";

afterEach(() => vi.unstubAllGlobals());
describe("HLS buffering capability", () => {
  it("uses iPhone ManagedMediaSource when classic MediaSource is absent", () => {
    vi.stubGlobal("MediaSource", undefined);
    vi.stubGlobal("ManagedMediaSource", { isTypeSupported: () => true });
    expect(canBufferHls()).toBe(true);
  });
  it("uses classic MediaSource where both APIs exist, matching the engine configuration", () => {
    vi.stubGlobal("MediaSource", { isTypeSupported: () => true });
    vi.stubGlobal("ManagedMediaSource", { isTypeSupported: () => false });
    expect(canBufferHls()).toBe(true);
  });
  it("retains native fallback when neither streaming API exists", () => {
    for (const name of [
      "MediaSource",
      "ManagedMediaSource",
      "WebKitMediaSource",
    ])
      vi.stubGlobal(name, undefined);
    expect(canBufferHls()).toBe(false);
  });
  it("does not select a streaming API without the required video and audio codec support", () => {
    vi.stubGlobal("MediaSource", { isTypeSupported: () => false });
    expect(canBufferHls()).toBe(false);
  });
});
