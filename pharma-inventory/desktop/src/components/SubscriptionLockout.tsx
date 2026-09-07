import React, { useState } from "react";
import { activateSubscriptionWithKey } from "@/services/subscriptionService";
import { useBusinessConfig } from "@/utils/businessConfig";
import type { Subscription } from "@/types/domain";

interface Props {
  subscription: Subscription;
  onUnlocked: (updated: Subscription) => void;
}

export function SubscriptionLockout({ subscription, onUnlocked }: Props) {
  const config = useBusinessConfig();
  const [keyInput, setKeyInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) {
      setError("Please enter or paste your offline renewal key.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await activateSubscriptionWithKey(keyInput.trim());
      if (updated.status === "expired") {
        throw new Error("The entered key has already expired. Please contact support for an active renewal key.");
      }
      setSuccess(`License successfully renewed! Welcome back to ${updated.plan_name}.`);
      setTimeout(() => {
        onUnlocked(updated);
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Invalid offline license key. Please check and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const formattedExpiry = new Date(subscription.expiry_date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Urgent Header */}
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 p-6 text-white text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white/20 mx-auto flex items-center justify-center text-3xl shadow-inner">
            🔒
          </div>
          <h2 className="text-2xl font-black tracking-tight">Subscription Expired</h2>
          <p className="text-xs text-rose-100 max-w-md mx-auto">
            Your license for <strong className="text-white font-bold">{subscription.customer_name || config.appName}</strong> ({config.badgeText}) expired on <strong className="text-white font-bold">{formattedExpiry}</strong>.
          </p>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Data Safety Guarantee Alert */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
            <div className="font-extrabold flex items-center gap-1.5 text-emerald-800 text-sm">
              <span>🛡️</span> 100% Local Data Guarantee
            </div>
            <p className="leading-relaxed text-emerald-700">
              All your customer records, inventory stock, billing invoices, and reports remain <strong>100% safe and intact</strong> in your local database. No data has been or will ever be deleted. Entering a renewal key restores instant full access.
            </p>
          </div>

          {/* Key Input Form */}
          <form onSubmit={handleUnlock} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Enter Offline Renewal Key
              </label>
              <textarea
                rows={3}
                required
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste your offline renewal key here (e.g. PHARMA-... or IMS-...)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden transition-all"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                <span>✓</span>
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !keyInput.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all hover:shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Verifying Offline Signature...</span>
                </>
              ) : (
                <span>🔓 Verify Key & Unlock Access</span>
              )}
            </button>
          </form>

          {/* Help & Contact Support */}
          <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1">
            <div>Don't have a renewal key yet?</div>
            <div className="font-semibold text-slate-700">
              Contact your software distributor or administrator to get your instant offline renewal key.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
