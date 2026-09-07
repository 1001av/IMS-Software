import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { formatPaise, rupeesToPaise } from "@/utils/currency";
import { query } from "@/database/client";
import {
  cancelInvoice,
  createInvoice,
  listInvoices,
} from "@/services/billingService";
import { InvoiceReceiptModal } from "@/features/billing/InvoiceReceiptModal";
import { useBusinessConfig } from "@/utils/businessConfig";
import type {
  Invoice,
  Medicine,
  NewInvoiceInput,
  NewInvoiceItemInput,
  PaymentMethod,
} from "@/types/domain";

export function BillingPage() {
  const config = useBusinessConfig();
  const pharmacyId = localStorage.getItem("pharmacy_id") || "";
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");

  // --- POS State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemPriceRupees, setItemPriceRupees] = useState<string>("");
  const [itemDiscountRupees, setItemDiscountRupees] = useState<string>("0");

  const [cartItems, setCartItems] = useState<NewInvoiceItemInput[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [billDiscountRupees, setBillDiscountRupees] = useState("0");
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaidRupees, setAmountPaidRupees] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // --- Invoices History State ---
  const [historyInvoices, setHistoryInvoices] = useState<Invoice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilterDate, setHistoryFilterDate] = useState<"all" | "today" | "yesterday" | "7days">("all");
  const [historyFilterStatus, setHistoryFilterStatus] = useState<"all" | "completed" | "cancelled">("all");
  const [selectedHistoryInvoice, setSelectedHistoryInvoice] = useState<Invoice | null>(null);
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search medicines for POS dropdown
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const s = `%${searchQuery.trim()}%`;
        const results = await query<Medicine>(
          `SELECT * FROM medicines 
           WHERE pharmacy_id = ? AND is_deleted = 0 
             AND (name LIKE ? OR generic_name LIKE ? OR brand_name LIKE ? OR batch_number LIKE ?)
           ORDER BY quantity DESC, name ASC 
           LIMIT 12`,
          [pharmacyId, s, s, s, s]
        );
        setSearchResults(results);
      } catch (err) {
        console.error("Failed to search medicines:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, pharmacyId]);

  // Load Invoices History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;
      const today = new Date().toISOString().slice(0, 10);

      if (historyFilterDate === "today") {
        startDate = today;
        endDate = today;
      } else if (historyFilterDate === "yesterday") {
        const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        startDate = yest;
        endDate = yest;
      } else if (historyFilterDate === "7days") {
        startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        endDate = today;
      }

      const res = await listInvoices(pharmacyId, {
        search: historySearch,
        status: historyFilterStatus,
        startDate,
        endDate,
        pageSize: 50,
      });
      setHistoryInvoices(res.invoices);
    } catch (err) {
      console.error("Failed to load invoice history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, historyFilterDate, historyFilterStatus, historySearch]);

  // Select medicine from search results
  const handleSelectMedicine = (med: Medicine) => {
    setSelectedMedicine(med);
    setItemQty(1);
    const sellingPaise = med.selling_price_paise || med.purchase_price_paise;
    setItemPriceRupees((sellingPaise / 100).toFixed(2));
    setItemDiscountRupees("0");
    setSearchQuery("");
    setSearchResults([]);
    setBillingError(null);
  };

  // Add selected item to current bill
  const handleAddItemToCart = () => {
    if (!selectedMedicine) return;

    if (itemQty <= 0) {
      setBillingError("Quantity must be at least 1.");
      return;
    }

    if (itemQty > selectedMedicine.quantity) {
      setBillingError(
        `Quantity cannot exceed current stock of ${selectedMedicine.quantity} ${selectedMedicine.unit}.`
      );
      return;
    }

    const unitPricePaise = rupeesToPaise(itemPriceRupees);
    const discountPaise = rupeesToPaise(itemDiscountRupees);

    // Check if item already exists in cart
    const existingIndex = cartItems.findIndex(
      (item) => item.medicine_id === selectedMedicine.id
    );

    if (existingIndex >= 0) {
      const existing = cartItems[existingIndex];
      const newTotalQty = existing.quantity + itemQty;

      if (newTotalQty > selectedMedicine.quantity) {
        setBillingError(
          `Cannot add more. Total in bill (${newTotalQty}) exceeds stock (${selectedMedicine.quantity}).`
        );
        return;
      }

      const updatedCart = [...cartItems];
      updatedCart[existingIndex] = {
        ...existing,
        quantity: newTotalQty,
        unit_price_paise: unitPricePaise,
        discount_paise: (existing.discount_paise || 0) + discountPaise,
      };
      setCartItems(updatedCart);
    } else {
      const newItem: NewInvoiceItemInput = {
        medicine_id: selectedMedicine.id,
        medicine_name: selectedMedicine.name,
        batch_number: selectedMedicine.batch_number,
        expiry_date: selectedMedicine.expiry_date,
        unit: selectedMedicine.unit || "pcs",
        quantity: itemQty,
        purchase_price_paise: selectedMedicine.purchase_price_paise || 0,
        unit_price_paise: unitPricePaise,
        discount_paise: discountPaise,
      };
      setCartItems([...cartItems, newItem]);
    }

    // Reset selection
    setSelectedMedicine(null);
    setItemQty(1);
    setItemPriceRupees("");
    setItemDiscountRupees("0");
    setBillingError(null);
    searchInputRef.current?.focus();
  };

  // Modify cart item quantity
  const handleUpdateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(index);
      return;
    }
    const updated = [...cartItems];
    updated[index].quantity = newQty;
    setCartItems(updated);
  };

  // Remove cart item
  const handleRemoveCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  // Cart financial calculations
  const subtotalPaise = cartItems.reduce(
    (sum, item) => sum + Math.max(0, item.quantity * item.unit_price_paise - (item.discount_paise || 0)),
    0
  );
  const billDiscountPaise = rupeesToPaise(billDiscountRupees);
  const taxableSubtotal = Math.max(0, subtotalPaise - billDiscountPaise);
  const taxPaise = Math.round((taxableSubtotal * taxPercent) / 100);
  const totalPaise = Math.max(0, taxableSubtotal + taxPaise);

  const amountPaidPaise = rupeesToPaise(amountPaidRupees || (totalPaise / 100).toString());
  const changePaise = paymentMethod === "cash" ? Math.max(0, amountPaidPaise - totalPaise) : 0;

  // Clear bill
  const handleResetBill = () => {
    setCartItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setDoctorName("");
    setBillDiscountRupees("0");
    setTaxPercent(0);
    setPaymentMethod("cash");
    setAmountPaidRupees("");
    setNotes("");
    setSelectedMedicine(null);
    setBillingError(null);
  };

  // Submit invoice
  const handleCompleteSale = async (printImmediately: boolean) => {
    if (cartItems.length === 0) {
      setBillingError("Please add at least one item to the bill.");
      return;
    }

    setIsSubmitting(true);
    setBillingError(null);

    try {
      const input: NewInvoiceInput = {
        customer_name: customerName,
        customer_phone: customerPhone,
        doctor_name: doctorName,
        discount_paise: billDiscountPaise,
        tax_paise: taxPaise,
        payment_method: paymentMethod,
        amount_paid_paise: paymentMethod === "cash" ? amountPaidPaise : totalPaise,
        notes,
        items: cartItems,
      };

      const inv = await createInvoice(pharmacyId, input);

      setCreatedInvoice(inv);
      if (printImmediately) {
        setShowReceiptModal(true);
      }

      handleResetBill();
    } catch (err: any) {
      console.error("Failed to save invoice:", err);
      setBillingError(err?.message || "Failed to save invoice. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel invoice in history
  const handleCancelInvoice = async (invoiceId: string) => {
    if (!window.confirm("Are you sure you want to cancel this invoice? All medicines will be returned to stock.")) {
      return;
    }

    setCancellingInvoiceId(invoiceId);
    try {
      await cancelInvoice(invoiceId, "Customer return / cancelled by cashier");
      await loadHistory();
    } catch (err: any) {
      alert("Failed to cancel invoice: " + (err?.message || String(err)));
    } finally {
      setCancellingInvoiceId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-teal-50 text-brand border border-teal-200 flex items-center justify-center text-base shadow-xs">
              ₹
            </span>
            Billing & Invoicing
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quick point-of-sale checkout, receipt printing, and sales ledger.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("pos")}
            className={clsx(
              "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer",
              activeTab === "pos"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            New Sale (POS)
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={clsx(
              "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer",
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Invoices History
          </button>
        </div>
      </div>

      {billingError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{billingError}</span>
          </div>
          <button onClick={() => setBillingError(null)} className="font-bold text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* POS TAB */}
      {activeTab === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Medicine Search & Cart Items */}
          <div className="lg:col-span-2 space-y-5">
            {/* Item Search Bar with Dropdown */}
            <div className="card space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Search & Add {config.itemLabel}
                </span>
                {selectedMedicine && (
                  <button
                    onClick={() => setSelectedMedicine(null)}
                    className="text-xs text-slate-400 hover:text-slate-700 underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Type ${config.itemLabel.toLowerCase()} name, ${config.genericLabel.toLowerCase()}, or batch...`}
                  className="input pl-10 pr-4 py-2.5 text-sm w-full"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3 text-xs text-slate-400">Searching...</div>
                )}

                {/* Dropdown Results */}
                {searchResults.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in">
                    {searchResults.map((med) => {
                      const isLow = med.quantity <= med.minimum_stock_level;
                      const isOut = med.quantity <= 0;
                      const sellingPrice = med.selling_price_paise || med.purchase_price_paise;

                      return (
                        <div
                          key={med.id}
                          onClick={() => handleSelectMedicine(med)}
                          className={clsx(
                            "p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors",
                            isOut && "opacity-60 bg-slate-50/50"
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {med.name}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {med.generic_name || med.manufacturer || "General"}
                              {med.batch_number ? ` • Batch: ${med.batch_number}` : ""}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-3">
                            <div>
                              <div className="text-xs font-bold text-slate-800 font-mono">
                                {formatPaise(sellingPrice, "INR")}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                per {med.unit}
                              </div>
                            </div>

                            <div className="text-right min-w-[70px]">
                              {isOut ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  {med.quantity} left
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                                  {med.quantity} {med.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Medicine Action Row */}
              {selectedMedicine && (
                <div className="p-3.5 bg-teal-50/50 border border-teal-200/70 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900">
                        {selectedMedicine.name}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 font-mono">
                        (Stock: {selectedMedicine.quantity} {selectedMedicine.unit})
                      </span>
                    </div>
                    {selectedMedicine.expiry_date && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        Exp: {selectedMedicine.expiry_date.slice(0, 7)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Quantity ({selectedMedicine.unit})
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedMedicine.quantity}
                        value={itemQty}
                        onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Unit Rate (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemPriceRupees}
                        onChange={(e) => setItemPriceRupees(e.target.value)}
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Item Disc (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemDiscountRupees}
                        onChange={(e) => setItemDiscountRupees(e.target.value)}
                        className="input py-1.5 text-sm"
                      />
                    </div>

                    <div>
                      <button
                        onClick={handleAddItemToCart}
                        disabled={selectedMedicine.quantity <= 0}
                        className="btn-primary w-full py-1.5 text-xs font-semibold gap-1.5 flex items-center justify-center shadow-xs"
                      >
                        <span>+</span> Add to Bill
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bill Cart Table */}
            <div className="card p-0 overflow-hidden shadow-card">
              <div className="px-5 py-3.5 border-b border-line/80 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Items on Bill
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                    {cartItems.length}
                  </span>
                </div>
                {cartItems.length > 0 && (
                  <button
                    onClick={handleResetBill}
                    className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer"
                  >
                    Clear Bill
                  </button>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <div className="text-3xl">🛒</div>
                  <p className="text-sm font-medium text-slate-600">Bill is empty</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Search and select {config.itemLabelPlural.toLowerCase()} above to add them to this counter bill.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-line/80 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4 w-8">#</th>
                        <th className="py-2.5 px-4">{config.itemLabel}</th>
                        <th className="py-2.5 px-4">Batch</th>
                        <th className="py-2.5 px-4 text-center">Quantity</th>
                        <th className="py-2.5 px-4 text-right">Rate</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        <th className="py-2.5 px-4 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cartItems.map((item, idx) => {
                        const lineTotal = Math.max(
                          0,
                          item.quantity * item.unit_price_paise - (item.discount_paise || 0)
                        );

                        return (
                          <tr key={item.medicine_id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{item.medicine_name}</div>
                              {item.expiry_date && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Exp: {item.expiry_date.slice(0, 7)}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono">
                              {item.batch_number || "-"}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateCartQty(idx, item.quantity - 1)}
                                  className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                                >
                                  -
                                </button>
                                <span className="font-bold w-7 text-center font-mono">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateCartQty(idx, item.quantity + 1)}
                                  className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                                >
                                  +
                                </button>
                                <span className="text-[10px] text-slate-400 ml-1">{item.unit}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {formatPaise(item.unit_price_paise, "INR", { alwaysShowDecimals: true })}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatPaise(lineTotal, "INR", { alwaysShowDecimals: true })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleRemoveCartItem(idx)}
                                className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                title="Remove item"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Customer Info & Bill Totals */}
          <div className="space-y-5">
            {/* Customer Details Card */}
            <div className="card space-y-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                {config.customerLabel} & {config.referenceLabel} (Optional)
              </span>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  {config.customerLabel}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={config.customerPlaceholder || "e.g. Buyer Name (or leave blank)"}
                  className="input py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="input py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    {config.referenceLabel}
                  </label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder={config.referencePlaceholder || "e.g. Reference"}
                    className="input py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Bill Summary & Payment Card */}
            <div className="card space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block border-b border-line/80 pb-2">
                Payment & Checkout
              </span>

              {/* Discount & Tax inputs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Overall Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billDiscountRupees}
                    onChange={(e) => setBillDiscountRupees(e.target.value)}
                    className="input py-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Tax / GST
                  </label>
                  <select
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(parseInt(e.target.value) || 0)}
                    className="input py-1.5 text-xs cursor-pointer"
                  >
                    <option value={0}>0% (None / Inc.)</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                  </select>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["cash", "upi", "card", "credit"] as PaymentMethod[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMethod(mode)}
                      className={clsx(
                        "py-1.5 px-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 border cursor-pointer text-center",
                        paymentMethod === mode
                          ? "bg-brand text-white border-brand shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Return Calculator */}
              {paymentMethod === "cash" && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Cash Tendered (₹):</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder={(totalPaise / 100).toString()}
                      value={amountPaidRupees}
                      onChange={(e) => setAmountPaidRupees(e.target.value)}
                      className="input py-1 px-2 text-right w-28 text-xs font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-slate-200">
                    <span className="text-slate-600">Change to Return:</span>
                    <span className="font-mono text-emerald-700 text-sm">
                      {formatPaise(changePaise, "INR", { alwaysShowDecimals: true })}
                    </span>
                  </div>
                </div>
              )}

              {/* Calculation Summary Table */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-line/80">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatPaise(subtotalPaise, "INR", { alwaysShowDecimals: true })}</span>
                </div>
                {billDiscountPaise > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatPaise(billDiscountPaise, "INR", { alwaysShowDecimals: true })}</span>
                  </div>
                )}
                {taxPaise > 0 && (
                  <div className="flex justify-between">
                    <span>Tax ({taxPercent}%):</span>
                    <span className="font-mono">+{formatPaise(taxPaise, "INR", { alwaysShowDecimals: true })}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-900 font-bold text-sm pt-2 border-t border-line/80">
                  <span>Net Payable:</span>
                  <span className="text-xl font-mono text-brand">
                    {formatPaise(totalPaise, "INR", { alwaysShowDecimals: true })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleCompleteSale(true)}
                  disabled={cartItems.length === 0 || isSubmitting}
                  className="btn-primary w-full py-2.5 text-sm font-bold gap-2 flex items-center justify-center shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                  </svg>
                  Complete & Print Bill
                </button>

                <button
                  onClick={() => handleCompleteSale(false)}
                  disabled={cartItems.length === 0 || isSubmitting}
                  className="btn-secondary w-full py-2 text-xs font-semibold text-slate-700"
                >
                  Complete Sale Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVOICES HISTORY TAB */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 max-w-sm">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by invoice #, customer name, phone..."
                className="input py-1.5 text-xs w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                {(["all", "today", "yesterday", "7days"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setHistoryFilterDate(d)}
                    className={clsx(
                      "px-3 py-1 rounded-md capitalize font-medium transition-all",
                      historyFilterDate === d
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {d === "7days" ? "Last 7 Days" : d}
                  </button>
                ))}
              </div>

              <select
                value={historyFilterStatus}
                onChange={(e) => setHistoryFilterStatus(e.target.value as any)}
                className="input py-1 px-2.5 text-xs w-auto cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* History Table */}
          <div className="card p-0 overflow-hidden shadow-card">
            {historyLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Loading invoice records...
              </div>
            ) : historyInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-1">
                <p className="text-sm font-medium text-slate-600">No invoices found</p>
                <p className="text-xs">No sales match the selected filters or date range.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-line/80 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyInvoices.map((inv) => {
                      const isCancelled = inv.status === "cancelled";
                      const dateStr = new Date(inv.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                      const timeStr = new Date(inv.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      });

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            <div>{dateStr}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{timeStr}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{inv.customer_name || "Walk-in"}</div>
                            {inv.customer_phone && (
                              <div className="text-[10px] text-slate-400 font-mono">{inv.customer_phone}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="uppercase text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {inv.payment_method}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatPaise(inv.total_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isCancelled ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                Cancelled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                Completed
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={async () => {
                                const details = await listInvoices(pharmacyId, { search: inv.invoice_number });
                                if (details.invoices.length > 0) {
                                  // Fetch items
                                  const [full] = await query<Invoice>("SELECT * FROM invoices WHERE id = ?", [inv.id]);
                                  full.items = await query("SELECT * FROM invoice_items WHERE invoice_id = ?", [inv.id]);
                                  setSelectedHistoryInvoice(full);
                                  setShowReceiptModal(true);
                                }
                              }}
                              className="btn-secondary py-1 px-2.5 text-[11px] font-medium"
                            >
                              View / Print
                            </button>

                            {!isCancelled && (
                              <button
                                onClick={() => handleCancelInvoice(inv.id)}
                                disabled={cancellingInvoiceId === inv.id}
                                className="text-[11px] text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors"
                              >
                                {cancellingInvoiceId === inv.id ? "Cancelling..." : "Cancel Bill"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Receipt Modal */}
      <InvoiceReceiptModal
        invoice={selectedHistoryInvoice || createdInvoice}
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedHistoryInvoice(null);
        }}
      />
    </div>
  );
}
