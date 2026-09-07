import { useState } from "react";
import { Modal } from "@/components/Modal";
import { addMedicine, updateMedicine } from "@/services/inventoryService";
import { rupeesToPaise } from "@/utils/currency";
import { useBusinessConfig } from "@/utils/businessConfig";
import type { Medicine } from "@/types/domain";

interface Props {
  pharmacyId: string;
  medicine?: Medicine; // present when editing
  onClose: () => void;
  onSaved: () => void;
}

export function MedicineFormModal({ pharmacyId, medicine, onClose, onSaved }: Props) {
  const config = useBusinessConfig();
  const isEdit = !!medicine;

  const [name, setName] = useState(medicine?.name ?? "");
  const [quantity, setQuantity] = useState(String(medicine?.quantity ?? ""));
  const [unit, setUnit] = useState(medicine?.unit ?? config.units[0] ?? "pcs");
  const [purchasePrice, setPurchasePrice] = useState(
    medicine ? String(medicine.purchase_price_paise / 100) : ""
  );
  const [showMore, setShowMore] = useState(isEdit);
  const [genericName, setGenericName] = useState(medicine?.generic_name ?? "");
  const [brandName, setBrandName] = useState(medicine?.brand_name ?? "");
  const [category, setCategory] = useState(medicine?.category ?? config.categories[0] ?? "");
  const [manufacturer, setManufacturer] = useState(medicine?.manufacturer ?? "");
  const [batchNumber, setBatchNumber] = useState(medicine?.batch_number ?? "");
  const [expiryDate, setExpiryDate] = useState(medicine?.expiry_date ?? "");
  const [sellingPrice, setSellingPrice] = useState(
    medicine?.selling_price_paise != null ? String(medicine.selling_price_paise / 100) : ""
  );
  const [minStock, setMinStock] = useState(String(medicine?.minimum_stock_level ?? "0"));
  const [supplierName, setSupplierName] = useState(medicine?.supplier_name ?? "");
  const [location, setLocation] = useState(medicine?.location ?? "");
  const [notes, setNotes] = useState(medicine?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return setError(`${config.itemLabel} name is required.`);
    const qty = parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty < 0) return setError("Enter a valid quantity.");
    const purchasePaise = rupeesToPaise(purchasePrice);
    if (!purchasePrice || purchasePaise <= 0) return setError("Enter a valid purchase price.");

    setSaving(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        quantity: qty,
        unit: unit.trim() || "pcs",
        purchase_price_paise: purchasePaise,
        generic_name: genericName.trim() || undefined,
        brand_name: brandName.trim() || undefined,
        category: category.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        batch_number: batchNumber.trim() || undefined,
        expiry_date: expiryDate || undefined,
        selling_price_paise: sellingPrice ? rupeesToPaise(sellingPrice) : undefined,
        minimum_stock_level: minStock ? parseInt(minStock, 10) : 0,
        supplier_name: supplierName.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEdit && medicine) {
        await updateMedicine(medicine.id, input);
      } else {
        await addMedicine(pharmacyId, input);
      }
      onSaved();
    } catch (e: any) {
      console.error("Failed to save product:", e);
      const msg = typeof e === "string" ? e : (e?.message || (e ? JSON.stringify(e) : "Could not save the item. Please try again."));
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${config.itemLabel}` : `Add ${config.itemLabel}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">{config.itemLabel} name *</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={config.id === "agro" ? "e.g. Coragen, Confidor, DAP 50kg" : "Product name"}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Quantity *</label>
            <input
              className="input"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Packaging Unit</label>
            <select
              className="input bg-canvas cursor-pointer"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {config.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Purchase price (₹) *</label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {!showMore && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-brand hover:text-brandhover text-xs font-bold transition-colors cursor-pointer py-1"
            onClick={() => setShowMore(true)}
          >
            <span>+</span> Add more details (Batch, Expiry, {config.genericLabel}, etc.)
          </button>
        )}

        {showMore && (
          <div className="space-y-4 pt-2 border-t border-line">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{config.genericLabel}</label>
                <input
                  className="input"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  placeholder={config.genericPlaceholder}
                />
              </div>

              <div>
                <label className="label">Brand / Manufacturer</label>
                <input
                  className="input"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder={config.id === "agro" ? "e.g. Bayer, Syngenta, FMC, IFFCO" : "Brand / Company"}
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  className="input bg-canvas cursor-pointer"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select category...</option>
                  {config.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Company / Marketer</label>
                <input
                  className="input"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Manufacturing company"
                />
              </div>

              <div>
                <label className="label">Batch Number</label>
                <input
                  className="input"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. B-2026-09"
                />
              </div>

              <div>
                <label className="label">Expiry Date</label>
                <input
                  className="input"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Selling price / MRP (₹)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="Optional retail price"
                />
              </div>

              <div>
                <label className="label">Minimum stock alert level</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Distributor / Supplier</label>
                <input
                  className="input"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Distributor / C&F name"
                />
              </div>

              <div>
                <label className="label">Godown / Rack Location</label>
                <input
                  className="input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Godown 1, Shelf B"
                />
              </div>
            </div>

            <div>
              <label className="label">Usage Notes / Target Crops / Dosage</label>
              <textarea
                className="input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={config.id === "agro" ? "e.g. 2ml per litre of water. Recommended for Paddy, Cotton." : "Additional notes"}
              />
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-xs font-semibold">⚠️ {error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : `Add ${config.itemLabel}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
