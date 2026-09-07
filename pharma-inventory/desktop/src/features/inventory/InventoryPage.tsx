import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { listMedicines, deleteMedicine } from "@/services/inventoryService";
import { useCurrentPharmacyId } from "@/utils/useCurrentPharmacyId";
import { formatPaise } from "@/utils/currency";
import { StatusBadge } from "@/components/StatusBadge";
import { MedicineFormModal } from "@/features/inventory/MedicineFormModal";
import { StockAdjustModal } from "@/features/inventory/StockAdjustModal";
import { Modal } from "@/components/Modal";
import { useBusinessConfig } from "@/utils/businessConfig";
import type { Medicine } from "@/types/domain";

type FilterKey = "all" | "low_stock" | "expiring_soon" | "expired";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Items" },
  { key: "low_stock", label: "Low Stock" },
  { key: "expiring_soon", label: "Expiring Soon" },
  { key: "expired", label: "Expired" },
];

export function InventoryPage() {
  const config = useBusinessConfig();
  const pharmacyId = useCurrentPharmacyId();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramStatus = searchParams.get("status") as FilterKey | null;
  const validStatus = paramStatus && ["all", "low_stock", "expiring_soon", "expired"].includes(paramStatus) ? paramStatus : "all";

  const [items, setItems] = useState<Medicine[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterKey>(validStatus);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Synchronize when search params change externally (e.g. navigation from dashboard)
  useEffect(() => {
    if (paramStatus && ["all", "low_stock", "expiring_soon", "expired"].includes(paramStatus)) {
      setStatus(paramStatus);
    }
  }, [paramStatus]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [adjustingMedicine, setAdjustingMedicine] = useState<Medicine | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMedicines(pharmacyId, { search, status, page, pageSize });
      setItems(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [pharmacyId, search, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (key: FilterKey) => {
    setStatus(key);
    setPage(1);
    setSearchParams(key === "all" ? {} : { status: key });
  };

  const handleDelete = async (id: string) => {
    await deleteMedicine(id);
    setDeletingId(null);
    load();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">{config.itemLabelPlural}</h1>
            <span className="bg-slate-100 text-subink text-xs font-bold px-2.5 py-0.5 rounded-full">
              {total} {total === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="text-sm text-subink mt-0.5">Manage stock, packaging units, pricing, and expiration dates.</p>
        </div>
        <button className="btn-primary gap-2 shadow-sm self-start sm:self-auto" onClick={() => setShowAddModal(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add {config.itemLabel}
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-5">
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-subink">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <input
            className="input pl-9"
            placeholder="Search by name, brand, batch, formula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-subink hover:text-ink cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-line/60 self-start sm:self-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer ${
                status === f.key
                  ? "bg-white text-ink shadow-subtle"
                  : "text-subink hover:text-ink hover:bg-white/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="card p-0 overflow-hidden border border-line/80 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-line/70">
              <tr>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-subink">{config.itemLabel}</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-subink">Batch</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-subink">Stock</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-subink">Purchase Price</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-subink">Expiry Date</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-subink">Total Value</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-subink">Status</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-subink text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 text-sm">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-subink">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Loading inventory...
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-subink">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-ink">No {config.itemLabelPlural.toLowerCase()} found</p>
                    <p className="text-xs text-subink mt-1">
                      {search ? `No items matched "${search}".` : "Your inventory list is empty. Add your first medicine to get started."}
                    </p>
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-ink">{m.name}</div>
                      {m.brand_name && <div className="text-xs text-subink">{m.brand_name}</div>}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-subink">{m.batch_number || "—"}</td>
                    <td className="px-4 py-3.5 font-semibold text-ink">
                      {m.quantity} <span className="text-xs text-subink font-normal">{m.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-ink">{formatPaise(m.purchase_price_paise)}</td>
                    <td className="px-4 py-3.5 text-xs text-subink">
                      {m.expiry_date ? new Date(m.expiry_date).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-ink">
                      {formatPaise(m.quantity * m.purchase_price_paise)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge medicine={m} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <button
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-ink transition-colors cursor-pointer"
                          onClick={() => setAdjustingMedicine(m)}
                        >
                          Stock
                        </button>
                        <button
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-ink transition-colors cursor-pointer"
                          onClick={() => setEditingMedicine(m)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-2.5 py-1 rounded-md hover:bg-rose-50 text-danger transition-colors cursor-pointer"
                          onClick={() => setDeletingId(m.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-line text-xs font-medium text-subink">
            <span>
              Page {page} of {totalPages} ({total} total medicines)
            </span>
            <div className="flex gap-2">
              <button
                className="btn-secondary !py-1 !px-3 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn-secondary !py-1 !px-3 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <MedicineFormModal
          pharmacyId={pharmacyId}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            load();
          }}
        />
      )}

      {editingMedicine && (
        <MedicineFormModal
          pharmacyId={pharmacyId}
          medicine={editingMedicine}
          onClose={() => setEditingMedicine(null)}
          onSaved={() => {
            setEditingMedicine(null);
            load();
          }}
        />
      )}

      {adjustingMedicine && (
        <StockAdjustModal
          medicine={adjustingMedicine}
          onClose={() => setAdjustingMedicine(null)}
          onSaved={() => {
            setAdjustingMedicine(null);
            load();
          }}
        />
      )}

      {deletingId && (
        <Modal title={`Delete ${config.itemLabel}`} onClose={() => setDeletingId(null)} widthClass="max-w-sm">
          <div className="space-y-4">
            <p className="text-sm text-subink">
              Are you sure you want to delete this {config.itemLabel.toLowerCase()}? It will be removed from your active inventory immediately.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button
                className="bg-danger hover:bg-danger/90 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
                onClick={() => handleDelete(deletingId)}
              >
                Delete {config.itemLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
