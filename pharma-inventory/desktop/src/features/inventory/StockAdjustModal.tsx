import { useState } from "react";
import { Modal } from "@/components/Modal";
import { adjustStock } from "@/services/inventoryService";
import type { Medicine } from "@/types/domain";

interface Props {
  medicine: Medicine;
  onClose: () => void;
  onSaved: () => void;
}

export function StockAdjustModal({ medicine, onClose, onSaved }: Props) {
  const [newQuantity, setNewQuantity] = useState(String(medicine.quantity));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const qty = parseInt(newQuantity, 10);
    if (Number.isNaN(qty) || qty < 0) return setError("Enter a valid quantity.");
    setSaving(true);
    setError(null);
    try {
      await adjustStock(medicine.id, qty, reason.trim() || "Stock adjustment");
      onSaved();
    } catch (e: any) {
      console.error("Failed to update stock:", e);
      const msg = typeof e === "string" ? e : (e?.message || (e ? JSON.stringify(e) : "Could not update stock. Please try again."));
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Update Stock — ${medicine.name}`} onClose={onClose} widthClass="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="label">Current stock</label>
          <p className="text-lg font-medium">{medicine.quantity} {medicine.unit}</p>
        </div>
        <div>
          <label className="label">New stock *</label>
          <input
            className="input"
            type="number"
            min={0}
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Reason (optional)</label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Physical count correction"
          />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
