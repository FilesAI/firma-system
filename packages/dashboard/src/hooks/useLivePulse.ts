/**
 * useLivePulse — Tracks when data was last updated and provides a pulse indicator.
 * Shows a green pulse animation when data changed in the last 30 seconds.
 */
import { useState, useEffect, useRef } from "react";

export function useLivePulse(data: unknown, windowMs = 30_000) {
  const [isPulsing, setIsPulsing] = useState(false);
  const prevDataRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const serialized = JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    if (prevDataRef.current && serialized !== prevDataRef.current) {
      // Data changed — start pulsing
      setIsPulsing(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsPulsing(false), windowMs);
    }
    prevDataRef.current = serialized;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, windowMs]);

  return isPulsing;
}
