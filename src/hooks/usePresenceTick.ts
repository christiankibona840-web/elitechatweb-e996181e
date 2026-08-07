import { useEffect, useState } from 'react';

/**
 * Re-renders the consuming component on an interval so that
 * time-derived presence labels ("last seen 3m ago", online dots)
 * stay truthful instead of freezing at the value they had on mount.
 */
export function usePresenceTick(intervalMs = 30000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}
