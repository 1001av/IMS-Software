import { useEffect, useState } from "react";
import clsx from "clsx";
import { formatPaise } from "@/utils/currency";
import { downloadCsv, type CsvColumn } from "@/utils/exportCsv";
import {
  getExpiryReport,
  getInventoryValuationReport,
  getLowStockReorderReport,
  getMovementAuditReport,
  getSalesReport,
} from "@/services/reportsService";
import { useBusinessConfig } from "@/utils/businessConfig";
import type {
  ExpiryAlertRow,
  MovementAuditRow,
  ReorderItemRow,
  SalesReportSummary,
  SalesTransactionRow,
  StockValuationRow,
} from "@/types/domain";

type ReportTab = "sales" | "valuation" | "reorder" | "expiry" | "audit";

export function ReportsPage() {
  const config = useBusinessConfig();
  const pharmacyId = localStorage.getItem("pharmacy_id") || "";
  const [activeTab, setActiveTab] = useState<ReportTab>("sales");
  const [loading, setLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Filters
  const [salesDatePreset, setSalesDatePreset] = useState<"today" | "7days" | "30days" | "all">("today");
  const [expiryDays, setExpiryDays] = useState<number>(90);
  const [auditType, setAuditType] = useState<string>("all");

  // Data states
  const [salesData, setSalesData] = useState<{
    summary: SalesReportSummary;
    transactions: SalesTransactionRow[];
  } | null>(null);

  const [valuationData, setValuationData] = useState<{
    summary: {
      total_skus: number;
      total_units: number;
      total_cost_paise: number;
      total_retail_paise: number;
      potential_profit_paise: number;
    };
    rows: StockValuationRow[];
  } | null>(null);

  const [reorderData, setReorderData] = useState<{
    summary: {
      items_needing_reorder: number;
      out_of_stock_count: number;
      estimated_restock_paise: number;
    };
    rows: ReorderItemRow[];
  } | null>(null);

  const [expiryData, setExpiryData] = useState<{
    summary: {
      expired_count: number;
      expired_value_paise: number;
      expiring_soon_count: number;
      expiring_soon_value_paise: number;
      total_value_at_risk_paise: number;
    };
    rows: ExpiryAlertRow[];
  } | null>(null);

  const [auditRows, setAuditRows] = useState<MovementAuditRow[]>([]);

  // Load active tab data
  const loadData = async () => {
    if (!pharmacyId) return;
    setLoading(true);
    setExportMessage(null);

    try {
      if (activeTab === "sales") {
        let startDate: string | undefined;
        let endDate: string | undefined;
        const todayStr = new Date().toISOString().slice(0, 10);

        if (salesDatePreset === "today") {
          startDate = todayStr;
          endDate = todayStr;
        } else if (salesDatePreset === "7days") {
          startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          endDate = todayStr;
        } else if (salesDatePreset === "30days") {
          startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
          endDate = todayStr;
        }

        const data = await getSalesReport(pharmacyId, startDate, endDate);
        setSalesData(data);
      } else if (activeTab === "valuation") {
        const data = await getInventoryValuationReport(pharmacyId);
        setValuationData(data);
      } else if (activeTab === "reorder") {
        const data = await getLowStockReorderReport(pharmacyId);
        setReorderData(data);
      } else if (activeTab === "expiry") {
        const data = await getExpiryReport(pharmacyId, expiryDays);
        setExpiryData(data);
      } else if (activeTab === "audit") {
        const rows = await getMovementAuditReport(pharmacyId, undefined, undefined, auditType);
        setAuditRows(rows);
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, salesDatePreset, expiryDays, auditType]);

  const triggerPrint = () => {
    window.print();
  };

  // CSV Export Handlers
  const handleExportSalesCsv = async () => {
    if (!salesData) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const columns: CsvColumn<SalesTransactionRow>[] = [
      { header: "Invoice Number", accessor: (r) => r.invoice_number },
      { header: "Date", accessor: (r) => r.created_at.slice(0, 10) },
      { header: `${config.customerLabel.split("/")[0].trim()} Name`, accessor: (r) => r.customer_name },
      { header: "Phone", accessor: (r) => r.customer_phone },
      { header: "Payment Method", accessor: (r) => r.payment_method },
      { header: "Items Count", accessor: (r) => r.items_count },
      { header: "Subtotal (INR)", accessor: (r) => (r.subtotal_paise / 100).toFixed(2) },
      { header: "Discount (INR)", accessor: (r) => (r.discount_paise / 100).toFixed(2) },
      { header: "Tax (INR)", accessor: (r) => (r.tax_paise / 100).toFixed(2) },
      { header: "Total Paid (INR)", accessor: (r) => (r.total_paise / 100).toFixed(2) },
      { header: "Gross Profit (INR)", accessor: (r) => (r.profit_paise / 100).toFixed(2) },
      { header: "Status", accessor: (r) => r.status },
    ];

    const success = await downloadCsv(`sales-report-${dateStr}.csv`, columns, salesData.transactions);
    if (success) setExportMessage("Sales report successfully exported to CSV.");
  };

  const handleExportValuationCsv = async () => {
    if (!valuationData) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const columns: CsvColumn<StockValuationRow>[] = [
      { header: `${config.itemLabel} Name`, accessor: (r) => r.name },
      { header: config.genericLabel, accessor: (r) => r.generic_name || "" },
      { header: "Category", accessor: (r) => r.category || "" },
      { header: "Batch / Lot", accessor: (r) => r.batch_number || "" },
      { header: "Expiry Date", accessor: (r) => r.expiry_date || "" },
      { header: "Current Stock", accessor: (r) => r.quantity },
      { header: "Unit", accessor: (r) => r.unit },
      { header: "Purchase Price (INR)", accessor: (r) => (r.purchase_price_paise / 100).toFixed(2) },
      { header: "Selling Price (INR)", accessor: (r) => (r.selling_price_paise / 100).toFixed(2) },
      { header: "Total Cost Value (INR)", accessor: (r) => (r.total_cost_paise / 100).toFixed(2) },
      { header: "Total Retail Value (INR)", accessor: (r) => (r.total_retail_paise / 100).toFixed(2) },
    ];

    const success = await downloadCsv(`inventory-valuation-${dateStr}.csv`, columns, valuationData.rows);
    if (success) setExportMessage("Inventory valuation report exported to CSV.");
  };

  const handleExportReorderCsv = async () => {
    if (!reorderData) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const columns: CsvColumn<ReorderItemRow>[] = [
      { header: `${config.itemLabel} Name`, accessor: (r) => r.name },
      { header: config.genericLabel, accessor: (r) => r.generic_name || "" },
      { header: "Current Stock", accessor: (r) => r.quantity },
      { header: "Min Stock Level", accessor: (r) => r.minimum_stock_level },
      { header: "Deficit / Reorder Qty", accessor: (r) => r.deficit },
      { header: "Unit", accessor: (r) => r.unit },
      { header: "Supplier", accessor: (r) => r.supplier_name || "" },
      { header: "Purchase Price (INR)", accessor: (r) => (r.purchase_price_paise / 100).toFixed(2) },
      { header: "Est Restock Cost (INR)", accessor: (r) => (r.estimated_cost_paise / 100).toFixed(2) },
    ];

    const success = await downloadCsv(`low-stock-reorder-${dateStr}.csv`, columns, reorderData.rows);
    if (success) setExportMessage("Low stock reorder report exported to CSV.");
  };

  const handleExportExpiryCsv = async () => {
    if (!expiryData) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const columns: CsvColumn<ExpiryAlertRow>[] = [
      { header: `${config.itemLabel} Name`, accessor: (r) => r.name },
      { header: "Batch / Lot", accessor: (r) => r.batch_number || "" },
      { header: "Expiry Date", accessor: (r) => r.expiry_date },
      { header: "Days Remaining", accessor: (r) => r.days_remaining },
      { header: "Units In Stock", accessor: (r) => r.quantity },
      { header: "Unit", accessor: (r) => r.unit },
      { header: "Purchase Price (INR)", accessor: (r) => (r.purchase_price_paise / 100).toFixed(2) },
      { header: "Value at Risk (INR)", accessor: (r) => (r.value_at_risk_paise / 100).toFixed(2) },
      { header: "Status", accessor: (r) => r.status.toUpperCase() },
    ];

    const success = await downloadCsv(`expiry-alert-report-${dateStr}.csv`, columns, expiryData.rows);
    if (success) setExportMessage("Expiry alerts exported to CSV.");
  };

  const handleExportAuditCsv = async () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const columns: CsvColumn<MovementAuditRow>[] = [
      { header: "Timestamp", accessor: (r) => r.created_at },
      { header: config.itemLabel, accessor: (r) => r.medicine_name },
      { header: "Movement Type", accessor: (r) => r.type.toUpperCase() },
      { header: "Before Qty", accessor: (r) => r.quantity_before },
      { header: "After Qty", accessor: (r) => r.quantity_after },
      { header: "Net Change", accessor: (r) => r.change },
      { header: "Reason", accessor: (r) => r.reason || "" },
    ];

    const success = await downloadCsv(`inventory-audit-trail-${dateStr}.csv`, columns, auditRows);
    if (success) setExportMessage("Audit trail exported to CSV.");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header (Hidden during Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-teal-50 text-brand border border-teal-200 flex items-center justify-center text-base shadow-xs">
              📊
            </span>
            Reports & Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time financial summaries, inventory valuation, reorder sheets, and CSV exports.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={triggerPrint}
            className="btn-secondary py-2 px-3.5 text-xs font-semibold gap-1.5 flex items-center cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            Print / PDF
          </button>

          {activeTab === "sales" && (
            <button
              onClick={handleExportSalesCsv}
              className="btn-primary py-2 px-3.5 text-xs font-semibold gap-1.5 flex items-center shadow-xs"
            >
              📥 Export CSV
            </button>
          )}
          {activeTab === "valuation" && (
            <button
              onClick={handleExportValuationCsv}
              className="btn-primary py-2 px-3.5 text-xs font-semibold gap-1.5 flex items-center shadow-xs"
            >
              📥 Export CSV
            </button>
          )}
          {activeTab === "reorder" && (
            <button
              onClick={handleExportReorderCsv}
              className="btn-primary py-2 px-3.5 text-xs font-semibold gap-1.5 flex items-center shadow-xs"
            >
              📥 Export CSV
            </button>
          )}
          {activeTab === "expiry" && (
            <button
              onClick={handleExportExpiryCsv}
              className="btn-primary py-2 px-3.5 text-xs font-semibold gap-1.5 flex items-center shadow-xs"
            >
              📥 Export CSV
            </button>
          )}
          {activeTab === "audit" && (
            <button
              onClick={handleExportAuditCsv}
              className="btn-primary py-2 px-3.5 text-xs font-semibold gap-1.5 flex items-center shadow-xs"
            >
              📥 Export CSV
            </button>
          )}
        </div>
      </div>

      {exportMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center justify-between print:hidden">
          <span>✓ {exportMessage}</span>
          <button onClick={() => setExportMessage(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs (Hidden during Print) */}
      <div className="border-b border-line/80 flex gap-2 overflow-x-auto print:hidden">
        {[
          { id: "sales", label: "Sales & Revenue" },
          { id: "valuation", label: "Stock Valuation" },
          { id: "reorder", label: "Low Stock & Reorder" },
          { id: "expiry", label: "Expiry Alerts" },
          { id: "audit", label: "Audit Movements" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={clsx(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === tab.id
                ? "border-brand text-brand bg-teal-50/50 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-900"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Print Document Title (Shown ONLY during Print) */}
      <div className="hidden print:block text-center border-b border-slate-300 pb-3 mb-4">
        <h1 className="text-lg font-bold uppercase text-slate-900">
          Pharma Inventory Management — Report
        </h1>
        <p className="text-xs text-slate-600">
          Generated on {new Date().toLocaleString("en-IN")} • Active Report: {activeTab.toUpperCase()}
        </p>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          Loading report data...
        </div>
      ) : (
        <>
          {/* TAB 1: SALES & REVENUE */}
          {activeTab === "sales" && salesData && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="flex items-center justify-between gap-3 bg-white p-3.5 border border-line rounded-xl shadow-subtle print:hidden">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Date Range
                </span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                  {[
                    { id: "today", label: "Today" },
                    { id: "7days", label: "Last 7 Days" },
                    { id: "30days", label: "Last 30 Days" },
                    { id: "all", label: "All Time" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSalesDatePreset(p.id as any)}
                      className={clsx(
                        "px-3 py-1 rounded-md font-medium transition-all",
                        salesDatePreset === p.id
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Revenue
                  </div>
                  <div className="text-2xl font-bold font-mono text-brand">
                    {formatPaise(salesData.summary.total_sales_paise, "INR")}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {salesData.summary.total_invoices_count} completed invoices
                  </div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Est. Gross Margin
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-600">
                    {formatPaise(salesData.summary.total_profit_paise, "INR")}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Sales revenue minus purchase cost
                  </div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Items Sold
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900">
                    {salesData.summary.total_items_sold}
                  </div>
                  <div className="text-[11px] text-slate-400">Medicines / units dispensed</div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Payment Breakdown
                  </div>
                  <div className="text-xs space-y-1 pt-1 font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Cash:</span>
                      <span className="font-semibold">
                        {formatPaise(salesData.summary.payment_breakdown.cash_paise, "INR")}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>UPI:</span>
                      <span className="font-semibold">
                        {formatPaise(salesData.summary.payment_breakdown.upi_paise, "INR")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="card p-0 overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-line/80 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sales Transactions ({salesData.transactions.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-line/80 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">Invoice #</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Customer</th>
                        <th className="py-2.5 px-4 text-center">Items</th>
                        <th className="py-2.5 px-4">Payment</th>
                        <th className="py-2.5 px-4 text-right">Subtotal</th>
                        <th className="py-2.5 px-4 text-right">Discount</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        <th className="py-2.5 px-4 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salesData.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {tx.invoice_number}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(tx.created_at).toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">
                            {tx.customer_name}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">{tx.items_count}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                              {tx.payment_method}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {formatPaise(tx.subtotal_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600">
                            {tx.discount_paise > 0
                              ? `-${formatPaise(tx.discount_paise, "INR", { alwaysShowDecimals: true })}`
                              : "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatPaise(tx.total_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700 font-medium">
                            {formatPaise(tx.profit_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STOCK VALUATION */}
          {activeTab === "valuation" && valuationData && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total SKUs & Units
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900">
                    {valuationData.summary.total_skus} <span className="text-xs font-normal text-slate-500">{config.itemLabelPlural.toLowerCase()}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {valuationData.summary.total_units} total physical units on shelf
                  </div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Inventory Valuation (Cost)
                  </div>
                  <div className="text-2xl font-bold font-mono text-brand">
                    {formatPaise(valuationData.summary.total_cost_paise, "INR")}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Calculated using unit purchase prices
                  </div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Potential Retail Value
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900">
                    {formatPaise(valuationData.summary.total_retail_paise, "INR")}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    If sold at current selling prices
                  </div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Potential Gross Margin
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-600">
                    {formatPaise(valuationData.summary.potential_profit_paise, "INR")}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Retail value minus cost
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="card p-0 overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-line/80 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {config.itemLabel} Stock List ({valuationData.rows.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-line/80 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">{config.itemLabel} Name</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Batch</th>
                        <th className="py-2.5 px-4">Expiry</th>
                        <th className="py-2.5 px-4 text-center">Stock</th>
                        <th className="py-2.5 px-4 text-right">Cost Rate</th>
                        <th className="py-2.5 px-4 text-right">Selling Rate</th>
                        <th className="py-2.5 px-4 text-right">Total Cost</th>
                        <th className="py-2.5 px-4 text-right">Total Retail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {valuationData.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {row.name}
                            {row.generic_name && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {row.generic_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500">{row.category || "-"}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono">{row.batch_number || "-"}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono">{row.expiry_date || "-"}</td>
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {row.quantity} {row.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {formatPaise(row.purchase_price_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {formatPaise(row.selling_price_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                            {formatPaise(row.total_cost_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-brand font-medium">
                            {formatPaise(row.total_retail_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOW STOCK & REORDER */}
          {activeTab === "reorder" && reorderData && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {config.itemLabelPlural} to Reorder
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-700">
                    {reorderData.summary.items_needing_reorder}
                  </div>
                  <div className="text-[11px] text-slate-400">At or below minimum threshold</div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Out of Stock (Zero Units)
                  </div>
                  <div className="text-2xl font-bold font-mono text-red-600">
                    {reorderData.summary.out_of_stock_count}
                  </div>
                  <div className="text-[11px] text-slate-400">Immediate purchase required</div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Est. Restock Budget
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900">
                    {formatPaise(reorderData.summary.estimated_restock_paise, "INR")}
                  </div>
                  <div className="text-[11px] text-slate-400">Cost to restore to minimum levels</div>
                </div>
              </div>

              {/* Table */}
              <div className="card p-0 overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-line/80 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Reorder Requisition Sheet ({reorderData.rows.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-line/80 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">{config.itemLabel} Name</th>
                        <th className="py-2.5 px-4 text-center">Current Stock</th>
                        <th className="py-2.5 px-4 text-center">Min Level</th>
                        <th className="py-2.5 px-4 text-center">Reorder Deficit</th>
                        <th className="py-2.5 px-4">Supplier</th>
                        <th className="py-2.5 px-4 text-right">Cost Rate</th>
                        <th className="py-2.5 px-4 text-right">Est. Restock Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reorderData.rows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {r.name}
                            {r.generic_name && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {r.generic_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={clsx(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                r.quantity <= 0
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800"
                              )}
                            >
                              {r.quantity} {r.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">{r.minimum_stock_level}</td>
                          <td className="py-3 px-4 text-center font-bold text-brand font-mono">
                            +{r.deficit} {r.unit}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{r.supplier_name || "-"}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {formatPaise(r.purchase_price_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatPaise(r.estimated_cost_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXPIRY ALERTS */}
          {activeTab === "expiry" && expiryData && (
            <div className="space-y-6">
              {/* Threshold selector */}
              <div className="flex items-center justify-between gap-3 bg-white p-3.5 border border-line rounded-xl shadow-subtle print:hidden">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Expiry Threshold Window
                </span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
                  {[30, 60, 90, 180].map((days) => (
                    <button
                      key={days}
                      onClick={() => setExpiryDays(days)}
                      className={clsx(
                        "px-3 py-1 rounded-md font-medium transition-all",
                        expiryDays === days
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Already Expired
                  </div>
                  <div className="text-2xl font-bold font-mono text-red-600">
                    {expiryData.summary.expired_count} <span className="text-xs font-normal">items</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Value: {formatPaise(expiryData.summary.expired_value_paise, "INR")}
                  </div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Expiring Within {expiryDays} Days
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-700">
                    {expiryData.summary.expiring_soon_count} <span className="text-xs font-normal">items</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Value: {formatPaise(expiryData.summary.expiring_soon_value_paise, "INR")}
                  </div>
                </div>

                <div className="card space-y-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Value at Risk
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900">
                    {formatPaise(expiryData.summary.total_value_at_risk_paise, "INR")}
                  </div>
                  <div className="text-[11px] text-slate-400">Return to supplier before deadline</div>
                </div>
              </div>

              {/* Table */}
              <div className="card p-0 overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-line/80 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Expiry Review List ({expiryData.rows.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-line/80 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">{config.itemLabel} Name</th>
                        <th className="py-2.5 px-4">Batch</th>
                        <th className="py-2.5 px-4">Expiry Date</th>
                        <th className="py-2.5 px-4 text-center">Remaining</th>
                        <th className="py-2.5 px-4 text-center">In Stock</th>
                        <th className="py-2.5 px-4 text-right">Cost Rate</th>
                        <th className="py-2.5 px-4 text-right">Value at Risk</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expiryData.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">{row.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{row.batch_number || "-"}</td>
                          <td className="py-3 px-4 font-mono font-medium">{row.expiry_date}</td>
                          <td className="py-3 px-4 text-center font-mono">
                            {row.days_remaining < 0 ? (
                              <span className="text-red-700 font-bold">
                                {Math.abs(row.days_remaining)}d ago
                              </span>
                            ) : (
                              <span className="text-amber-800 font-medium">
                                {row.days_remaining} days
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {row.quantity} {row.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {formatPaise(row.purchase_price_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatPaise(row.value_at_risk_paise, "INR", { alwaysShowDecimals: true })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {row.status === "expired" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                EXPIRED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                EXPIRING SOON
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT MOVEMENTS */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              {/* Type filter */}
              <div className="flex items-center justify-between gap-3 bg-white p-3.5 border border-line rounded-xl shadow-subtle print:hidden">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Filter by Movement Type
                </span>
                <select
                  value={auditType}
                  onChange={(e) => setAuditType(e.target.value)}
                  className="input py-1 px-3 text-xs w-auto cursor-pointer"
                >
                  <option value="all">All Movements</option>
                  <option value="sale">Sales Only</option>
                  <option value="return">Returns Only</option>
                  <option value="adjustment">Adjustments Only</option>
                  <option value="initial">Initial Additions Only</option>
                </select>
              </div>

              {/* Table */}
              <div className="card p-0 overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-line/80 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Audit Trail Log ({auditRows.length} recent events)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-line/80 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">Date & Time</th>
                        <th className="py-2.5 px-4">{config.itemLabel}</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4 text-center">Before</th>
                        <th className="py-2.5 px-4 text-center">After</th>
                        <th className="py-2.5 px-4 text-center">Net Change</th>
                        <th className="py-2.5 px-4">Reason / Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {new Date(row.created_at).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {row.medicine_name}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={clsx(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                row.type === "sale" && "bg-teal-50 text-brand border border-teal-200",
                                row.type === "return" && "bg-purple-50 text-purple-700 border border-purple-200",
                                row.type === "adjustment" && "bg-amber-50 text-amber-700 border border-amber-200",
                                row.type === "initial" && "bg-blue-50 text-blue-700 border border-blue-200"
                              )}
                            >
                              {row.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500">
                            {row.quantity_before}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                            {row.quantity_after}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            {row.change > 0 ? (
                              <span className="text-emerald-700">+{row.change}</span>
                            ) : row.change < 0 ? (
                              <span className="text-red-700">{row.change}</span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{row.reason || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
