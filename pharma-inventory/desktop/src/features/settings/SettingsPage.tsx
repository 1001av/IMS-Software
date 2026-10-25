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
import {
  checkForAppUpdates,
  downloadAndApplyUpdate,
  UpdateCheckResult,
  CURRENT_APP_VERSION,
} from "@/services/updateService";
import {
  getCloudDeviceInfo,
  setCloudDeviceInfo,
  CloudDeviceInfo,
} from "@/services/cloudVaultService";

export function SettingsPage() {
  const pharmacyId = useCurrentPharmacyId();
  const [businessType, setBusinessType] = useState<BusinessType>(getActiveBusinessType());
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Software Update State
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number } | null>(null);

  // Cloud Device & Multi-Device State
  const [cloudInfo, setCloudInfo] = useState<CloudDeviceInfo | null>(null);

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

  async function handleCheckForUpdates() {
    setCheckingUpdate(true);
    setUpdateResult(null);
    try {
      const res = await checkForAppUpdates();
      setUpdateResult(res);
    } catch (err: any) {
      setUpdateResult({ available: false, error: err?.message || "Failed to check for updates." });
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleInstallUpdate() {
    if (!updateResult?.rawUpdate) return;
    if (updateResult.version) {
      localStorage.setItem(`downloaded_update_${updateResult.version}`, "true");
      window.dispatchEvent(
        new CustomEvent("ims-update-downloaded", { detail: { version: updateResult.version } })
      );
    }
    setInstallingUpdate(true);
    try {
      await downloadAndApplyUpdate(updateResult.rawUpdate, (downloaded, total) => {
        setDownloadProgress({ downloaded, total });
      });
    } catch (err: any) {
      alert(`Update installation failed: ${err?.message || "Unknown error"}`);
    } finally {
      setInstallingUpdate(false);
    }
  }

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
          setBusinessType(getActiveBusinessType());
        } else if (s.key === "expiring_soon_days") {
          setExpiringSoonDays(s.value);
        } else if (s.key.startsWith("license_") || s.key === "gstin") {
          licMap[s.key] = s.value;
        }
      }
      setLicenses(licMap);

      const info = await getDatabaseInfo();
      setDbInfo(info);

      const cInfo = await getCloudDeviceInfo();
      setCloudInfo(cInfo);
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

      // Save cloud device info
      if (cloudInfo) {
        await setCloudDeviceInfo({
          deviceName: cloudInfo.deviceName,
          apiUrl: cloudInfo.apiUrl,
        });
      }

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
            {businessType === "agro"
              ? "Agro Agency / Krishi Kendra Profile"
              : businessType === "pharma"
              ? "Pharmacy / Medical Store Profile"
              : "Kirana / Retail Store Profile"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Basic details displayed on cash memos and reports.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="label">
              {businessType === "agro"
                ? "Shop / Krishi Kendra Name *"
                : businessType === "pharma"
                ? "Pharmacy / Medical Store Name *"
                : "Kirana / Store Name *"}
            </label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">
              {businessType === "agro"
                ? "Owner / Proprietor Name *"
                : businessType === "pharma"
                ? "Pharmacist / Proprietor Name *"
                : "Shop Owner / Proprietor Name *"}
            </label>
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

      {/* Statutory Licenses */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {businessType === "agro"
              ? "Agricultural Statutory Licenses (Department of Agriculture)"
              : businessType === "pharma"
              ? "Pharmaceutical Drug Licenses (State Drugs Control Dept)"
              : "Food Safety & Commercial Licenses (FSSAI / Shop Act)"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {businessType === "agro"
              ? "These statutory numbers print directly on farmer cash memos and tax invoices."
              : businessType === "pharma"
              ? "These statutory numbers print directly on prescription cash memos and tax invoices."
              : "These statutory numbers print directly on retail bills and cash memos."}
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
            {businessType === "agro"
              ? "Pesticides, bio-chemicals, and seed germination expire over time. Choose how early you want alerts."
              : businessType === "pharma"
              ? "Medicines, syrups, and vaccines expire over time. Choose how early you want alerts."
              : "Packaged grocery, FMCG, and dairy products have best-before dates. Choose how early you want alerts."}
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

      {/* Software Updates Card */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🚀</span> Software Updates
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Check for newer versions with improvements, bug fixes, and features without losing local data.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            Current Version: v{CURRENT_APP_VERSION}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              className="btn-primary py-2 px-4 gap-2 text-xs cursor-pointer"
              onClick={handleCheckForUpdates}
              disabled={checkingUpdate || installingUpdate}
            >
              {checkingUpdate ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Checking for Updates...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Check for Updates</span>
                </>
              )}
            </button>
            <span className="text-slate-400 text-[11px]">
              Requires internet only during check & download.
            </span>
          </div>

          {updateResult && (
            <div
              className={clsx(
                "p-4 rounded-xl border text-xs space-y-2 animate-in fade-in",
                updateResult.available
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : updateResult.offline
                  ? "bg-slate-50 border-slate-200 text-slate-700"
                  : updateResult.error
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              )}
            >
              {updateResult.available ? (
                <>
                  <div className="font-extrabold flex items-center justify-between">
                    <span className="text-sm text-emerald-800 flex items-center gap-1.5">
                      <span>🎉</span> New Version Available: v{updateResult.version}
                    </span>
                    {updateResult.date && (
                      <span className="text-[10px] font-normal text-emerald-600">
                        Released: {new Date(updateResult.date).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </div>
                  <p className="text-emerald-800 leading-relaxed text-[11px] whitespace-pre-line">
                    {updateResult.notes}
                  </p>

                  {downloadProgress && downloadProgress.total > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                        <span>Downloading update...</span>
                        <span>
                          {Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 transition-all duration-200"
                          style={{
                            width: `${(downloadProgress.downloaded / downloadProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    {updateResult.rawUpdate ? (
                      <button
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                        onClick={handleInstallUpdate}
                        disabled={installingUpdate}
                      >
                        {installingUpdate ? "Installing & Relaunching..." : "⬇️ Download & Install Update Now"}
                      </button>
                    ) : updateResult.downloadUrl ? (
                      <a
                        href={updateResult.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          if (updateResult.version) {
                            localStorage.setItem(`downloaded_update_${updateResult.version}`, "true");
                            window.dispatchEvent(
                              new CustomEvent("ims-update-downloaded", {
                                detail: { version: updateResult.version },
                              })
                            );
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm cursor-pointer inline-flex items-center gap-1.5 no-underline"
                      >
                        <span>⬇️ Download Update Installer (v{updateResult.version})</span>
                      </a>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2.5 font-medium py-1">
                  {updateResult.offline ? (
                    <>
                      <span className="text-base leading-none">📶</span>
                      <span>{updateResult.notes}</span>
                    </>
                  ) : updateResult.error ? (
                    <>
                      <span className="text-base leading-none">⚠️</span>
                      <span className="leading-relaxed">{updateResult.error}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base leading-none text-emerald-600 font-bold">✓</span>
                      <div>
                        <div className="font-extrabold text-emerald-950 text-sm">
                          Your software is up to date!
                        </div>
                        <div className="text-emerald-800 text-[11px] mt-0.5">
                          {updateResult.notes || `You are running the latest version (v${updateResult.currentVersion || "1.0.0"}). No updates are needed.`}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Device Account & Cloud Authority */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>💻</span> Multi-Device Account & Identity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorized computers connected to this store account (Limit: 2 devices).
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Prefix: <strong className="font-mono">{cloudInfo?.devicePrefix || "A"}-</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="label">Device Friendly Name</label>
            <input
              className="input"
              value={cloudInfo?.deviceName || ""}
              onChange={(e) =>
                setCloudInfo((prev) => (prev ? { ...prev, deviceName: e.target.value } : null))
              }
              placeholder="e.g. Shop Counter PC or Owner Laptop"
            />
          </div>
          <div>
            <label className="label">Cloud Admin Server Endpoint</label>
            <input
              className="input font-mono text-xs"
              value={cloudInfo?.apiUrl || ""}
              onChange={(e) =>
                setCloudInfo((prev) => (prev ? { ...prev, apiUrl: e.target.value } : null))
              }
              placeholder="https://ims-software-one-theta.vercel.app"
            />
          </div>
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

      {/* Developer & Brand Profile */}
      <div className="card shadow-card space-y-4">
        <div className="border-b border-line/60 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>🏢</span> Developer & Software Branding
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Official software authorization, developer support, and enterprise license details.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="w-full sm:w-auto flex justify-center shrink-0">
            <img
              src="/yoogle-brand.jpg"
              alt="Yoogle.com - Yugal Verma"
              className="max-h-24 object-contain rounded-xl shadow-xs border border-white"
            />
          </div>
          <div className="space-y-1.5 text-xs text-slate-600 flex-1">
            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <span>Yoogle.com Enterprise Software</span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                Certified Developer
              </span>
            </div>
            <div className="text-slate-600">
              <span className="font-semibold text-slate-700">Developer:</span> Yugal Verma
            </div>
            <div className="text-slate-600">
              <span className="font-semibold text-slate-700">Mobile / WhatsApp:</span>{" "}
              <span className="font-mono font-medium text-slate-800">+91 6263777500</span>
            </div>
            <div className="text-slate-600">
              <span className="font-semibold text-slate-700">Official Email:</span>{" "}
              <span className="font-mono text-slate-800">pacs.automation.yoogle@gmail.com</span>
            </div>
            <div className="text-[11px] text-slate-400 pt-1">
              © 2026 Yoogle.Com. All rights reserved.
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button className="btn-primary py-2.5 px-6 font-bold shadow-sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving Changes..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
