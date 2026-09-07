import { useOnlineStatus } from "@/utils/useOnlineStatus";

/**
 * Small, non-distracting status dot per product brief section 49.
 * Deliberately just text + a dot — no banners, no animation, since this is
 * ambient information, not an alert.
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <div className="flex items-center gap-2 text-sm text-subink" title={isOnline ? "Online" : "Offline mode — changes are saved locally"}>
      <span
        className={`inline-block w-2 h-2 rounded-full ${isOnline ? "bg-ok" : "bg-subink"}`}
        aria-hidden="true"
      />
      <span>{isOnline ? "Online" : "Offline mode"}</span>
    </div>
  );
}
