import { useEffect, useMemo, useState } from "react";

export const LOADING_NOTICE_MS = 750;

/** Quiet poster/frame handoffs; announce only a sustained wait. Each source,
 * pause/resume and new stall gets its own timer, including rapid history visits. */
export function useLoadingNotice(source: object, waiting: boolean) {
  const episode = useMemo(() => ({}), [source, waiting]);
  const [shown, setShown] = useState<object | null>(null);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setShown(episode), LOADING_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [episode, waiting]);
  return waiting && shown === episode;
}
