import { v4 as uuidv4 } from "uuid";
import { execute, query, transaction } from "@/database/client";
import type { Medicine, NewMedicineInput } from "@/types/domain";

const nowIso = () => new Date().toISOString();

/** Adds a medicine. Only name, quantity, and purchase price are required —
 *  everything else the pharmacy owner can skip and fill in later. */
export async function addMedicine(pharmacyId: string, input: NewMedicineInput): Promise<Medicine> {
  const id = uuidv4();
  const ts = nowIso();

  await transaction(async (run) => {
    await run(
      `INSERT INTO medicines (
        id, pharmacy_id, name, generic_name, brand_name, category, manufacturer,
        batch_number, expiry_date, quantity, unit, purchase_price_paise,
        selling_price_paise, minimum_stock_level, supplier_name, location, notes,
        created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        pharmacyId,
        input.name,
        input.generic_name ?? null,
        input.brand_name ?? null,
        input.category ?? null,
        input.manufacturer ?? null,
        input.batch_number ?? null,
        input.expiry_date ?? null,
        input.quantity,
        input.unit ?? "pcs",
        input.purchase_price_paise,
        input.selling_price_paise ?? null,
        input.minimum_stock_level ?? 0,
        input.supplier_name ?? null,
        input.location ?? null,
        input.notes ?? null,
        ts,
        ts,
      ]
    );

    // Record the opening stock as an "initial" movement so history is
    // complete from day one (product brief section 25).
    await run(
      `INSERT INTO inventory_movements (id, medicine_id, type, quantity_before, quantity_after, reason, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uuidv4(), id, "initial", 0, input.quantity, "Medicine added", ts]
    );
  });

  const [created] = await query<Medicine>("SELECT * FROM medicines WHERE id = ?", [id]);
  return created;
}

export async function updateMedicine(id: string, changes: Partial<NewMedicineInput>): Promise<void> {
  const fields = Object.keys(changes);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (changes as Record<string, unknown>)[f]);
  await execute(`UPDATE medicines SET ${setClause}, updated_at = ? WHERE id = ?`, [
    ...values,
    nowIso(),
    id,
  ]);
}

/** Soft delete — never physically removes a row, so accidental deletes are recoverable. */
export async function deleteMedicine(id: string): Promise<void> {
  await execute("UPDATE medicines SET is_deleted = 1, updated_at = ? WHERE id = ?", [nowIso(), id]);
}

/** Direct stock adjustment (product brief section 22 — simple set, not a full ledger). */
export async function adjustStock(id: string, newQuantity: number, reason: string): Promise<void> {
  const [medicine] = await query<Medicine>("SELECT * FROM medicines WHERE id = ?", [id]);
  if (!medicine) throw new Error("Medicine not found");

  await transaction(async (run) => {
    await run("UPDATE medicines SET quantity = ?, updated_at = ? WHERE id = ?", [
      newQuantity,
      nowIso(),
      id,
    ]);
    await run(
      `INSERT INTO inventory_movements (id, medicine_id, type, quantity_before, quantity_after, reason, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [uuidv4(), id, "adjustment", medicine.quantity, newQuantity, reason, nowIso()]
    );
  });
}

export interface ListMedicinesOptions {
  search?: string;
  status?: "all" | "low_stock" | "expiring_soon" | "expired";
  expiringSoonDays?: number;
  page?: number;
  pageSize?: number;
}

/** Search + filter, run entirely in SQLite (never loads the whole table into JS memory
 *  — product brief section 26). */
export async function listMedicines(
  pharmacyId: string,
  opts: ListMedicinesOptions = {}
): Promise<{ items: Medicine[]; total: number }> {
  const { search, status = "all", expiringSoonDays = 90, page = 1, pageSize = 50 } = opts;

  const where: string[] = ["pharmacy_id = ?", "is_deleted = 0"];
  const params: unknown[] = [pharmacyId];

  if (search && search.trim()) {
    where.push(
      "(name LIKE ? OR generic_name LIKE ? OR brand_name LIKE ? OR batch_number LIKE ? OR manufacturer LIKE ?)"
    );
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  if (status === "low_stock") {
    where.push("quantity <= minimum_stock_level");
  } else if (status === "expiring_soon") {
    where.push("expiry_date IS NOT NULL AND date(expiry_date) BETWEEN date('now') AND date('now', ?)");
    params.push(`+${expiringSoonDays} days`);
  } else if (status === "expired") {
    where.push("expiry_date IS NOT NULL AND date(expiry_date) < date('now')");
  }

  const whereClause = where.join(" AND ");

  const [{ count }] = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM medicines WHERE ${whereClause}`,
    params
  );

  const items = await query<Medicine>(
    `SELECT * FROM medicines WHERE ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );

  return { items, total: count };
}

export async function getMedicineMovements(medicineId: string) {
  return query(
    "SELECT * FROM inventory_movements WHERE medicine_id = ? ORDER BY created_at DESC",
    [medicineId]
  );
}
