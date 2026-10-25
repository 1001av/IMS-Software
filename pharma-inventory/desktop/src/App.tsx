import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { query, runMigrations } from "@/database/client";
import { useBusinessConfig } from "@/utils/businessConfig";
import { syncWindowTitle } from "@/utils/windowTitle";
import { getCurrentSubscription } from "@/services/subscriptionService";
import { FirstRunSetup } from "@/features/settings/FirstRunSetup";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { BillingPage } from "@/features/billing/BillingPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { BackupPage } from "@/features/backup/BackupPage";
import { SubscriptionPage } from "@/features/subscription/SubscriptionPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import type { Pharmacy, Subscription } from "@/types/domain";

export default function App() {
  const [ready, setReady] = useState(false);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const activeConfig = useBusinessConfig();

  async function checkAppState() {
    try {
      await runMigrations();

      // 1. Check local database for an existing store/pharmacy record
      const pharmacies = await query<Pharmacy>("SELECT * FROM pharmacy LIMIT 1");
      let currentPharm: Pharmacy | null = null;
      if (pharmacies.length > 0) {
        currentPharm = pharmacies[0];
        localStorage.setItem("pharmacy_id", currentPharm.id);
        localStorage.setItem("pharmacy_name", currentPharm.name);
        setPharmacy(currentPharm);
      } else {
        setPharmacy(null);
      }

      // 2. Check local database for an active subscription key
      const sub = await getCurrentSubscription();
      setSubscription(sub);
    } catch (err) {
      console.error("Initialization failed", err);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    syncWindowTitle(`${activeConfig.appName} — ${activeConfig.tagline}`);
  }, [activeConfig]);

  useEffect(() => {
    checkAppState();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading {activeConfig.appName}...
        </div>
      </div>
    );
  }

  // FIRST-TIME FLOW:
  // Step 1: If store profile does not exist yet -> Registration Screen
  if (!pharmacy) {
    return <FirstRunSetup initialStep={1} onComplete={checkAppState} />;
  }

  // Step 2: If store exists but NO valid subscription key has been activated -> Key Activation Gate
  if (!subscription || subscription.status === "unactivated") {
    return (
      <FirstRunSetup
        initialStep={2}
        initialStoreName={pharmacy.name}
        initialOwnerName={pharmacy.owner_name}
        initialPhone={pharmacy.phone || ""}
        onComplete={checkAppState}
      />
    );
  }

  // SUBSEQUENT LAUNCHES:
  // Store is registered AND activated with genuine subscription key -> Directly open the IMS!
  // (If subscription has expired, AppShell displays the blocking Lockout Screen)
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
