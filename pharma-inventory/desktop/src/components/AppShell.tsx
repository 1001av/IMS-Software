import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { getCurrentSubscription } from "@/services/subscriptionService";
import { useBusinessConfig } from "@/utils/businessConfig";
import { SubscriptionLockout } from "@/components/SubscriptionLockout";
import type { Subscription } from "@/types/domain";

const navItems = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    to: "/billing",
    label: "Billing",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0v8.25m0 0a11.95 11.95 0 0 1 4.5-1.05c3.27 0 6.27.99 8.75 2.7m-13.25-1.65v3.45m0 0a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6.75A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 2.25 6.75M16.5 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    to: "/inventory",
    label: "Inventory",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Reports",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    to: "/backup",
    label: "Backup",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    to: "/subscription",
    label: "Subscription",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.6 6.6 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
];

/** The persistent shell around every screen once a user is logged in. */
export function AppShell() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const location = useLocation();
  const config = useBusinessConfig();

  useEffect(() => {
    getCurrentSubscription().then(setSubscription).catch(console.error);
  }, [location.pathname]);

  // Synchronize OS Window Title and Document Title dynamically with active business profile
  useEffect(() => {
    const title = `${config.appName} — ${config.tagline}`;
    document.title = title;
    try {
      const win = getCurrentWindow();
      if (win && typeof win.setTitle === "function") {
        win.setTitle(title).catch(() => {});
      }
    } catch {
      // Browser environment fallback
    }
  }, [config]);

  return (
    <div className="flex h-screen bg-canvas print:h-auto print:bg-white print:overflow-visible">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-line/80 flex flex-col shadow-subtle z-20 print:hidden">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-line/50">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-brand/20 bg-white">
            {config.id === "agro" ? (
              <img src="/app-icon.png" alt="Agro Kendra Logo" className="w-full h-full object-contain" />
            ) : config.id === "pharma" ? (
              <div className="w-full h-full bg-teal-600 text-white flex items-center justify-center font-bold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.4" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
            ) : config.id === "kirana" ? (
              <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center font-bold">
                <span className="text-xl">🛒</span>
              </div>
            ) : (
              <div className="w-full h-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                <span className="text-xl">🏢</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink tracking-tight truncate">{config.appName}</div>
            <div className="text-[10px] font-semibold text-brand tracking-wide uppercase truncate">{config.badgeText}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-brand text-white shadow-sm font-semibold"
                    : "text-slate-600 hover:text-ink hover:bg-slate-50"
                )
              }
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Ambient Status */}
        <div className="px-4 py-3.5 border-t border-line/50 bg-slate-50/50">
          <OfflineIndicator />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:h-auto relative">
        {/* Blocking Lockout Modal when Expired (Per Phase 2 Requirements) */}
        {subscription?.status === "expired" && (
          <SubscriptionLockout
            subscription={subscription}
            onUnlocked={(updated) => setSubscription(updated)}
          />
        )}

        {/* Notice Banner when Expiring Soon (< 14 days) */}
        {subscription?.status === "expiring_soon" && (
          <div className="bg-warnlight border-b border-warn/20 px-6 py-2 text-xs text-warn flex items-center justify-between shrink-0 shadow-sm print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm">ℹ️</span>
              <span>
                <strong>Subscription Notice:</strong> Your {subscription.plan_name} expires on{" "}
                {new Date(subscription.expiry_date).toLocaleDateString("en-IN")}. Renew soon to avoid interruption.
              </span>
            </div>
            <Link to="/subscription" className="text-xs font-bold underline hover:opacity-80 shrink-0 ml-4">
              Renew Plan →
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-canvas print:bg-white print:overflow-visible print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
