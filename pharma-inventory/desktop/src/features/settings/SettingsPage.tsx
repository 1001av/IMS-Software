import { useEffect, useState } from "react";
import clsx from "clsx";
import { execute, query } from "@/database/client";
import { useCurrentPharmacyId } from "@/utils/useCurrentPharmacyId";
import {
  BUSINESS_CONFIGS,
  getActiveBusinessType,
  setActiveBusinessType,
  type BusinessType,
} from "@/utils/businessConfig";
import type { DatabaseInfo, Pharmacy } from "@/types/domain";
import { getDatabaseInfo } from "@/services/backupService";

export function SettingsPage() {
  const pharmacyId = useCurrentPharmacyId();
  const [businessType, setBusinessType] = useState<BusinessType>(getActiveBusinessType());
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [licenses, setLicenses] = useState<Record<string, string>>({
    license_pesticide: "",
    license_fertilizer: "",
    license_seed: "",
    license_drug: "",
    gstin: "",
  });

  const [expiringSoonDays, setExpiringSoonDays] = useState("90");
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeConfig = BUSINESS_CONFIGS[businessType];

  async function load() {
    setLoading(true);
    try {
      const [p] = await query<Pharmacy>("SELECT * FROM pharmacy WHERE id = ?", [pharmacyId]);
      if (p) {
        setPharmacy(p);
        setName(p.name);
        setOwnerName(p.owner_name);
        setPhone(p.phone || "");
        setEmail(p.email || "");
        setAddress(p.address || "");
      }

      // Load settings
      const settings = await query<{ key: string; value: string }>("SELECT * FROM settings");
      const licMap: Record<string, string> = { ...licenses };

      for (const s of settings) {
        if (s.key === "business_type") {
          setBusinessType((s.value as BusinessType) || "agro");
          setActiveBusinessType((s.value as BusinessType) || "agro");
        } else if (s.key === "expiring_soon_days") {
          setExpiringSoonDays(s.value);
        } else if (s.key.startsWith("license_") || s.key === "gstin") {
          licMap[s.key] = s.value;
        }
      }
      setLicenses(licMap);

      const info = await getDatabaseInfo();
      setDbInfo(info);
    } catch (e: any) {
      console.error(e);
      setMessage({ type: "error", text: "Failed to load settings." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [pharmacyId]);

  const handleLicenseChange = (key: string, val: string) => {
    setLicenses((prev) => ({ ...prev, [key]: val }));
  };

  async function handleSave() {
    if (!name.trim() || !ownerName.trim()) {
      setMessage({ type: "error", text: "Store name and owner name cannot be empty." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      await execute(
        `UPDATE pharmacy SET name = ?, owner_name = ?, phone = ?, email = ?, address = ?, updated_at = ?
         WHERE id = ?`,
        [name.trim(), ownerName.trim(), phone.trim() || null, email.trim() || null, address.trim() || null, now, pharmacyId]
      );

      // Save business type
      await execute(
        `INSERT INTO settings (key, value) VALUES ('business_type', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [businessType]
      );
      setActiveBusinessType(businessType);

      // Save expiry days
      await execute(
        `INSERT INTO settings (key, value) VALUES ('expiring_soon_days', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [expiringSoonDays]
      );

      // Save all licenses
      for (const [k, v] of Object.entries(licenses)) {
        await execute(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [k, v.trim()]
        );
      }

      localStorage.setItem("pharmacy_name", name.trim());
      setMessage({ type: "success", text: "Settings saved successfully! Application updated." });
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !pharmacy) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-subink text-sm font-medium">
          <svg className="w-5 h-5 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <span>⚙️</span> Settings & Business Configuration
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure your business vertical, statutory licenses, store profile, and thresholds.
        </p>
      </div>

      {message && (
        <div
          className={clsx(
            "p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in",
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          )}
        >
          <span className="text-base">{message.type === "success" ? "✓" : "⚠️"}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Assigned Business Vertical (Locked - Per User Requirement) */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🏢</span> Assigned Business Edition
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Vertical edition is permanently bound during initial registration and secured by your offline license.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active Product Edition
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50/80 border border-line/80 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white border border-line flex items-center justify-center text-2xl shadow-xs shrink-0">
              {businessType === "agro" ? "🌱" : businessType === "pharma" ? "💊" : businessType === "kirana" ? "🛒" : "🏢"}
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm">{activeConfig.appName}</div>
              <div className="text-xs text-slate-500 font-medium">{activeConfig.tagline}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Item classification: <span className="font-semibold text-slate-700">{activeConfig.itemLabelPlural}</span> • Invoicing: <span className="font-semibold text-slate-700">{activeConfig.receiptTitle}</span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] text-slate-400 block">Vertical Switcher:</span>
            <span className="text-xs font-bold text-slate-600 bg-slate-200/70 px-2.5 py-1 rounded-md inline-block mt-0.5">
              🔒 Locked to Device
            </span>
          </div>
        </div>
      </div>

      {/* Store Profile */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {businessType === "agro" ? "Agro Agency / Krishi Kendra Profile" : "Store Profile"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Basic details displayed on cash memos and reports.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="label">
              {businessType === "agro" ? "Shop / Krishi Kendra Name *" : "Store Name *"}
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">Owner / Proprietor Name *</label>
            <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label className="label">Email Address</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="label">Physical Address / Market Location</label>
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Near Bus Stand, Main Market, Tehsil & Dist"
            />
          </div>
        </div>
      </div>

      {/* Statutory & Agricultural Licenses */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {businessType === "agro" ? "Agricultural Licenses (Department of Agriculture)" : "Licenses & Registrations"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            These statutory numbers print directly on farmer cash memos and tax invoices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {activeConfig.licenseFields.map((field) => (
            <div key={field.key}>
              <label className="label">{field.label}</label>
              <input
                className="input"
                value={licenses[field.key] || ""}
                onChange={(e) => handleLicenseChange(field.key, e.target.value)}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Expiry Alert Preferences */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3">
          <h2 className="text-base font-bold text-slate-900">Expiry Alert Threshold</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pesticides, bio-chemicals, and seed germination expire over time. Choose how early you want alerts.
          </p>
        </div>

        <div className="max-w-xs text-xs">
          <label className="label">Expiring soon alert threshold</label>
          <select
            className="input cursor-pointer"
            value={expiringSoonDays}
            onChange={(e) => setExpiringSoonDays(e.target.value)}
          >
            <option value="30">30 Days ahead (1 Month)</option>
            <option value="60">60 Days ahead (2 Months)</option>
            <option value="90">90 Days ahead (3 Months - Recommended)</option>
            <option value="180">180 Days ahead (6 Months)</option>
            <option value="365">365 Days ahead (1 Year)</option>
          </select>
        </div>
      </div>

      {/* Database Health */}
      {dbInfo && (
        <div className="card shadow-card space-y-3 bg-slate-50/50">
          <div className="border-b border-line/60 pb-2">
            <h2 className="text-sm font-bold text-slate-900">Offline SQLite Database Status</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500">Database File: </span>
              <span className="font-mono text-slate-800 font-bold">{dbInfo.path}</span>
            </div>
            <div>
              <span className="text-slate-500">File Size: </span>
              <span className="font-mono text-slate-800">{(dbInfo.size_bytes / 1024).toFixed(1)} KB</span>
            </div>
            <div>
              <span className="text-slate-500">Storage Mode: </span>
              <span className="font-mono text-emerald-700 font-semibold">100% Offline (WAL Mode)</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button className="btn-primary py-2.5 px-6 font-bold shadow-sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving Changes..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
