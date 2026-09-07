import type { Medicine } from "@/types/domain";

function getStatus(m: Medicine, expiringSoonDays: number): { label: string; bg: string; dot: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (m.expiry_date) {
    const expiry = new Date(m.expiry_date);
    if (expiry < today) {
      return { label: "Expired", bg: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20", dot: "bg-rose-500" };
    }
    const soonCutoff = new Date(today);
    soonCutoff.setDate(soonCutoff.getDate() + expiringSoonDays);
    if (expiry <= soonCutoff) {
      return { label: "Expiring Soon", bg: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20", dot: "bg-amber-500" };
    }
  }
  if (m.quantity <= m.minimum_stock_level) {
    return { label: "Low Stock", bg: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20", dot: "bg-orange-500" };
  }
  return { label: "In Stock", bg: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20", dot: "bg-emerald-500" };
}

export function StatusBadge({ medicine, expiringSoonDays = 90 }: { medicine: Medicine; expiringSoonDays?: number }) {
  const { label, bg, dot } = getStatus(medicine, expiringSoonDays);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
