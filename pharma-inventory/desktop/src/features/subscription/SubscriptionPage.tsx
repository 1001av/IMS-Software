import { useEffect, useState } from "react";
import { getCurrentSubscription, activateSubscriptionWithKey } from "@/services/subscriptionService";
import { formatPaise } from "@/utils/currency";
import type { Subscription } from "@/types/domain";

export function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const sub = await getCurrentSubscription();
      setSubscription(sub);
    } catch (e: any) {
      console.error(e);
      setError("Could not load subscription details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApplyKey() {
    if (!keyInput.trim()) {
      setError("Please paste a valid subscription key.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await activateSubscriptionWithKey(keyInput.trim());
      setSubscription(updated);
      setSuccess(`Subscription successfully updated to ${updated.plan_name}!`);
      setKeyInput("");
    } catch (e: any) {
      setError(e?.message || "Invalid subscription key. Please verify the key and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function getDaysRemaining(expiryDate: string): { days: number; isExpired: boolean } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      days: Math.abs(diffDays),
      isExpired: diffDays < 0,
    };
  }

  if (loading || !subscription) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-subink text-sm font-medium">
          <svg className="w-5 h-5 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading subscription details...
        </div>
      </div>
    );
  }

  const { days, isExpired } = getDaysRemaining(subscription.expiry_date);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink tracking-tight">Subscription & Plan</h1>
        <p className="text-sm text-subink mt-0.5">
          Manage your pharmacy's offline license and subscription. All operations remain 100% offline.
        </p>
      </div>

      {/* Current Plan Overview Card */}
      <div className="card border-line shadow-card overflow-hidden">
        <div className="flex items-start justify-between pb-6 border-b border-line/70">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-subink">Active Subscription</div>
            <div className="text-2xl font-extrabold text-ink tracking-tight mt-1">{subscription.plan_name}</div>
            <div className="text-xs text-subink mt-1">
              Registered to: <span className="font-semibold text-ink">{subscription.customer_name}</span>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                subscription.status === "active"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                  : subscription.status === "expiring_soon"
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                  : "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  subscription.status === "active"
                    ? "bg-emerald-500"
                    : subscription.status === "expiring_soon"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              {subscription.status === "active"
                ? "Active Plan"
                : subscription.status === "expiring_soon"
                ? "Expiring Soon"
                : "Expired"}
            </span>
            <div className="text-xs font-semibold text-subink mt-1.5">
              {isExpired
                ? `Expired ${days} day${days === 1 ? "" : "s"} ago`
                : `${days} day${days === 1 ? "" : "s"} remaining`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
          <div className="p-4 rounded-xl bg-slate-50/80 border border-line/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-subink">Plan Price</div>
            <div className="text-lg font-extrabold text-ink mt-1">
              {subscription.price_paise > 0 ? formatPaise(subscription.price_paise) : "Free Trial"}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 border border-line/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-subink">Valid From</div>
            <div className="text-sm font-bold text-ink mt-1">
              {new Date(subscription.start_date).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 border border-line/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-subink">Expires On</div>
            <div className={`text-sm font-bold mt-1 ${isExpired ? "text-danger" : "text-ink"}`}>
              {new Date(subscription.expiry_date).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {isExpired && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
            <span className="text-base leading-none">⚠️</span>
            <div>
              <div className="font-bold text-rose-900">Your subscription has expired</div>
              <div className="mt-0.5 text-rose-700 leading-relaxed">
                All your pharmacy medicines, inventory movements, and backup capabilities remain completely operational and unblocked. Paste a new renewal key below to renew your plan.
              </div>
            </div>
          </div>
        )}

        {subscription.status === "expiring_soon" && !isExpired && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-3">
            <span className="text-base leading-none">ℹ️</span>
            <div>
              <div className="font-bold text-amber-900">Subscription expiring soon ({days} days remaining)</div>
              <div className="mt-0.5 text-amber-700 leading-relaxed">
                Contact your distributor or software provider to obtain your offline renewal key.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enter Subscription Key Card */}
      <div className="card space-y-4 shadow-card">
        <div>
          <h2 className="text-base font-bold text-ink">Activate or Renew Plan</h2>
          <p className="text-xs text-subink mt-0.5">
            Enter your cryptographically signed offline activation key to upgrade or renew with zero internet access.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="sub-key">Subscription Key</label>
          <textarea
            id="sub-key"
            className="input font-mono text-xs leading-relaxed"
            rows={3}
            placeholder="Paste offline key starting with PHARMA-..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
            {success}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleApplyKey}
          disabled={submitting || !keyInput.trim()}
        >
          {submitting ? "Verifying Offline Signature..." : "Apply Subscription Key"}
        </button>
      </div>

      {/* Offline Guarantee Info */}
      <div className="card bg-slate-50 border-line text-xs text-subink space-y-2">
        <div className="font-bold text-ink flex items-center gap-2">
          <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          100% Offline-First Architecture
        </div>
        <p className="leading-relaxed">
          This system never sends your inventory or sales data over the internet. All records are securely stored on your local computer's SQLite database.
        </p>
      </div>
    </div>
  );
}
