import { requireNativeModule } from "expo";
import type { InterruptionSource } from "./session-interruptions";

// Provided by the version-pinned expo-video patch; never tied to a player.
export const interruptionSource =
  requireNativeModule<InterruptionSource>("ExpoVideo");
