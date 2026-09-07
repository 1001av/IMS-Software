import { query } from "@/database/client";
import type { DashboardSummary, Medicine } from "@/types/domain";

/**
 * All numbers here are computed from the actual local database rows —
 * never passed up from the UI — per product brief section 19/56.
 */
export async function getDashboardSummary(
  pharmacyId: string,
  expiringSoonDays = 90
): Promise<DashboardSummary> {
  const [totals] = await query<{ total_medicines: number; total_units: number; total_value: number }>(
    `SELECT
       COUNT(*) as total_medicines,
       COALESCE(SUM(quantity), 0) as total_units,
       COALESCE(SUM(quantity * purchase_price_paise), 0) as total_value
     FROM medicines
     WHERE pharmacy_id = ? AND is_deleted = 0`,
    [pharmacyId]
  );

  const [{ low_stock_count }] = await query<{ low_stock_count: number }>(
    `SELECT COUNT(*) as low_stock_count FROM medicines
     WHERE pharmacy_id = ? AND is_deleted = 0 AND quantity <= minimum_stock_level`,
    [pharmacyId]
  );

  const [{ expiring_soon_count }] = await query<{ expiring_soon_count: number }>(
    `SELECT COUNT(*) as expiring_soon_count FROM medicines
     WHERE pharmacy_id = ? AND is_deleted = 0
       AND expiry_date IS NOT NULL
       AND date(expiry_date) BETWEEN date('now') AND date('now', ?)`,
    [pharmacyId, `+${expiringSoonDays} days`]
  );

  const lowStock = await query<Medicine>(
    `SELECT * FROM medicines
     WHERE pharmacy_id = ? AND is_deleted = 0 AND quantity <= minimum_stock_level
     ORDER BY quantity ASC LIMIT 20`,
    [pharmacyId]
  );

  const expiringSoon = await query<Medicine>(
    `SELECT * FROM medicines
     WHERE pharmacy_id = ? AND is_deleted = 0
       AND expiry_date IS NOT NULL
       AND date(expiry_date) BETWEEN date('now') AND date('now', ?)
     ORDER BY date(expiry_date) ASC LIMIT 20`,
    [pharmacyId, `+${expiringSoonDays} days`]
  );

  let todaySalesPaise = 0;
  let todayInvoicesCount = 0;
  try {
    const [salesRow] = await query<{ today_sales: number; today_count: number }>(
      `SELECT 
         COALESCE(SUM(total_paise), 0) as today_sales,
         COUNT(*) as today_count
       FROM invoices
       WHERE pharmacy_id = ? AND status = 'completed' AND date(created_at) = date('now')`,
      [pharmacyId]
    );
    if (salesRow) {
      todaySalesPaise = salesRow.today_sales;
      todayInvoicesCount = salesRow.today_count;
    }
  } catch {
    // Invoices table might not have been loaded yet
  }

  return {
    total_medicines: totals.total_medicines,
    total_units: totals.total_units,
    total_inventory_value_paise: totals.total_value,
    low_stock_count: low_stock_count,
    expiring_soon_count: expiring_soon_count,
    today_sales_paise: todaySalesPaise,
    today_invoices_count: todayInvoicesCount,
    low_stock_medicines: lowStock,
    expiring_soon_medicines: expiringSoon,
  };
}

