import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { execute } from "@/database/client";
import { useBusinessConfig } from "@/utils/businessConfig";
import { activateSubscriptionWithKey } from "@/services/subscriptionService";
import { setCloudDeviceInfo, pullFromCloudVault } from "@/services/cloudVaultService";

interface Props {
  initialStep?: 1 | 2;
  initialStoreName?: string;
  initialOwnerName?: string;
  initialPhone?: string;
  onComplete: () => void;
}

export function FirstRunSetup({
  initialStep = 1,
  initialStoreName = "",
  initialOwnerName = "",
  initialPhone = "",
  onComplete,
}: Props) {
  const activeConfig = useBusinessConfig();

  // Mode: "new" (register brand-new store) or "signin" (multi-device login)
  const [setupMode, setSetupMode] = useState<"new" | "signin">("new");

  const [step, setStep] = useState<1 | 2>(initialStep);
  const [name, setName] = useState(initialStoreName);
  const [ownerName, setOwnerName] = useState(initialOwnerName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState("");
  const [licenseValues, setLicenseValues] = useState<Record<string, string>>({});

  // Multi-Device Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginDeviceName, setLoginDeviceName] = useState("Computer 2 (Laptop)");
  const [loginApiUrl, setLoginApiUrl] = useState("https://ims-software-one-theta.vercel.app");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [deviceLimitState, setDeviceLimitState] = useState<{
    customerId: string;
    devices: { deviceId: string; deviceName: string; devicePrefix: string }[];
  } | null>(null);

  // Step 2 Key Activation state
  const [keyInput, setKeyInput] = useState("");
  const [activating, setActivating] = useState(false);
  const [checkingCloudKey, setCheckingCloudKey] = useState(false);
  const [cloudApiUrl, setCloudApiUrl] = useState(
    () => localStorage.getItem("cloud_api_url") || "https://ims-software-one-theta.vercel.app"
  );
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleLicenseChange = (key: string, val: string) => {
    setLicenseValues((prev) => ({ ...prev, [key]: val }));
  };

  // Sign In to Existing Store on Computer B
  async function handleCloudLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Email and password are required.");
      return;
    }

    setLoggingIn(true);
    setLoginError(null);
    setLoginSuccess(null);

    try {
      // Re-use persistent device ID for this machine so repeated clicks don't eat quota
      let devId = localStorage.getItem("ims_device_id");
      if (!devId) {
        devId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        localStorage.setItem("ims_device_id", devId);
      }

      const res = await fetch(`${loginApiUrl.trim()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
          deviceId: devId,
          deviceName: loginDeviceName.trim() || "Computer 2",
          productVertical: activeConfig.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.deviceLimitReached) {
          setDeviceLimitState({
            customerId: data.customerId,
            devices: data.registeredDevices || [],
          });
        }
        throw new Error(data.error || "Authentication failed.");
      }

      setDeviceLimitState(null);

      // 1. Save store in local SQLite pharmacy table
      const now = new Date().toISOString();
      await execute(
        `INSERT INTO pharmacy (id, name, owner_name, phone, email, timezone, currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Asia/Kolkata', 'INR', ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           owner_name = excluded.owner_name,
           updated_at = excluded.updated_at`,
        [data.customerId, data.storeName, data.customerName, data.phone || null, data.email || null, now, now]
      );

      // 2. Save business vertical & device identity in settings
      await execute(
        `INSERT INTO settings (key, value) VALUES ('business_type', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [activeConfig.id]
      );

      await setCloudDeviceInfo({
        apiUrl: loginApiUrl.trim(),
        customerId: data.customerId,
        storeName: data.storeName,
        deviceId: data.device.deviceId,
        deviceName: data.device.deviceName,
        devicePrefix: data.device.devicePrefix,
      });

      localStorage.setItem("pharmacy_id", data.customerId);
      localStorage.setItem("pharmacy_name", data.storeName);
      localStorage.setItem("business_type", activeConfig.id);

      // 3. Activate subscription key automatically
      await activateSubscriptionWithKey(data.subscriptionKey, activeConfig.id);

      // 4. Pull latest Cloud Vault snapshot if available
      try {
        const pullRes = await pullFromCloudVault();
        if (pullRes.success) {
          console.log(`Restored cloud vault backup version ${pullRes.version}`);
        }
      } catch (vaultErr) {
        console.warn("Initial vault pull note:", vaultErr);
      }

      setLoginSuccess(
        `✓ Welcome back! Activated "${data.storeName}" on this PC (Authorized as Computer ${data.device.devicePrefix}). Opening your IMS...`
      );

      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (err: any) {
      setLoginError(err?.message || "Sign in failed. Please verify credentials and server connection.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleRevokeDevice(devIdToRevoke: string) {
    if (!deviceLimitState) return;
    try {
      setLoggingIn(true);
      const res = await fetch(`${loginApiUrl.trim()}/api/auth/devices`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: deviceLimitState.customerId,
          deviceId: devIdToRevoke,
        }),
      });
      if (res.ok) {
        setDeviceLimitState(null);
        setLoginError(null);
        await handleCloudLogin();
      } else {
        const d = await res.json();
        setLoginError(d.error || "Failed to disconnect device.");
      }
    } catch (e: any) {
      setLoginError(e.message || "Failed to contact server.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleResetAllDevices() {
    if (!deviceLimitState) return;
    try {
      setLoggingIn(true);
      const res = await fetch(`${loginApiUrl.trim()}/api/auth/devices`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: deviceLimitState.customerId,
          deviceId: "all",
        }),
      });
      if (res.ok) {
        setDeviceLimitState(null);
        setLoginError(null);
        await handleCloudLogin();
      } else {
        const d = await res.json();
        setLoginError(d.error || "Failed to reset devices.");
      }
    } catch (e: any) {
      setLoginError(e.message || "Failed to contact server.");
    } finally {
      setLoggingIn(false);
    }
  }

  // Step 1: Save Store Profile and advance to Key Activation Gate
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !ownerName.trim()) {
      setFormError("Store/Agency name and proprietor name are required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      await execute(
        `INSERT INTO pharmacy (id, name, owner_name, phone, email, timezone, currency, created_at, updated_at)
         VALUES (?,?,?,?,?, 'Asia/Kolkata', 'INR', ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           owner_name = excluded.owner_name,
           phone = excluded.phone,
           email = excluded.email,
           updated_at = excluded.updated_at`,
        [id, name.trim(), ownerName.trim(), phone.trim() || null, email.trim() || null, now, now]
      );

      // Save business vertical
      await execute(
        `INSERT INTO settings (key, value) VALUES ('business_type', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [activeConfig.id]
      );

      // Save statutory license numbers
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
      localStorage.setItem("business_type", activeConfig.id);
      localStorage.setItem("cloud_api_url", cloudApiUrl.trim());

      // Automatically register new customer in Cloud Admin portal
      try {
        const regRes = await fetch(`${cloudApiUrl.trim()}/api/customers/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: ownerName.trim(),
            storeName: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            businessType: activeConfig.id,
          }),
        });

        if (regRes.ok) {
          const regData = await regRes.json();
          if (regData.customerId) {
            localStorage.setItem("cloud_customer_id", regData.customerId);
            if (regData.subscriptionKey) {
              setKeyInput(regData.subscriptionKey);
            }
          }
        }
      } catch (cloudErr) {
        console.warn("Could not reach Cloud Admin at registration (offline):", cloudErr);
      }

      // Advance to Step 2: Subscription Key Activation Gate
      setStep(2);
    } catch (e: any) {
      console.error("Failed to save shop details:", e);
      setFormError(e?.message || "Could not save details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Step 2: Verify offline key, ensure product vertical matches, and activate software
  async function handleActivateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) {
      setActivationError("Please enter your offline subscription key.");
      return;
    }

    setActivating(true);
    setActivationError(null);
    setActivationSuccess(null);

    try {
      // Validates HMAC signature, validates product vertical, and validates expiry date
      const updated = await activateSubscriptionWithKey(keyInput.trim(), activeConfig.id);

      setActivationSuccess(
        `✓ Software successfully activated! Plan: ${updated.plan_name} (Valid till ${new Date(
          updated.expiry_date
        ).toLocaleDateString("en-IN")})`
      );

      // Transition to IMS after brief visual confirmation
      setTimeout(() => {
        onComplete();
      }, 900);
    } catch (err: any) {
      setActivationError(err?.message || "Invalid subscription key. Please check and try again.");
    } finally {
      setActivating(false);
    }
  }

  // Check if admin has approved the request and issued a subscription key
  async function handleCheckCloudKey() {
    setCheckingCloudKey(true);
    setActivationError(null);
    try {
      let customerId = localStorage.getItem("cloud_customer_id");
      const targetApiUrl = (cloudApiUrl || localStorage.getItem("cloud_api_url") || "https://ims-software-one-theta.vercel.app").trim();

      if (!customerId) {
        // Re-attempt registration if it was offline on Step 1
        const regRes = await fetch(`${targetApiUrl}/api/customers/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: (ownerName || initialOwnerName).trim(),
            storeName: (name || initialStoreName).trim(),
            phone: (phone || initialPhone).trim(),
            email: email.trim(),
            businessType: activeConfig.id,
          }),
        });
        if (regRes.ok) {
          const regData = await regRes.json();
          if (regData.customerId) {
            const newCustId: string = String(regData.customerId);
            customerId = newCustId;
            localStorage.setItem("cloud_customer_id", newCustId);
            if (regData.subscriptionKey) {
              setKeyInput(regData.subscriptionKey);
              const updated = await activateSubscriptionWithKey(regData.subscriptionKey, activeConfig.id);
              setActivationSuccess(
                `✓ Code received & activated! Plan: ${updated.plan_name} (Valid till ${new Date(
                  updated.expiry_date
                ).toLocaleDateString("en-IN")})`
              );
              setTimeout(() => onComplete(), 1000);
              return;
            }
          }
        }
      }

      if (customerId) {
        const res = await fetch(`${targetApiUrl}/api/customers/${customerId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.subscriptionKey && data.status === "active") {
            setKeyInput(data.subscriptionKey);
            const updated = await activateSubscriptionWithKey(data.subscriptionKey, activeConfig.id);
            setActivationSuccess(
              `✓ Code received & activated! Plan: ${updated.plan_name} (Valid till ${new Date(
                updated.expiry_date
              ).toLocaleDateString("en-IN")})`
            );
            setTimeout(() => onComplete(), 1000);
            return;
          } else {
            setActivationError(
              "Your registration is awaiting approval from the administrator. Once approved, click here again or paste the code directly."
            );
          }
        } else {
          setActivationError("Could not reach Cloud Admin server. Please verify connection or enter key manually.");
        }
      } else {
        setActivationError("Could not connect to Admin server. You can paste the offline key manually.");
      }
    } catch (e: any) {
      setActivationError(e?.message || "Failed to check status. You can paste the offline key manually.");
    } finally {
      setCheckingCloudKey(false);
    }
  }

  // Background auto-polling for key approval when on Step 2
  React.useEffect(() => {
    if (step === 2 && !activationSuccess) {
      const interval = setInterval(() => {
        const customerId = localStorage.getItem("cloud_customer_id");
        const targetApiUrl = (localStorage.getItem("cloud_api_url") || "https://ims-software-one-theta.vercel.app").trim();
        if (customerId && typeof window !== "undefined" && navigator.onLine) {
          fetch(`${targetApiUrl}/api/customers/${customerId}/status`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.subscriptionKey && data.status === "active") {
                setKeyInput(data.subscriptionKey);
                activateSubscriptionWithKey(data.subscriptionKey, activeConfig.id)
                  .then((updated) => {
                    setActivationSuccess(
                      `✓ Code approved by admin! Activated for ${updated.plan_name}. Opening ${activeConfig.appName}...`
                    );
                    setTimeout(() => onComplete(), 1000);
                  })
                  .catch(() => {});
              }
            })
            .catch(() => {});
        }
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [step, activationSuccess]);

  // Generate WhatsApp message to request key from administrator
  function getRequestKeyWhatsAppUrl() {
    const message = `Hello Admin,\n\nI have installed *${activeConfig.appName}* and need an offline activation key.\n\n📍 *Store Name:* ${name || initialStoreName}\n👤 *Owner:* ${ownerName || initialOwnerName}\n📞 *Phone:* ${phone || initialPhone}\n🏢 *Product Edition:* ${activeConfig.badgeText}\n\nPlease generate and share my offline subscription key. Thank you!`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in space-y-6">
        {/* Brand Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center space-y-1.5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white p-2.5 shadow-md flex items-center justify-center">
            <img src="/yoogle-icon.png" alt="Yoogle IMS" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">{activeConfig.appName}</h1>
          <p className="text-xs text-emerald-100 font-medium">
            {activeConfig.badgeText} • {activeConfig.tagline}
          </p>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 pt-3">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                step === 1 ? "bg-white text-emerald-800 shadow-xs" : "bg-white/20 text-white"
              }`}
            >
              1. Store Setup / Sign In
            </span>
            <span className="text-white/40 text-xs">➔</span>
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                step === 2 ? "bg-white text-emerald-800 shadow-xs" : "bg-white/20 text-white"
              }`}
            >
              2. Key Activation Gate
            </span>
          </div>
        </div>

        {/* Step 1 Choice: Register New Store vs Sign In to Existing Store */}
        {step === 1 && (
          <div className="px-6 pt-0">
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold text-slate-600 mb-4">
              <button
                type="button"
                onClick={() => setSetupMode("new")}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  setupMode === "new"
                    ? "bg-white text-slate-900 shadow-xs font-extrabold"
                    : "hover:text-slate-900"
                }`}
              >
                ➕ Register New Store
              </button>
              <button
                type="button"
                onClick={() => setSetupMode("signin")}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  setupMode === "signin"
                    ? "bg-white text-emerald-800 shadow-xs font-extrabold"
                    : "hover:text-slate-900"
                }`}
              >
                🔑 Already have an account? Sign In
              </button>
            </div>
          </div>
        )}

        {/* MODE: Sign In on Computer 2 */}
        {step === 1 && setupMode === "signin" && (
          <form onSubmit={handleCloudLogin} className="p-6 pt-0 space-y-4 text-xs">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>💻</span> Access Your Store on this Computer
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sign in with your registered store email and password. Your active subscription and latest inventory will sync to this computer.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Registered Email Address *</label>
                <input
                  type="email"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. store.owner@example.com"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Account Password *</label>
                <input
                  type="password"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your account password"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">This Computer's Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    value={loginDeviceName}
                    onChange={(e) => setLoginDeviceName(e.target.value)}
                    placeholder="e.g. Home Laptop or Counter 2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cloud Server Endpoint</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    value={loginApiUrl}
                    onChange={(e) => setLoginApiUrl(e.target.value)}
                    placeholder="https://ims-software-one-theta.vercel.app"
                  />
                </div>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            {deviceLimitState && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs">
                <div className="font-bold text-amber-950 flex items-center justify-between">
                  <span>Manage Authorized Computers ({deviceLimitState.devices.length}/2):</span>
                  <button
                    type="button"
                    onClick={handleResetAllDevices}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                  >
                    Reset Both Slots
                  </button>
                </div>
                <div className="space-y-1.5 pt-1">
                  {deviceLimitState.devices.map((d) => (
                    <div
                      key={d.deviceId}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-amber-100 shadow-2xs"
                    >
                      <div className="truncate pr-2">
                        <span className="font-extrabold text-slate-800">{d.deviceName}</span>
                        <span className="ml-1.5 font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                          Prefix {d.devicePrefix}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(d.deviceId)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] shrink-0 cursor-pointer shadow-2xs"
                      >
                        Deactivate & Connect Here
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loginSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-start gap-2">
                <span className="text-base leading-none">✓</span>
                <span className="leading-relaxed">{loginSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn || !loginEmail.trim() || !loginPassword}
              style={{ backgroundColor: activeConfig.primaryColorHex }}
              className="w-full py-3 text-white font-bold text-sm rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer mt-2 disabled:opacity-50"
            >
              {loggingIn ? "Authenticating & Syncing..." : "🔓 Sign In & Sync Store Data →"}
            </button>
          </form>
        )}

        {/* STEP 1: Store & Proprietor Registration (New Store) */}
        {step === 1 && setupMode === "new" && (
          <form onSubmit={handleSaveProfile} className="p-6 pt-0 space-y-4 text-xs">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                {activeConfig.id === "agro"
                  ? "Register Your Agro Kendra / Agency"
                  : activeConfig.id === "pharma"
                  ? "Register Your Pharmacy / Medical Store"
                  : "Register Your Kirana / Retail Store"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeConfig.id === "agro"
                  ? "Configure your store details for Kisan Cash Memos and agricultural records."
                  : activeConfig.id === "pharma"
                  ? "Configure your pharmacy details for Prescription Tax Invoices and statutory drug records."
                  : "Configure your store details for Retail Cash Bills and customer invoices."}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {activeConfig.id === "agro"
                    ? "Agro Agency / Krishi Kendra Name *"
                    : activeConfig.id === "pharma"
                    ? "Pharmacy / Medical Store Name *"
                    : "Kirana / Retail Store Name *"}
                </label>
                <input
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand focus:outline-hidden"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={activeConfig.storeNamePlaceholder}
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {activeConfig.id === "agro"
                    ? "Proprietor / Owner Name *"
                    : activeConfig.id === "pharma"
                    ? "Pharmacist / Proprietor Name *"
                    : "Shop Owner / Proprietor Name *"}
                </label>
                <input
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand focus:outline-hidden"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder={
                    activeConfig.id === "agro"
                      ? "e.g. Ramesh Patel"
                      : activeConfig.id === "pharma"
                      ? "e.g. Suresh Kumar (B.Pharm)"
                      : "e.g. Rajesh Gupta"
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Phone Number (Contact / WhatsApp)
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand focus:outline-hidden"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9826012345"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand focus:outline-hidden"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      activeConfig.id === "agro"
                        ? "kisan@example.com"
                        : activeConfig.id === "pharma"
                        ? "pharma@example.com"
                        : "kirana@example.com"
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="font-bold text-slate-700 block mb-1">
                    Cloud Admin Endpoint (Optional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand focus:outline-hidden"
                    value={cloudApiUrl}
                    onChange={(e) => setCloudApiUrl(e.target.value)}
                    placeholder="https://ims-software-one-theta.vercel.app"
                  />
                </div>
              </div>

              {/* Statutory Licenses */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  {activeConfig.id === "agro"
                    ? "Agricultural Statutory Licenses (Prints on Kisan Cash Memos)"
                    : activeConfig.id === "pharma"
                    ? "Pharmaceutical Statutory Licenses (Prints on Rx Tax Invoices)"
                    : "Food Safety & Commercial Licenses (Prints on Retail Invoices)"}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeConfig.licenseFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                        {field.label}
                      </label>
                      <input
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand focus:outline-hidden"
                        value={licenseValues[field.key] || ""}
                        onChange={(e) => handleLicenseChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                ⚠️ {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: activeConfig.primaryColorHex }}
              className="w-full py-3 text-white font-bold text-sm rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer mt-2"
            >
              {saving ? "Saving Details..." : `Save Store Details & Proceed to Activation →`}
            </button>
          </form>
        )}

        {/* STEP 2: Key Activation Gate (Mandatory Protection) */}
        {step === 2 && (
          <div className="p-6 pt-0 space-y-5 text-xs">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>🔐</span> Software Activation Required
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Your store profile is saved. Please enter your offline activation key provided by the administrator.
              </p>
            </div>

            {/* Store Profile Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">Registered Store:</span>
                <strong className="text-slate-900 font-bold">{name || initialStoreName}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">Proprietor:</span>
                <span className="text-slate-800 font-medium">{ownerName || initialOwnerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[11px]">Product Edition:</span>
                <span className="font-bold text-emerald-700">{activeConfig.badgeText}</span>
              </div>
            </div>

            {/* Request Key Helper */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2.5">
              <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                <span>⚡</span> Activation Code Authority
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Your store details have been registered. Once the administrator approves and issues your key, click below to activate automatically, or paste the key received on WhatsApp.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCheckCloudKey}
                  disabled={checkingCloudKey}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {checkingCloudKey ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Checking Approval...</span>
                    </>
                  ) : (
                    <span>🔄 Check Approval & Fetch Code</span>
                  )}
                </button>

                <a
                  href={getRequestKeyWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <span>💬 Send Request via WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Key Entry Form */}
            <form onSubmit={handleActivateKey} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Enter Offline Subscription Key *
                </label>
                <textarea
                  required
                  rows={3}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={`Paste your offline key here (e.g. ${activeConfig.id === "agro" ? "AGRO" : activeConfig.id === "kirana" ? "KIRANA" : "PHARMA"}-eyJ...)`}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {activationError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{activationError}</span>
                </div>
              )}

              {activationSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                  <span>✓</span>
                  <span>{activationSuccess}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  ← Edit Store Details
                </button>
                <button
                  type="submit"
                  disabled={activating || !keyInput.trim()}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {activating ? "Verifying Signature..." : "🔓 Verify Key & Activate IMS"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Developer Branding Footer - Matches Image 3 reference */}
        <div className="pt-4 pb-6 px-6 text-center text-xs text-slate-500 border-t border-slate-100 space-y-1 bg-slate-50/60">
          <div className="font-semibold text-slate-700">
            Developed by- <span className="text-emerald-700 font-bold">Yoogle.Com</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Developer- Yugal Verma, <span className="font-mono font-medium">6263777500</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Gmail ID- <span className="font-mono">pacs.automation.yoogle@gmail.com</span>
          </div>
          <div className="text-[10px] text-slate-400 pt-0.5">
            © 2026 Yoogle.Com. All rights reserved.
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            Version 1.0.0
          </div>
        </div>
      </div>
    </div>
  );
}
