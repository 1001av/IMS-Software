import { useEffect, useState } from "react";

/**
 * Tracks browser-reported connectivity. This drives the small Online/Offline
 * indicator (product brief section 49) and gates cloud-only actions (license
 * re-verification, cloud backup) — it never gates core inventory operations.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
