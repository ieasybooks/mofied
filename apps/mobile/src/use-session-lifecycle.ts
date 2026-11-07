import { useEffect } from "react";
import type { SessionController } from "@mofied/session";
import { interruptionSource } from "./interruption-source";
import { watchSessionInterruptions } from "./session-interruptions";

export function useSessionLifecycle(session: SessionController) {
  useEffect(() => {
    const stopInterruptions = interruptionSource
      ? watchSessionInterruptions(interruptionSource, session)
      : () => {};
    const timer = setInterval(session.tick, 100);
    return () => {
      stopInterruptions();
      clearInterval(timer);
    };
  }, [session]);
}
