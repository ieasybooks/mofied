import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionController } from "@mofied/session";
import { interruptionSource } from "./interruption-source";
import { watchSessionInterruptions } from "./session-interruptions";

export function useSessionLifecycle(
  session: SessionController,
  storageKey: string,
) {
  useEffect(() => {
    const stopInterruptions = interruptionSource
      ? watchSessionInterruptions(interruptionSource, session)
      : () => {};
    const timer = setInterval(session.tick, 100);
    let disposed = false;
    let pendingWrite = Promise.resolve();
    const persist = () => {
      const value = session.serialize();
      // Serialize writes so an old save cannot recreate a completed session.
      pendingWrite = pendingWrite
        .then(() =>
          value
            ? AsyncStorage.setItem(storageKey, value)
            : AsyncStorage.removeItem(storageKey),
        )
        .catch(() => {});
    };
    const saveTimer = setInterval(persist, 1500);
    const unsubscribe = session.subscribe(() => {
      if (session.getSnapshot().status === "ended") persist();
    });
    const subscription = AppState.addEventListener("change", (next) => {
      if (disposed || Platform.OS === "web") return;
      if (next === "background") {
        session.setBackgrounded(true);
        persist();
      } else if (next === "active") session.setBackgrounded(false);
      // Inactive/blur alone includes Control Center / notification drawer.
    });
    return () => {
      disposed = true;
      stopInterruptions();
      clearInterval(timer);
      clearInterval(saveTimer);
      unsubscribe();
      subscription.remove();
      persist();
    };
  }, [session, storageKey]);
}
