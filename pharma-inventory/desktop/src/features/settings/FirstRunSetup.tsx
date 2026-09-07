import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import clsx from "clsx";
import { execute } from "@/database/client";
import {
  BUSINESS_CONFIGS,
  type BusinessType,
  setActiveBusinessType,
} from "@/utils/businessConfig";

interface Props {
  onComplete: () => void;
}

export function FirstRunSetup({ onComplete }: Props) {
  const [selectedType, setSelectedType] = useState<BusinessType>("agro");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [licenseValues, setLicenseValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeConfig = BUSINESS_CONFIGS[selectedType];

  const handleLicenseChange = (key: string, val: string) => {
    setLicenseValues((prev) => ({ ...prev, [key]: val }));
  };

  async function handleContinue() {
    if (!name.trim() || !ownerName.trim()) {
      setError("Store/Shop name and owner name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      await execute(
        `INSERT INTO pharmacy (id, name, owner_name, phone, email, timezone, currency, created_at, updated_at)
         VALUES (?,?,?,?,?, 'Asia/Kolkata', 'INR', ?, ?)`,
        [id, name.trim(), ownerName.trim(), phone.trim() || null, email.trim() || null, now, now]
      );

      // Save business type in settings and localStorage
      await execute(
        `INSERT INTO settings (key, value) VALUES ('business_type', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [selectedType]
      );

      // Mark first-time setup completed to lock vertical selection
      await execute(
        `INSERT INTO settings (key, value) VALUES ('setup_completed', 'true')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        []
      );

      // Save license numbers
      for (const [k, v] of Object.entries(licenseValues)) {
        if (v.trim()) {
          await execute(
            `INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [k, v.trim()]
          );
        }
      }

      localStorage.setItem("pharmacy_id", id);
      localStorage.setItem("pharmacy_name", name.trim());
      localStorage.setItem("setup_completed", "true");
      setActiveBusinessType(selectedType);

      onComplete();
    } catch (e: any) {
      console.error("Failed to save shop details:", e);
      setError(e?.message || (typeof e === "string" ? e : "Could not save details. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="card w-full max-w-lg shadow-xl border border-line space-y-6 animate-in fade-in">
        {/* Header */}
        <div className="text-center space-y-1 pb-3 border-b border-line/70">
          <div className="w-12 h-12 mx-auto rounded-2xl overflow-hidden shadow-xs border border-emerald-200 bg-white flex items-center justify-center">
            <img src="/app-icon.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome to Inventory Management
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Choose your business vertical to automatically configure products, packaging units, and tax invoices.
          </p>
        </div>

        {/* Business Vertical Selection Cards */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Select Business Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: "agro" as BusinessType,
                title: "Agro Kendra",
                desc: "Pesticides, Seeds & Fertilizers",
                icon: "🌱",
              },
              {
                id: "pharma" as BusinessType,
                title: "Pharmacy",
                desc: "Medicines & Healthcare",
                icon: "💊",
              },
              {
                id: "kirana" as BusinessType,
                title: "Kirana / Retail",
                desc: "Grocery & Daily Provisions",
                icon: "🛒",
              },
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedType(item.id)}
                className={clsx(
                  "p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left",
                  selectedType === item.id
                    ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <span className="text-xl mb-1.5">{item.icon}</span>
                <span className="text-xs font-bold text-slate-900 leading-tight block">
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Shop Form Inputs */}
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              {selectedType === "agro"
                ? "Agro Agency / Krishi Kendra Name *"
                : selectedType === "pharma"
                ? "Pharmacy Name *"
                : "Store / Shop Name *"}
            </label>
            <input
              className="input py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={activeConfig.storeNamePlaceholder}
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Owner / Proprietor Name *
            </label>
            <input
              className="input py-2 text-sm"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Phone Number (Optional)
              </label>
              <input
                className="input py-2 text-xs"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Email Address (Optional)
              </label>
              <input
                className="input py-2 text-xs"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="store@example.com"
              />
            </div>
          </div>

          {/* Statutory Licenses (Optional during first run) */}
          <div className="pt-2 border-t border-line/60 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              {selectedType === "agro"
                ? "Agricultural Licenses (Optional, prints on bills)"
                : "Licenses & Registrations (Optional)"}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeConfig.licenseFields.map((field) => (
                <div key={field.key}>
                  <label className="text-[10px] font-medium text-slate-500 block mb-0.5">
                    {field.label}
                  </label>
                  <input
                    className="input py-1.5 text-xs"
                    value={licenseValues[field.key] || ""}
                    onChange={(e) => handleLicenseChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-xs font-medium pt-1">⚠️ {error}</p>}

          <button
            className="btn-primary w-full py-2.5 text-sm font-bold shadow-xs mt-2"
            onClick={handleContinue}
            disabled={saving}
          >
            {saving ? "Setting up..." : "Continue to Dashboard →"}
          </button>
        </div>
      </div>
    </div>
  );
}
