import { useEffect, useState } from "react";

export const LS_KEYS = {
  attendeeText: "okinawa_ma26_attendee_text_v2",
  checks: "okinawa_ma26_checks_v2",
  notes: "okinawa_ma26_notes_v2",
} as const;

function readValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readValue(key, fallback));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private browsing or full storage can fail; keep the in-memory state.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
