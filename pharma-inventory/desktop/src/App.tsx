import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { query, runMigrations } from "@/database/client";
import { setActiveBusinessType } from "@/utils/businessConfig";
import { FirstRunSetup } from "@/features/settings/FirstRunSetup";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { BillingPage } from "@/features/billing/BillingPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { BackupPage } from "@/features/backup/BackupPage";
import { SubscriptionPage } from "@/features/subscription/SubscriptionPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import type { Pharmacy } from "@/types/domain";

export default function App() {
  const [ready, setReady] = useState(false);
  const [hasPharmacy, setHasPharmacy] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      try {
        await runMigrations();

        // Check local database for an existing pharmacy record
        const pharmacies = await query<Pharmacy>("SELECT * FROM pharmacy LIMIT 1");
        if (pharmacies.length > 0) {
          const p = pharmacies[0];
          localStorage.setItem("pharmacy_id", p.id);
          localStorage.setItem("pharmacy_name", p.name);

          // Automatically load previously assigned business vertical
          const typeSetting = await query<{ value: string }>(
            "SELECT value FROM settings WHERE key = 'business_type' LIMIT 1"
          );
          if (typeSetting.length > 0 && typeSetting[0].value) {
            setActiveBusinessType(typeSetting[0].value as any);
          }

          setHasPharmacy(true);
        } else {
          setHasPharmacy(false);
        }
      } catch (err) {
        console.error("Initialization failed", err);
      } finally {
        setReady(true);
      }
    }

    init();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-subink">
        Loading Pharma Inventory...
      </div>
    );
  }

  if (!hasPharmacy) {
    return <FirstRunSetup onComplete={() => setHasPharmacy(true)} />;
  }

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
