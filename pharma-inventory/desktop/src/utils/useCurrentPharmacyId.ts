/**
 * MVP is single-pharmacy, single-computer (product brief section 7) — the
 * pharmacy id created during first-run setup is cached in localStorage and
 * used everywhere instead of a full multi-tenant lookup. When multi-device
 * sync arrives later, this becomes the seam where a "current pharmacy"
 * concept gets swapped for something richer.
 */
export function useCurrentPharmacyId(): string {
  const id = localStorage.getItem("pharmacy_id");
  if (!id) {
    throw new Error("No pharmacy configured — first-run setup should run before this is used.");
  }
  return id;
}
