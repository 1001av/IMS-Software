"use client";

import React, { useState, useEffect, useMemo } from "react";
import clsx from "clsx";
import {
  BusinessType,
  CustomerRecord,
  DurationUnit,
  SubscriptionStatus,
} from "@/lib/types";

interface NewCustomerForm {
  customerName: string;
  storeName: string;
  phone: string;
  email: string;
  city: string;
  businessType: BusinessType;
  planName: string;
  price: string; // in rupees
  durationMode: DurationUnit;
  presetMonths: number;
  customMonths: number;
  customDays: number;
  exactExpiryDate: string;
}

const VERTICAL_METADATA: Record<
  BusinessType,
  { name: string; icon: string; color: string; bg: string; border: string }
> = {
  agro: {
    name: "Agro Kendra",
    icon: "🌱",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  pharma: {
    name: "Pharmacy",
    icon: "💊",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
  kirana: {
    name: "Kirana / Retail",
    icon: "🛒",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  general: {
    name: "General IMS",
    icon: "🏢",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
};

export default function AdminDashboard() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | BusinessType | "expiring_soon" | "expired">("all");

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewingCustomer, setRenewingCustomer] = useState<CustomerRecord | null>(null);
  const [generatedKeyResult, setGeneratedKeyResult] = useState<{
    customerName: string;
    storeName: string;
    phone: string;
    businessType: BusinessType;
    planName: string;
    expiryDate: string;
    key: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New customer form state
  const [newForm, setNewForm] = useState<NewCustomerForm>({
    customerName: "",
    storeName: "",
    phone: "",
    email: "",
    city: "",
    businessType: "agro",
    planName: "Agro Kendra Annual Pro",
    price: "4999",
    durationMode: "preset",
    presetMonths: 12,
    customMonths: 6,
    customDays: 45,
    exactExpiryDate: "",
  });

  // Renewal form state
  const [renewForm, setRenewForm] = useState({
    durationMode: "preset" as DurationUnit,
    presetMonths: 12,
    customMonths: 6,
    customDays: 30,
    exactExpiryDate: "",
    planName: "",
    price: "4999",
  });

  async function fetchCustomers() {
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (err) {
      console.error("Failed to load customers", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Update plan name default when vertical or duration changes
  const handleVerticalChange = (type: BusinessType) => {
    let defaultPlan = "";
    if (type === "agro") defaultPlan = "Agro Kendra Annual Pro";
    else if (type === "pharma") defaultPlan = "Pharmacy Enterprise Plan";
    else if (type === "kirana") defaultPlan = "Kirana Retail Standard";
    else defaultPlan = "General Store Pro";

    setNewForm((prev) => ({
      ...prev,
      businessType: type,
      planName: defaultPlan,
    }));
  };

  // Calculate live preview expiry date
  const calculatedExpiryDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (newForm.durationMode === "preset") {
      const exp = new Date(today);
      exp.setMonth(exp.getMonth() + Number(newForm.presetMonths));
      return exp.toISOString().slice(0, 10);
    } else if (newForm.durationMode === "months") {
      const exp = new Date(today);
      exp.setMonth(exp.getMonth() + Number(newForm.customMonths || 1));
      return exp.toISOString().slice(0, 10);
    } else if (newForm.durationMode === "days") {
      const exp = new Date(today);
      exp.setDate(exp.getDate() + Number(newForm.customDays || 1));
      return exp.toISOString().slice(0, 10);
    } else if (newForm.durationMode === "date") {
      return newForm.exactExpiryDate || "Select date";
    }
    return "";
  }, [newForm]);

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let totalRevenuePaise = 0;
    const byVertical: Record<BusinessType, number> = { agro: 0, pharma: 0, kirana: 0, general: 0 };

    for (const c of customers) {
      totalRevenuePaise += c.pricePaise || 0;
      if (c.businessType in byVertical) {
        byVertical[c.businessType]++;
      }
      if (c.status === "active") active++;
      else if (c.status === "expiring_soon") expiringSoon++;
      else if (c.status === "expired") expired++;
    }

    return {
      total,
      active,
      expiringSoon,
      expired,
      revenueInRupees: Math.round(totalRevenuePaise / 100),
      byVertical,
    };
  }, [customers]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Tab filter
      if (activeTab === "agro" && c.businessType !== "agro") return false;
      if (activeTab === "pharma" && c.businessType !== "pharma") return false;
      if (activeTab === "kirana" && c.businessType !== "kirana") return false;
      if (activeTab === "general" && c.businessType !== "general") return false;
      if (activeTab === "expiring_soon" && c.status !== "expiring_soon") return false;
      if (activeTab === "expired" && c.status !== "expired") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.customerName.toLowerCase().includes(q) ||
          c.storeName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.subscriptionKey.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [customers, activeTab, searchQuery]);

  // Handle create customer & generate key
  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.customerName.trim() || !newForm.storeName.trim()) {
      setFormError("Owner Name and Store Name are required.");
      return;
    }

    if (newForm.durationMode === "date" && !newForm.exactExpiryDate) {
      setFormError("Please choose an exact expiry date.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const pricePaise = Math.round(parseFloat(newForm.price || "0") * 100);
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: newForm.customerName,
          storeName: newForm.storeName,
          phone: newForm.phone,
          email: newForm.email,
          city: newForm.city,
          businessType: newForm.businessType,
          planName: newForm.planName,
          pricePaise,
          durationMode: newForm.durationMode,
          presetMonths: newForm.presetMonths,
          customMonths: newForm.customMonths,
          customDays: newForm.customDays,
          exactExpiryDate: newForm.exactExpiryDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate key");
      }

      // Prepend to customer list
      setCustomers((prev) => [data.customer, ...prev]);

      // Open Key Created Result Modal
      setGeneratedKeyResult({
        customerName: data.customer.customerName,
        storeName: data.customer.storeName,
        phone: data.customer.phone,
        businessType: data.customer.businessType,
        planName: data.customer.planName,
        expiryDate: data.customer.expiryDate,
        key: data.customer.subscriptionKey,
      });

      setIsNewModalOpen(false);
      // Reset form
      setNewForm({
        customerName: "",
        storeName: "",
        phone: "",
        email: "",
        city: "",
        businessType: "agro",
        planName: "Agro Kendra Annual Pro",
        price: "4999",
        durationMode: "preset",
        presetMonths: 12,
        customMonths: 6,
        customDays: 45,
        exactExpiryDate: "",
      });
    } catch (err: any) {
      setFormError(err?.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  // Open renewal modal
  function openRenewModal(customer: CustomerRecord) {
    setRenewingCustomer(customer);
    setRenewForm({
      durationMode: "preset",
      presetMonths: 12,
      customMonths: 6,
      customDays: 30,
      exactExpiryDate: "",
      planName: customer.planName,
      price: (customer.pricePaise / 100).toString(),
    });
    setIsRenewModalOpen(true);
  }

  // Handle renew customer
  async function handleRenewCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!renewingCustomer) return;

    setSubmitting(true);
    try {
      const pricePaise = Math.round(parseFloat(renewForm.price || "0") * 100);
      const res = await fetch(`/api/customers/${renewingCustomer.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMode: renewForm.durationMode,
          presetMonths: renewForm.presetMonths,
          customMonths: renewForm.customMonths,
          customDays: renewForm.customDays,
          exactExpiryDate: renewForm.exactExpiryDate,
          planName: renewForm.planName,
          pricePaise,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to renew key");
      }

      setCustomers((prev) =>
        prev.map((c) => (c.id === data.customer.id ? data.customer : c))
      );

      setGeneratedKeyResult({
        customerName: data.customer.customerName,
        storeName: data.customer.storeName,
        phone: data.customer.phone,
        businessType: data.customer.businessType,
        planName: data.customer.planName,
        expiryDate: data.customer.expiryDate,
        key: data.customer.subscriptionKey,
      });

      setIsRenewModalOpen(false);
      setRenewingCustomer(null);
    } catch (err: any) {
      alert(err?.message || "Failed to renew license");
    } finally {
      setSubmitting(false);
    }
  }

  // Copy to clipboard helper
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  }

  // Generate WhatsApp message URL
  function getWhatsAppUrl(
    phone: string,
    customerName: string,
    storeName: string,
    vertical: BusinessType,
    planName: string,
    expiryDate: string,
    key: string
  ) {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const verticalName = VERTICAL_METADATA[vertical].name;

    const message = `Namaste ${customerName} Ji,\n\nHere is your official offline activation license for *${storeName}* (${verticalName}):\n\n📌 *Plan:* ${planName}\n📅 *Valid Till:* ${expiryDate}\n🔑 *License Key:*\n\`\`\`\n${key}\n\`\`\`\n\n*Activation Instructions:*\n1. Open your IMS application on your desktop/laptop.\n2. Go to Subscription (or enter key on the renewal screen).\n3. Paste this key and click Apply.\n\nThank you for choosing our Offline IMS!`;

    const encoded = encodeURIComponent(message);
    return cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
  }

  // Days remaining helper
  function formatDaysRemaining(expiryDate: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);

    const diffTime = exp.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return { text: `Expired ${Math.abs(days)}d ago`, color: "text-rose-600 bg-rose-50 border-rose-200" };
    } else if (days <= 14) {
      return { text: `${days} days left`, color: "text-amber-700 bg-amber-50 border-amber-200" };
    } else {
      return { text: `${days} days left`, color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-xl shadow-sm">
              ⚡
            </div>
            <div>
              <div className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                IMS Cloud Admin
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Offline Key Authority
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Multi-Vertical Store Provisioning & HMAC-SHA256 Licensing
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-xs transition-all hover:shadow-md cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Issue New License Key
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Stores</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">{stats.total}</div>
            <div className="text-[11px] text-slate-500 mt-1">Across all business verticals</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Active Licenses</div>
            <div className="text-3xl font-extrabold text-emerald-600 mt-2">{stats.active}</div>
            <div className="text-[11px] text-emerald-700 mt-1">Full operational access</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Expiring Soon</div>
            <div className="text-3xl font-extrabold text-amber-600 mt-2">{stats.expiringSoon}</div>
            <div className="text-[11px] text-amber-700 mt-1">Needs renewal (&lt; 14 days)</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-600">Expired (Locked)</div>
            <div className="text-3xl font-extrabold text-rose-600 mt-2">{stats.expired}</div>
            <div className="text-[11px] text-rose-700 mt-1">Lockout active, data safe</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              ₹{stats.revenueInRupees.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Subscription earnings</div>
          </div>
        </div>

        {/* Business Vertical Distribution Pills */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Vertical Breakdown:</span>
          {(["agro", "pharma", "kirana", "general"] as BusinessType[]).map((v) => {
            const meta = VERTICAL_METADATA[v];
            const count = stats.byVertical[v] || 0;
            return (
              <span
                key={v}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold",
                  meta.bg,
                  meta.border,
                  meta.color
                )}
              >
                <span>{meta.icon}</span>
                <span>{meta.name}:</span>
                <strong className="font-black">{count}</strong>
              </span>
            );
          })}
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {[
                { id: "all", label: "All Stores" },
                { id: "agro", label: "🌱 Agro Kendra" },
                { id: "pharma", label: "💊 Pharmacy" },
                { id: "kirana", label: "🛒 Kirana" },
                { id: "general", label: "🏢 General" },
                { id: "expiring_soon", label: "⚠️ Expiring Soon" },
                { id: "expired", label: "⛔ Expired" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    activeTab === tab.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Search store, owner, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Customer Ledger Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Store & Owner</th>
                  <th className="py-3.5 px-4">Vertical</th>
                  <th className="py-3.5 px-4">Plan & Price</th>
                  <th className="py-3.5 px-4">Validity</th>
                  <th className="py-3.5 px-4">Offline License Key</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading stores & licenses...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No stores found matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => {
                    const meta = VERTICAL_METADATA[c.businessType];
                    const daysInfo = formatDaysRemaining(c.expiryDate);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900 text-sm">{c.storeName}</div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                            <span>👤 {c.customerName}</span>
                            {c.city && <span>• 📍 {c.city}</span>}
                          </div>
                          {c.phone && <div className="text-slate-400 text-[10px] mt-0.5">📞 {c.phone}</div>}
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[11px]",
                              meta.bg,
                              meta.border,
                              meta.color
                            )}
                          >
                            <span>{meta.icon}</span>
                            <span>{meta.name}</span>
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800">{c.planName}</div>
                          <div className="text-emerald-600 font-bold text-[11px] mt-0.5">
                            {c.pricePaise > 0 ? `₹${(c.pricePaise / 100).toLocaleString("en-IN")}` : "Free Trial"}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="text-slate-700 font-medium">
                            {new Date(c.startDate).toLocaleDateString("en-IN")} →{" "}
                            <strong className="text-slate-900">{new Date(c.expiryDate).toLocaleDateString("en-IN")}</strong>
                          </div>
                          <div className="mt-1">
                            <span className={clsx("inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold", daysInfo.color)}>
                              {daysInfo.text}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <code className="bg-slate-100 px-2 py-1 rounded font-mono text-[11px] text-slate-700 truncate max-w-[130px] border border-slate-200">
                              {c.subscriptionKey}
                            </code>
                            <button
                              onClick={() => copyToClipboard(c.subscriptionKey)}
                              title="Copy Key"
                              className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              {copiedKey === c.subscriptionKey ? (
                                <span className="text-[10px] font-bold text-emerald-600">✓</span>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide",
                              c.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : c.status === "expiring_soon"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}
                          >
                            <span
                              className={clsx(
                                "w-1.5 h-1.5 rounded-full",
                                c.status === "active"
                                  ? "bg-emerald-500"
                                  : c.status === "expiring_soon"
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              )}
                            />
                            {c.status === "active" ? "Active" : c.status === "expiring_soon" ? "Expiring" : "Expired"}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* WhatsApp Share */}
                            <a
                              href={getWhatsAppUrl(
                                c.phone,
                                c.customerName,
                                c.storeName,
                                c.businessType,
                                c.planName,
                                c.expiryDate,
                                c.subscriptionKey
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-all"
                              title="Send Key via WhatsApp"
                            >
                              💬
                            </a>

                            {/* Renew Button */}
                            <button
                              onClick={() => openRenewModal(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                            >
                              🔄 Renew
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL 1: Generate Key / Register Store */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Issue Offline Subscription Key</h3>
                <p className="text-xs text-slate-500">
                  Provision vertical edition & generate HMAC cryptographic offline key.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-5">
              {/* Step 1: Business Vertical Selection */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  1. Business Vertical Edition *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(["agro", "pharma", "kirana", "general"] as BusinessType[]).map((v) => {
                    const meta = VERTICAL_METADATA[v];
                    const selected = newForm.businessType === v;
                    return (
                      <div
                        key={v}
                        onClick={() => handleVerticalChange(v)}
                        className={clsx(
                          "p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between",
                          selected
                            ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs"
                            : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-2xl mb-1">{meta.icon}</span>
                        <div>
                          <div className="font-bold text-xs text-slate-900">{meta.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {v === "agro"
                              ? "Seeds, Fert, Pest"
                              : v === "pharma"
                              ? "Medicines & Rx"
                              : v === "kirana"
                              ? "Grocery & FMCG"
                              : "Retail Merchandise"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Store & Owner Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Store / Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kisan Krishi Seva Kendra"
                    value={newForm.storeName}
                    onChange={(e) => setNewForm({ ...newForm, storeName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Owner / Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={newForm.customerName}
                    onChange={(e) => setNewForm({ ...newForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Phone Number (for WhatsApp delivery)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98260 12345"
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    City / Tehsil / District
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sehore, MP"
                    value={newForm.city}
                    onChange={(e) => setNewForm({ ...newForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Step 3: Flexible Duration Setting */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    2. License Duration & Validity *
                  </label>
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Expires: {calculatedExpiryDate}
                  </div>
                </div>

                {/* Duration Mode Tabs */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200 rounded-xl text-xs font-semibold text-slate-600">
                  {[
                    { id: "preset", label: "Presets" },
                    { id: "months", label: "Custom Months" },
                    { id: "days", label: "Custom Days" },
                    { id: "date", label: "Exact Date" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setNewForm({ ...newForm, durationMode: mode.id as DurationUnit })}
                      className={clsx(
                        "py-1.5 rounded-lg text-center transition-all cursor-pointer",
                        newForm.durationMode === mode.id
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "hover:text-slate-900"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Duration Mode Sub-Inputs */}
                {newForm.durationMode === "preset" && (
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {[
                      { m: 1, label: "1 Mo" },
                      { m: 3, label: "3 Mo" },
                      { m: 6, label: "6 Mo" },
                      { m: 12, label: "1 Yr" },
                      { m: 24, label: "2 Yr" },
                    ].map((p) => (
                      <button
                        key={p.m}
                        type="button"
                        onClick={() => setNewForm({ ...newForm, presetMonths: p.m })}
                        className={clsx(
                          "py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          newForm.presetMonths === p.m
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                {newForm.durationMode === "months" && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={newForm.customMonths}
                      onChange={(e) =>
                        setNewForm({ ...newForm, customMonths: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-32 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 bg-white"
                    />
                    <span className="text-xs text-slate-600 font-medium">Months of validity from today</span>
                  </div>
                )}

                {newForm.durationMode === "days" && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={newForm.customDays}
                      onChange={(e) =>
                        setNewForm({ ...newForm, customDays: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-32 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 bg-white"
                    />
                    <span className="text-xs text-slate-600 font-medium">Days of validity from today</span>
                  </div>
                )}

                {newForm.durationMode === "date" && (
                  <div className="pt-1">
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={newForm.exactExpiryDate}
                      onChange={(e) => setNewForm({ ...newForm, exactExpiryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Step 4: Plan Name & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Subscription Plan Name
                  </label>
                  <input
                    type="text"
                    value={newForm.planName}
                    onChange={(e) => setNewForm({ ...newForm, planName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Price in INR (₹)
                  </label>
                  <input
                    type="number"
                    value={newForm.price}
                    onChange={(e) => setNewForm({ ...newForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  ⚠️ {formError}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Signing Offline Key..." : "✨ Issue & Generate Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 1-Click Renewal Modal */}
      {isRenewModalOpen && renewingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Renew Subscription</h3>
                <p className="text-xs text-slate-500">
                  {renewingCustomer.storeName} ({renewingCustomer.customerName})
                </p>
              </div>
              <button
                onClick={() => setIsRenewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenewCustomer} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500 text-[11px]">Current Expiry:</div>
                <div className="font-bold text-slate-900 text-sm">
                  {new Date(renewingCustomer.expiryDate).toLocaleDateString("en-IN")}
                </div>
              </div>

              {/* Renewal Duration Mode */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Select Extension Duration</label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200 rounded-xl text-xs font-semibold text-slate-600">
                  {[
                    { id: "preset", label: "Presets" },
                    { id: "months", label: "Months" },
                    { id: "days", label: "Days" },
                    { id: "date", label: "Exact Date" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setRenewForm({ ...renewForm, durationMode: mode.id as DurationUnit })}
                      className={clsx(
                        "py-1.5 rounded-lg text-center transition-all cursor-pointer",
                        renewForm.durationMode === mode.id
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "hover:text-slate-900"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {renewForm.durationMode === "preset" && (
                  <div className="grid grid-cols-5 gap-2 pt-2">
                    {[
                      { m: 1, label: "1 Mo" },
                      { m: 3, label: "3 Mo" },
                      { m: 6, label: "6 Mo" },
                      { m: 12, label: "1 Yr" },
                      { m: 24, label: "2 Yr" },
                    ].map((p) => (
                      <button
                        key={p.m}
                        type="button"
                        onClick={() => setRenewForm({ ...renewForm, presetMonths: p.m })}
                        className={clsx(
                          "py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          renewForm.presetMonths === p.m
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                {renewForm.durationMode === "months" && (
                  <input
                    type="number"
                    min={1}
                    value={renewForm.customMonths}
                    onChange={(e) =>
                      setRenewForm({ ...renewForm, customMonths: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl mt-2 font-bold"
                  />
                )}

                {renewForm.durationMode === "days" && (
                  <input
                    type="number"
                    min={1}
                    value={renewForm.customDays}
                    onChange={(e) =>
                      setRenewForm({ ...renewForm, customDays: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl mt-2 font-bold"
                  />
                )}

                {renewForm.durationMode === "date" && (
                  <input
                    type="date"
                    value={renewForm.exactExpiryDate}
                    onChange={(e) => setRenewForm({ ...renewForm, exactExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl mt-2 font-bold"
                  />
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Renewal Plan Name</label>
                <input
                  type="text"
                  value={renewForm.planName}
                  onChange={(e) => setRenewForm({ ...renewForm, planName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Price in INR (₹)</label>
                <input
                  type="number"
                  value={renewForm.price}
                  onChange={(e) => setRenewForm({ ...renewForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {submitting ? "Renewing..." : "🔄 Generate Renewal Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Key Generation Result Slip */}
      {generatedKeyResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-white/20 mx-auto flex items-center justify-center text-2xl">
                ✓
              </div>
              <h3 className="text-lg font-extrabold tracking-tight">Offline License Key Ready!</h3>
              <p className="text-xs text-emerald-100">
                100% Offline Compatible • Cryptographically HMAC-Signed
              </p>
            </div>

            {/* Slip Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Store Name:</span>
                  <strong className="text-slate-900 font-bold">{generatedKeyResult.storeName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner Name:</span>
                  <span className="text-slate-800 font-medium">{generatedKeyResult.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vertical:</span>
                  <span className="font-bold text-emerald-700">
                    {VERTICAL_METADATA[generatedKeyResult.businessType].icon}{" "}
                    {VERTICAL_METADATA[generatedKeyResult.businessType].name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plan:</span>
                  <span className="font-medium text-slate-800">{generatedKeyResult.planName}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Valid Till:</span>
                  <strong className="text-emerald-700 font-extrabold text-sm">
                    {new Date(generatedKeyResult.expiryDate).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </strong>
                </div>
              </div>

              {/* Key Code Block */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[11px] uppercase tracking-wider">
                  Offline Activation Key:
                </label>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] break-all select-all leading-relaxed shadow-inner">
                  {generatedKeyResult.key}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => copyToClipboard(generatedKeyResult.key)}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {copiedKey === generatedKeyResult.key ? (
                    <span className="text-emerald-600 font-bold">✓ Copied!</span>
                  ) : (
                    <span>📋 Copy License Key</span>
                  )}
                </button>

                <a
                  href={getWhatsAppUrl(
                    generatedKeyResult.phone,
                    generatedKeyResult.customerName,
                    generatedKeyResult.storeName,
                    generatedKeyResult.businessType,
                    generatedKeyResult.planName,
                    generatedKeyResult.expiryDate,
                    generatedKeyResult.key
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  <span>💬 Send on WhatsApp</span>
                </a>
              </div>

              <div className="text-center pt-2">
                <button
                  onClick={() => setGeneratedKeyResult(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Done & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
