import { query } from "@/database/client";
import type {
  ExpiryAlertRow,
  MovementAuditRow,
  ReorderItemRow,
  SalesReportSummary,
  SalesTransactionRow,
  StockValuationRow,
} from "@/types/domain";

/**
 * Generates a comprehensive sales & revenue report for a given date range.
 */
export async function getSalesReport(
  pharmacyId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  summary: SalesReportSummary;
  transactions: SalesTransactionRow[];
}> {
  const clauses: string[] = ["i.pharmacy_id = ?", "i.status = 'completed'"];
  const params: unknown[] = [pharmacyId];

  if (startDate) {
    clauses.push("date(i.created_at) >= date(?)");
    params.push(startDate);
  }
  if (endDate) {
    clauses.push("date(i.created_at) <= date(?)");
    params.push(endDate);
  }

  const whereSql = `WHERE ${clauses.join(" AND ")}`;

  // Query individual transactions with items count and cost aggregates
  const rawTransactions = await query<{
    id: string;
    invoice_number: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    payment_method: string;
    subtotal_paise: number;
    discount_paise: number;
    tax_paise: number;
    total_paise: number;
    status: string;
    items_count: number;
    total_cost_paise: number;
  }>(
    `SELECT 
      i.id,
      i.invoice_number,
      i.created_at,
      i.customer_name,
      i.customer_phone,
      i.payment_method,
      i.subtotal_paise,
      i.discount_paise,
      i.tax_paise,
      i.total_paise,
      i.status,
      COALESCE(SUM(ii.quantity), 0) as items_count,
      COALESCE(SUM(ii.quantity * ii.purchase_price_paise), 0) as total_cost_paise
    FROM invoices i
    LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
    ${whereSql}
    GROUP BY i.id
    ORDER BY i.created_at DESC`,
    params
  );

  let totalSales = 0;
  let totalItems = 0;
  let totalCost = 0;
  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;
  let creditSales = 0;

  const transactions: SalesTransactionRow[] = rawTransactions.map((tx) => {
    const profit = Math.max(0, tx.total_paise - tx.total_cost_paise);
    totalSales += tx.total_paise;
    totalItems += tx.items_count;
    totalCost += tx.total_cost_paise;

    switch (tx.payment_method) {
      case "cash":
        cashSales += tx.total_paise;
        break;
      case "upi":
        upiSales += tx.total_paise;
        break;
      case "card":
        cardSales += tx.total_paise;
        break;
      case "credit":
        creditSales += tx.total_paise;
        break;
    }

    return {
      id: tx.id,
      invoice_number: tx.invoice_number,
      created_at: tx.created_at,
      customer_name: tx.customer_name || "Walk-in Customer",
      customer_phone: tx.customer_phone || "-",
      items_count: Number(tx.items_count),
      payment_method: tx.payment_method.toUpperCase(),
      subtotal_paise: tx.subtotal_paise,
      discount_paise: tx.discount_paise,
      tax_paise: tx.tax_paise,
      total_paise: tx.total_paise,
      profit_paise: profit,
      status: tx.status,
    };
  });

  const summary: SalesReportSummary = {
    total_sales_paise: totalSales,
    total_invoices_count: transactions.length,
    total_items_sold: totalItems,
    total_profit_paise: Math.max(0, totalSales - totalCost),
    payment_breakdown: {
      cash_paise: cashSales,
      upi_paise: upiSales,
      card_paise: cardSales,
      credit_paise: creditSales,
    },
  };

  return { summary, transactions };
}

/**
 * Generates an inventory valuation report calculating cost vs potential retail value.
 */
export async function getInventoryValuationReport(
  pharmacyId: string,
  category?: string
): Promise<{
  summary: {
    total_skus: number;
    total_units: number;
    total_cost_paise: number;
    total_retail_paise: number;
    potential_profit_paise: number;
  };
  rows: StockValuationRow[];
}> {
  const clauses: string[] = ["pharmacy_id = ?", "is_deleted = 0"];
  const params: unknown[] = [pharmacyId];

  if (category && category !== "all") {
    clauses.push("category = ?");
    params.push(category);
  }

  const whereSql = `WHERE ${clauses.join(" AND ")}`;

  const medicines = await query<{
    id: string;
    name: string;
    generic_name: string | null;
    category: string | null;
    batch_number: string | null;
    expiry_date: string | null;
    quantity: number;
    unit: string;
    purchase_price_paise: number;
    selling_price_paise: number | null;
  }>(
    `SELECT id, name, generic_name, category, batch_number, expiry_date,
            quantity, unit, purchase_price_paise, selling_price_paise
     FROM medicines
     ${whereSql}
     ORDER BY name ASC`,
    params
  );

  let totalUnits = 0;
  let totalCost = 0;
  let totalRetail = 0;

  const rows: StockValuationRow[] = medicines.map((m) => {
    const qty = Math.max(0, m.quantity);
    const purchasePrice = m.purchase_price_paise || 0;
    const sellingPrice = m.selling_price_paise || purchasePrice;
    const itemCost = qty * purchasePrice;
    const itemRetail = qty * sellingPrice;

    totalUnits += qty;
    totalCost += itemCost;
    totalRetail += itemRetail;

    return {
      id: m.id,
      name: m.name,
      generic_name: m.generic_name,
      category: m.category,
      batch_number: m.batch_number,
      expiry_date: m.expiry_date,
      quantity: qty,
      unit: m.unit || "pcs",
      purchase_price_paise: purchasePrice,
      selling_price_paise: sellingPrice,
      total_cost_paise: itemCost,
      total_retail_paise: itemRetail,
    };
  });

  return {
    summary: {
      total_skus: rows.length,
      total_units: totalUnits,
      total_cost_paise: totalCost,
      total_retail_paise: totalRetail,
      potential_profit_paise: Math.max(0, totalRetail - totalCost),
    },
    rows,
  };
}

/**
 * Generates low stock and reorder requirements report.
 */
export async function getLowStockReorderReport(pharmacyId: string): Promise<{
  summary: {
    items_needing_reorder: number;
    out_of_stock_count: number;
    estimated_restock_paise: number;
  };
  rows: ReorderItemRow[];
}> {
  const medicines = await query<{
    id: string;
    name: string;
    generic_name: string | null;
    quantity: number;
    minimum_stock_level: number;
    unit: string;
    supplier_name: string | null;
    purchase_price_paise: number;
  }>(
    `SELECT id, name, generic_name, quantity, minimum_stock_level, unit,
            supplier_name, purchase_price_paise
     FROM medicines
     WHERE pharmacy_id = ? AND is_deleted = 0 AND quantity <= minimum_stock_level
     ORDER BY quantity ASC, name ASC`,
    [pharmacyId]
  );

  let outOfStock = 0;
  let totalRestockCost = 0;

  const rows: ReorderItemRow[] = medicines.map((m) => {
    const deficit = Math.max(1, m.minimum_stock_level - m.quantity);
    const cost = deficit * (m.purchase_price_paise || 0);

    if (m.quantity <= 0) outOfStock++;
    totalRestockCost += cost;

    return {
      id: m.id,
      name: m.name,
      generic_name: m.generic_name,
      quantity: m.quantity,
      minimum_stock_level: m.minimum_stock_level,
      deficit,
      unit: m.unit || "pcs",
      supplier_name: m.supplier_name,
      purchase_price_paise: m.purchase_price_paise || 0,
      estimated_cost_paise: cost,
    };
  });

  return {
    summary: {
      items_needing_reorder: rows.length,
      out_of_stock_count: outOfStock,
      estimated_restock_paise: totalRestockCost,
    },
    rows,
  };
}

/**
 * Generates an expiry alert report for expired and near-expiry items.
 */
export async function getExpiryReport(
  pharmacyId: string,
  daysThreshold: number = 90
): Promise<{
  summary: {
    expired_count: number;
    expired_value_paise: number;
    expiring_soon_count: number;
    expiring_soon_value_paise: number;
    total_value_at_risk_paise: number;
  };
  rows: ExpiryAlertRow[];
}> {
  const medicines = await query<{
    id: string;
    name: string;
    batch_number: string | null;
    expiry_date: string;
    quantity: number;
    unit: string;
    purchase_price_paise: number;
  }>(
    `SELECT id, name, batch_number, expiry_date, quantity, unit, purchase_price_paise
     FROM medicines
     WHERE pharmacy_id = ? 
       AND is_deleted = 0 
       AND expiry_date IS NOT NULL
       AND date(expiry_date) <= date('now', '+' || ? || ' days')
     ORDER BY date(expiry_date) ASC`,
    [pharmacyId, daysThreshold]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let expiredCount = 0;
  let expiredValue = 0;
  let expiringCount = 0;
  let expiringValue = 0;

  const rows: ExpiryAlertRow[] = medicines.map((m) => {
    const expDate = new Date(m.expiry_date);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = daysRemaining < 0;
    const value = Math.max(0, m.quantity * (m.purchase_price_paise || 0));

    if (isExpired) {
      expiredCount++;
      expiredValue += value;
    } else {
      expiringCount++;
      expiringValue += value;
    }

    return {
      id: m.id,
      name: m.name,
      batch_number: m.batch_number,
      expiry_date: m.expiry_date,
      days_remaining: daysRemaining,
      quantity: m.quantity,
      unit: m.unit || "pcs",
      purchase_price_paise: m.purchase_price_paise || 0,
      value_at_risk_paise: value,
      status: isExpired ? "expired" : "expiring_soon",
    };
  });

  return {
    summary: {
      expired_count: expiredCount,
      expired_value_paise: expiredValue,
      expiring_soon_count: expiringCount,
      expiring_soon_value_paise: expiringValue,
      total_value_at_risk_paise: expiredValue + expiringValue,
    },
    rows,
  };
}

/**
 * Retrieves the audit trail of inventory movements.
 */
export async function getMovementAuditReport(
  pharmacyId: string,
  startDate?: string,
  endDate?: string,
  type?: string
): Promise<MovementAuditRow[]> {
  const clauses: string[] = ["m.pharmacy_id = ?"];
  const params: unknown[] = [pharmacyId];

  if (startDate) {
    clauses.push("date(im.created_at) >= date(?)");
    params.push(startDate);
  }
  if (endDate) {
    clauses.push("date(im.created_at) <= date(?)");
    params.push(endDate);
  }
  if (type && type !== "all") {
    clauses.push("im.type = ?");
    params.push(type);
  }

  const whereSql = `WHERE ${clauses.join(" AND ")}`;

  const rows = await query<{
    id: string;
    created_at: string;
    medicine_name: string;
    type: string;
    quantity_before: number;
    quantity_after: number;
    reason: string | null;
  }>(
    `SELECT 
      im.id,
      im.created_at,
      m.name as medicine_name,
      im.type,
      im.quantity_before,
      im.quantity_after,
      im.reason
    FROM inventory_movements im
    JOIN medicines m ON im.medicine_id = m.id
    ${whereSql}
    ORDER BY im.created_at DESC
    LIMIT 200`,
    params
  );

  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    medicine_name: r.medicine_name,
    type: r.type,
    quantity_before: r.quantity_before,
    quantity_after: r.quantity_after,
    change: r.quantity_after - r.quantity_before,
    reason: r.reason,
  }));
}
