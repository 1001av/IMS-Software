import { v4 as uuidv4 } from "uuid";
import { query, transaction } from "@/database/client";
import type {
  Invoice,
  InvoiceFilter,
  InvoiceItem,
  Medicine,
  NewInvoiceInput,
} from "@/types/domain";

const nowIso = () => new Date().toISOString();

/**
 * Generates the next sequential invoice number for the pharmacy.
 * Format: INV-YYYYMMDD-XXXX (e.g. INV-20260905-0001)
 */
export async function generateNextInvoiceNumber(pharmacyId: string): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const prefix = `INV-${yyyy}${mm}${dd}-`;

  const rows = await query<{ invoice_number: string }>(
    `SELECT invoice_number FROM invoices 
     WHERE pharmacy_id = ? AND invoice_number LIKE ? 
     ORDER BY invoice_number DESC LIMIT 1`,
    [pharmacyId, `${prefix}%`]
  );

  if (rows.length > 0) {
    const lastNum = rows[0].invoice_number.replace(prefix, "");
    const seq = parseInt(lastNum, 10);
    if (!Number.isNaN(seq)) {
      return `${prefix}${String(seq + 1).padStart(4, "0")}`;
    }
  }

  return `${prefix}0001`;
}

/**
 * Creates an invoice and synchronously updates stock levels with audit movements.
 */
export async function createInvoice(
  pharmacyId: string,
  input: NewInvoiceInput
): Promise<Invoice> {
  if (!input.items || input.items.length === 0) {
    throw new Error("Cannot create an empty invoice with no items.");
  }

  const invoiceId = uuidv4();
  const invoiceNumber = await generateNextInvoiceNumber(pharmacyId);
  const ts = nowIso();

  // Calculate totals
  let subtotalPaise = 0;
  for (const item of input.items) {
    const itemTotal = item.quantity * item.unit_price_paise - (item.discount_paise || 0);
    subtotalPaise += Math.max(0, itemTotal);
  }

  const discountPaise = input.discount_paise || 0;
  const taxPaise = input.tax_paise || 0;
  const totalPaise = Math.max(0, subtotalPaise - discountPaise + taxPaise);
  const amountPaidPaise = input.amount_paid_paise || (input.payment_method === "credit" ? 0 : totalPaise);
  const changePaise = input.payment_method === "cash" ? Math.max(0, amountPaidPaise - totalPaise) : 0;

  // Verify stock availability for all items before committing
  for (const item of input.items) {
    const [med] = await query<Medicine>(
      "SELECT id, name, quantity FROM medicines WHERE id = ? AND is_deleted = 0",
      [item.medicine_id]
    );
    if (!med) {
      throw new Error(`Medicine "${item.medicine_name}" does not exist or has been removed.`);
    }
    if (med.quantity < item.quantity) {
      throw new Error(
        `Insufficient stock for "${item.medicine_name}". Available: ${med.quantity} ${item.unit}, requested: ${item.quantity} ${item.unit}.`
      );
    }
  }

  await transaction(async (run) => {
    // 1. Insert invoice header
    await run(
      `INSERT INTO invoices (
        id, pharmacy_id, invoice_number, customer_name, customer_phone, doctor_name,
        subtotal_paise, discount_paise, tax_paise, total_paise,
        payment_method, amount_paid_paise, change_paise, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
      [
        invoiceId,
        pharmacyId,
        invoiceNumber,
        input.customer_name?.trim() || "Walk-in Customer",
        input.customer_phone?.trim() || null,
        input.doctor_name?.trim() || null,
        subtotalPaise,
        discountPaise,
        taxPaise,
        totalPaise,
        input.payment_method,
        amountPaidPaise,
        changePaise,
        input.notes?.trim() || null,
        ts,
        ts,
      ]
    );

    // 2. Insert line items & update inventory
    for (const item of input.items) {
      const itemId = uuidv4();
      const lineTotalPaise = Math.max(0, item.quantity * item.unit_price_paise - (item.discount_paise || 0));

      await run(
        `INSERT INTO invoice_items (
          id, invoice_id, medicine_id, medicine_name, batch_number, expiry_date,
          unit, quantity, purchase_price_paise, unit_price_paise, discount_paise,
          total_paise, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          invoiceId,
          item.medicine_id,
          item.medicine_name,
          item.batch_number || null,
          item.expiry_date || null,
          item.unit || "pcs",
          item.quantity,
          item.purchase_price_paise || 0,
          item.unit_price_paise,
          item.discount_paise || 0,
          lineTotalPaise,
          ts,
        ]
      );

      // Deduct stock from medicines
      const [currentMed] = await query<Medicine>(
        "SELECT quantity FROM medicines WHERE id = ?",
        [item.medicine_id]
      );
      const prevQty = currentMed ? currentMed.quantity : 0;
      const newQty = Math.max(0, prevQty - item.quantity);

      await run(
        "UPDATE medicines SET quantity = ?, updated_at = ? WHERE id = ?",
        [newQty, ts, item.medicine_id]
      );

      // Record inventory movement
      await run(
        `INSERT INTO inventory_movements (
          id, medicine_id, type, quantity_before, quantity_after, reason, created_at
        ) VALUES (?, ?, 'sale', ?, ?, ?, ?)`,
        [
          uuidv4(),
          item.medicine_id,
          prevQty,
          newQty,
          `Sale: ${invoiceNumber}`,
          ts,
        ]
      );
    }
  });

  return (await getInvoiceDetails(invoiceId))!;
}

/**
 * Retrieves full invoice details including its line items.
 */
export async function getInvoiceDetails(invoiceId: string): Promise<Invoice | null> {
  const invoices = await query<Invoice>("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
  if (invoices.length === 0) return null;

  const invoice = invoices[0];
  const items = await query<InvoiceItem>(
    "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY created_at ASC",
    [invoiceId]
  );
  invoice.items = items;

  return invoice;
}

/**
 * Lists invoices with search, filters, and pagination.
 */
export async function listInvoices(
  pharmacyId: string,
  filter: InvoiceFilter = {}
): Promise<{ invoices: Invoice[]; totalCount: number }> {
  const clauses: string[] = ["pharmacy_id = ?"];
  const params: unknown[] = [pharmacyId];

  if (filter.search?.trim()) {
    const s = `%${filter.search.trim()}%`;
    clauses.push("(invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)");
    params.push(s, s, s);
  }

  if (filter.status && filter.status !== "all") {
    clauses.push("status = ?");
    params.push(filter.status);
  }

  if (filter.payment_method && filter.payment_method !== "all") {
    clauses.push("payment_method = ?");
    params.push(filter.payment_method);
  }

  if (filter.startDate) {
    clauses.push("date(created_at) >= date(?)");
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    clauses.push("date(created_at) <= date(?)");
    params.push(filter.endDate);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  // Get total count
  const [{ count }] = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM invoices ${whereClause}`,
    params
  );

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 30));
  const offset = (page - 1) * pageSize;

  const invoices = await query<Invoice>(
    `SELECT * FROM invoices ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return { invoices, totalCount: count };
}

/**
 * Cancels / returns an invoice, safely replenishing medicine stock levels
 * and recording an audit trail movement of type 'return'.
 */
export async function cancelInvoice(invoiceId: string, reason?: string): Promise<void> {
  const invoice = await getInvoiceDetails(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found.");
  }
  if (invoice.status === "cancelled") {
    throw new Error("This invoice is already cancelled.");
  }

  const ts = nowIso();

  await transaction(async (run) => {
    // 1. Mark invoice as cancelled
    await run(
      "UPDATE invoices SET status = 'cancelled', updated_at = ? WHERE id = ?",
      [ts, invoiceId]
    );

    // 2. Return each item to inventory
    if (invoice.items) {
      for (const item of invoice.items) {
        const [currentMed] = await query<Medicine>(
          "SELECT quantity FROM medicines WHERE id = ?",
          [item.medicine_id]
        );
        const prevQty = currentMed ? currentMed.quantity : 0;
        const restoredQty = prevQty + item.quantity;

        await run(
          "UPDATE medicines SET quantity = ?, updated_at = ? WHERE id = ?",
          [restoredQty, ts, item.medicine_id]
        );

        await run(
          `INSERT INTO inventory_movements (
            id, medicine_id, type, quantity_before, quantity_after, reason, created_at
          ) VALUES (?, ?, 'return', ?, ?, ?, ?)`,
          [
            uuidv4(),
            item.medicine_id,
            prevQty,
            restoredQty,
            `Returned: ${invoice.invoice_number}${reason ? ` (${reason})` : ""}`,
            ts,
          ]
        );
      }
    }
  });
}
