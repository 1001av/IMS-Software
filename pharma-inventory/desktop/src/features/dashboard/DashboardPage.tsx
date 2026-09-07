import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { getDashboardSummary } from "@/services/dashboardService";
import { useCurrentPharmacyId } from "@/utils/useCurrentPharmacyId";
import { formatPaise } from "@/utils/currency";
import { useBusinessConfig } from "@/utils/businessConfig";
import type { DashboardSummary } from "@/types/domain";

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
  badge?: { text: string; variant: "neutral" | "warn" | "danger" | "ok" };
  isHighlight?: boolean;
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
  iconBg,
  iconColor,
  onClick,
  badge,
  isHighlight,
}: StatCardProps) {
  // Dynamically calculate font size so large numbers (e.g. ₹10,00,000 or ₹1,00,00,000)
  // automatically scale down to fit inside their containers without overflowing borders.
  const getFontSize = (val: string) => {
    if (val.length >= 17) return "text-base sm:text-lg";
    if (val.length >= 13) return "text-lg sm:text-xl";
    if (val.length >= 10) return "text-xl sm:text-2xl";
    return "text-2xl sm:text-3xl";
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        "card flex flex-col justify-between overflow-hidden min-w-0 transition-all duration-200 cursor-pointer group",
        "hover:-translate-y-1 hover:shadow-cardHover hover:border-brand/50 active:scale-[0.99]",
        isHighlight
          ? "border-brand/30 bg-gradient-to-br from-white via-white to-brandlight/25 hover:border-brand/60"
          : "hover:bg-slate-50/40"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-subink group-hover:text-ink transition-colors truncate">
          {label}
        </span>
        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200", iconBg, iconColor)}>
          {icon}
        </div>
      </div>

      <div className="min-w-0 mt-auto">
        <div
          className={clsx(
            getFontSize(value),
            "font-extrabold tracking-tight text-ink truncate block leading-tight group-hover:text-brand transition-colors"
          )}
          title={value}
        >
          {value}
        </div>
        {subtitle && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-subink min-w-0">
            {badge && (
              <span
                className={clsx(
                  "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                  badge.variant === "warn" && "bg-warnlight text-warn",
                  badge.variant === "danger" && "bg-dangerlight text-danger",
                  badge.variant === "ok" && "bg-oklight text-ok",
                  badge.variant === "neutral" && "bg-slate-100 text-subink"
                )}
              >
                {badge.text}
              </span>
            )}
            <span className="truncate text-subink/90">{subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const config = useBusinessConfig();
  const pharmacyId = useCurrentPharmacyId();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pharmacyName, setPharmacyName] = useState("");

  useEffect(() => {
    getDashboardSummary(pharmacyId).then(setSummary);
    setPharmacyName(localStorage.getItem("pharmacy_name") || config.appName);
  }, [pharmacyId, config.appName]);

  if (!summary) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-subink text-sm font-medium">
          <svg className="w-5 h-5 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading {config.itemLabel.toLowerCase()} metrics...
        </div>
      </div>
    );
  }

  const currentDateFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Good day, {pharmacyName}</h1>
          <p className="text-sm text-subink mt-0.5">Here is an overview of your {config.itemLabel.toLowerCase()} inventory and sales performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/billing")}
            className="btn-primary py-2 px-4 text-xs font-bold gap-1.5 flex items-center shadow-xs"
          >
            <span className="text-base font-bold leading-none">+</span>
            New Bill (POS)
          </button>
          <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-line rounded-lg text-xs font-medium text-subink shadow-subtle self-start sm:self-auto">
            <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {currentDateFormatted}
          </div>
        </div>
      </div>

      {/* Adaptive Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Today's Sales"
          value={formatPaise(summary.today_sales_paise || 0)}
          subtitle={`${summary.today_invoices_count || 0} bills today`}
          onClick={() => navigate("/billing")}
          isHighlight
          iconBg="bg-teal-50"
          iconColor="text-brand"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v8.25m0 0a11.95 11.95 0 0 1 4.5-1.05c3.27 0 6.27.99 8.75 2.7m-13.25-1.65v3.45m0 0a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6.75A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 2.25 6.75M16.5 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          }
        />

        <StatCard
          label={`Total ${config.itemLabelPlural}`}
          value={summary.total_medicines.toLocaleString("en-IN")}
          subtitle="Cataloged in database"
          onClick={() => navigate("/inventory")}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          }
        />

        <StatCard
          label="Total Units"
          value={summary.total_units.toLocaleString("en-IN")}
          subtitle="Physical items in stock"
          onClick={() => navigate("/inventory")}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          }
        />

        {/* Highlighted Inventory Value card with automatic scale-down */}
        <StatCard
          label="Inventory Value"
          value={formatPaise(summary.total_inventory_value_paise)}
          subtitle="Valuation at purchase cost"
          onClick={() => navigate("/inventory")}
          isHighlight
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 1 0 0-6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />

        <StatCard
          label="Low Stock"
          value={String(summary.low_stock_count)}
          subtitle={summary.low_stock_count > 0 ? "Items need reordering" : "Stock levels optimal"}
          onClick={() => navigate("/inventory?status=low_stock")}
          badge={summary.low_stock_count > 0 ? { text: "Action Needed", variant: "warn" } : { text: "Healthy", variant: "ok" }}
          iconBg={summary.low_stock_count > 0 ? "bg-amber-50" : "bg-slate-50"}
          iconColor={summary.low_stock_count > 0 ? "text-amber-600" : "text-subink"}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          }
        />

        <StatCard
          label="Expiring Soon"
          value={String(summary.expiring_soon_count)}
          subtitle={summary.expiring_soon_count > 0 ? "Expiring in 90 days" : "No near expiries"}
          onClick={() => navigate("/inventory?status=expiring_soon")}
          badge={summary.expiring_soon_count > 0 ? { text: "Review", variant: "danger" } : { text: "Good", variant: "ok" }}
          iconBg={summary.expiring_soon_count > 0 ? "bg-rose-50" : "bg-slate-50"}
          iconColor={summary.expiring_soon_count > 0 ? "text-rose-600" : "text-subink"}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Table */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-line/60">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink">Low Stock {config.itemLabelPlural}</h2>
                {summary.low_stock_medicines.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {summary.low_stock_medicines.length}
                  </span>
                )}
              </div>
              <button
                className="text-brand hover:text-brandhover text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                onClick={() => navigate("/inventory?status=low_stock")}
              >
                View all
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {summary.low_stock_medicines.length === 0 ? (
              <div className="py-10 text-center text-subink">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  ✓
                </div>
                <p className="text-sm font-medium text-ink">All stock levels healthy</p>
                <p className="text-xs text-subink mt-0.5">No {config.itemLabelPlural.toLowerCase()} are currently at or below minimum threshold.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-subink uppercase text-[10px] tracking-wider border-b border-line/40">
                      <th className="pb-2.5 font-bold">{config.itemLabel}</th>
                      <th className="pb-2.5 font-bold">Current Stock</th>
                      <th className="pb-2.5 font-bold">Min Threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {summary.low_stock_medicines.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-2.5 font-medium text-ink">{m.name}</td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                            {m.quantity} {m.unit}
                          </span>
                        </td>
                        <td className="py-2.5 text-subink font-medium">{m.minimum_stock_level} {m.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Expiring Soon Table */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-line/60">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink">Expiring Soon</h2>
                {summary.expiring_soon_medicines.length > 0 && (
                  <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {summary.expiring_soon_medicines.length}
                  </span>
                )}
              </div>
              <button
                className="text-brand hover:text-brandhover text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                onClick={() => navigate("/inventory?status=expiring_soon")}
              >
                View all
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {summary.expiring_soon_medicines.length === 0 ? (
              <div className="py-10 text-center text-subink">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  ✓
                </div>
                <p className="text-sm font-medium text-ink">No upcoming expirations</p>
                <p className="text-xs text-subink mt-0.5">All tracked {config.itemLabelPlural.toLowerCase()} have healthy expiry dates.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-subink uppercase text-[10px] tracking-wider border-b border-line/40">
                      <th className="pb-2.5 font-bold">{config.itemLabel}</th>
                      <th className="pb-2.5 font-bold">Batch</th>
                      <th className="pb-2.5 font-bold">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {summary.expiring_soon_medicines.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-2.5 font-medium text-ink">{m.name}</td>
                        <td className="py-2.5 text-subink font-mono text-[11px]">{m.batch_number || "—"}</td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700">
                            {m.expiry_date ? new Date(m.expiry_date).toLocaleDateString("en-IN") : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
