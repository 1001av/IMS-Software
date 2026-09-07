import { useEffect, useState } from "react";
import { query } from "@/database/client";
import { formatPaise } from "@/utils/currency";
import { useBusinessConfig } from "@/utils/businessConfig";
import type { Invoice, Pharmacy } from "@/types/domain";

interface InvoiceReceiptModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceReceiptModal({ invoice, isOpen, onClose }: InvoiceReceiptModalProps) {
  const config = useBusinessConfig();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [licenses, setLicenses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      query<Pharmacy>("SELECT * FROM pharmacy LIMIT 1")
        .then(([p]) => {
          if (p) setPharmacy(p);
        })
        .catch(console.error);

      query<{ key: string; value: string }>(
        "SELECT * FROM settings WHERE key LIKE 'license_%' OR key = 'gstin'"
      )
        .then((rows) => {
          const map: Record<string, string> = {};
          rows.forEach((r) => {
            if (r.value) map[r.key] = r.value;
          });
          setLicenses(map);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(invoice.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = new Date(invoice.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-line max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none print:w-full print:rounded-none">
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand"></span>
            <span className="text-sm font-bold text-ink">Invoice Receipt Preview</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary py-1.5 px-3 text-xs gap-1.5 flex items-center shadow-xs"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-ink rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Printable Receipt Area */}
        <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible text-slate-800 text-xs font-mono space-y-4">
          {/* Receipt Header */}
          <div className="text-center border-b border-dashed border-slate-300 pb-3">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 font-sans">
              {pharmacy?.name || config.storeNamePlaceholder.replace("e.g. ", "") || config.appName}
            </h2>
            {pharmacy?.owner_name && (
              <p className="text-[11px] text-slate-500 font-sans">Prop: {pharmacy.owner_name}</p>
            )}
            {pharmacy?.address && (
              <p className="text-[11px] text-slate-500 font-sans max-w-xs mx-auto mt-0.5">
                {pharmacy.address}
              </p>
            )}
            {pharmacy?.phone && (
              <p className="text-[11px] text-slate-500 font-sans">Ph: {pharmacy.phone}</p>
            )}

            {/* Statutory Agricultural / Retail Licenses */}
            {Object.keys(licenses).length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] text-slate-600 font-mono">
                {licenses.license_pesticide && <span>Pest Lic: {licenses.license_pesticide}</span>}
                {licenses.license_fertilizer && <span>Fert Lic: {licenses.license_fertilizer}</span>}
                {licenses.license_seed && <span>Seed Lic: {licenses.license_seed}</span>}
                {licenses.license_drug && <span>Drug Lic: {licenses.license_drug}</span>}
                {licenses.license_fssai && <span>FSSAI: {licenses.license_fssai}</span>}
                {licenses.gstin && <span>GSTIN: {licenses.gstin}</span>}
              </div>
            )}

            <div className="mt-2 inline-block px-2.5 py-0.5 border border-slate-700 text-[10px] font-bold tracking-wider uppercase font-sans">
              {config.receiptTitle}
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-dashed border-slate-300 pb-2 font-sans">
            <div>
              <span className="text-slate-500">Invoice No: </span>
              <strong className="text-slate-900 font-mono">{invoice.invoice_number}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Date: </span>
              <span>{formattedDate} {formattedTime}</span>
            </div>
            <div>
              <span className="text-slate-500">{config.customerLabel.split("/")[0].trim()}: </span>
              <strong>{invoice.customer_name || "Walk-in Buyer"}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Phone: </span>
              <span>{invoice.customer_phone || "-"}</span>
            </div>
            {invoice.doctor_name && (
              <div className="col-span-2">
                <span className="text-slate-500">{config.referenceLabel}: </span>
                <span>{invoice.doctor_name}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Payment: </span>
              <span className="uppercase font-semibold text-brand">{invoice.payment_method}</span>
            </div>
            {invoice.status === "cancelled" && (
              <div className="text-right">
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 font-bold uppercase rounded text-[10px]">
                  CANCELLED
                </span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="font-sans">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-600 font-semibold">
                  <th className="text-left py-1 w-6">#</th>
                  <th className="text-left py-1">{config.itemLabel}</th>
                  <th className="text-left py-1">Batch / Lot</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Rate</th>
                  <th className="text-right py-1">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items?.map((item, idx) => (
                  <tr key={item.id} className="align-top">
                    <td className="py-1 text-slate-400">{idx + 1}</td>
                    <td className="py-1 font-medium text-slate-900 pr-1">
                      {item.medicine_name}
                      {item.expiry_date && (
                        <span className="block text-[9px] text-slate-400 font-mono">
                          Exp: {item.expiry_date.slice(0, 7)}
                        </span>
                      )}
                    </td>
                    <td className="py-1 text-slate-500 font-mono text-[10px]">
                      {item.batch_number || "-"}
                    </td>
                    <td className="py-1 text-center font-bold">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1 text-right text-slate-600 font-mono">
                      {formatPaise(item.unit_price_paise, "INR", { alwaysShowDecimals: true })}
                    </td>
                    <td className="py-1 text-right font-bold font-mono text-slate-900">
                      {formatPaise(item.total_paise, "INR", { alwaysShowDecimals: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Calculation */}
          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 font-sans text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">
                {formatPaise(invoice.subtotal_paise, "INR", { alwaysShowDecimals: true })}
              </span>
            </div>

            {invoice.discount_paise > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span className="font-mono font-medium">
                  -{formatPaise(invoice.discount_paise, "INR", { alwaysShowDecimals: true })}
                </span>
              </div>
            )}

            {invoice.tax_paise > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax / GST:</span>
                <span className="font-mono font-medium">
                  +{formatPaise(invoice.tax_paise, "INR", { alwaysShowDecimals: true })}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm font-bold border-t border-slate-800 pt-1.5 text-slate-900">
              <span>Grand Total:</span>
              <span className="text-base font-mono text-brand">
                {formatPaise(invoice.total_paise, "INR", { alwaysShowDecimals: true })}
              </span>
            </div>

            {invoice.payment_method === "cash" && invoice.amount_paid_paise > 0 && (
              <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
                <span>Cash Received: {formatPaise(invoice.amount_paid_paise, "INR")}</span>
                <span>Change Returned: {formatPaise(invoice.change_paise, "INR")}</span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center border-t border-dashed border-slate-300 pt-3 text-[10px] text-slate-500 font-sans space-y-1">
            <p className="font-medium text-slate-700">{config.receiptFooter}</p>
            <p className="text-[9px] text-slate-400">Powered by {config.appName} Offline Desktop</p>
          </div>
        </div>

        {/* Modal Footer (Hidden in Print) */}
        <div className="px-6 py-3 border-t border-line bg-slate-50 flex justify-end gap-2 print:hidden">
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-xs">
            Close
          </button>
          <button onClick={handlePrint} className="btn-primary py-1.5 px-4 text-xs gap-1.5 flex items-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
