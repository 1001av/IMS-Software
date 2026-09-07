// Core domain types. Money is always in paise (integer) at the data layer;
// convert to rupees only at display time via utils/currency.ts.

export interface Pharmacy {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  business_type?: string;
  license_pesticide?: string | null;
  license_seed?: string | null;
  license_fertilizer?: string | null;
  license_drug?: string | null;
  gstin?: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  pharmacy_id: string;
  name: string;
  email: string;
  role: "owner" | "staff";
  created_at: string;
  updated_at: string;
}

export interface Medicine {
  id: string;
  pharmacy_id: string;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  category: string | null;
  manufacturer: string | null;
  batch_number: string | null;
  expiry_date: string | null; // ISO date
  quantity: number;
  unit: string;
  purchase_price_paise: number;
  selling_price_paise: number | null;
  minimum_stock_level: number;
  supplier_name: string | null;
  location: string | null;
  notes: string | null;
  is_deleted: number; // 0 | 1 (SQLite boolean)
  created_at: string;
  updated_at: string;
}

/** Fields the "Add medicine" form actually requires — everything else optional. */
export interface NewMedicineInput {
  name: string;
  quantity: number;
  purchase_price_paise: number;
  generic_name?: string;
  brand_name?: string;
  category?: string;
  manufacturer?: string;
  batch_number?: string;
  expiry_date?: string;
  unit?: string;
  selling_price_paise?: number;
  minimum_stock_level?: number;
  supplier_name?: string;
  location?: string;
  notes?: string;
}

export type MovementType = "adjustment" | "initial" | "import" | "sale" | "return";

export interface InventoryMovement {
  id: string;
  medicine_id: string;
  type: MovementType;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  created_at: string;
}

export type MedicineStockStatus = "ok" | "low" | "expiring_soon" | "expired";

export interface DashboardSummary {
  total_medicines: number;
  total_units: number;
  total_inventory_value_paise: number;
  low_stock_count: number;
  expiring_soon_count: number;
  today_sales_paise?: number;
  today_invoices_count?: number;
  low_stock_medicines: Medicine[];
  expiring_soon_medicines: Medicine[];
}

export type SubscriptionStatus = "active" | "expiring_soon" | "expired";

export interface Subscription {
  id: string;
  customer_name: string;
  plan_name: string;
  price_paise: number;
  start_date: string;
  expiry_date: string;
  status: SubscriptionStatus;
  subscription_key?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BackupRecord {
  id: string;
  file_path: string;
  file_size_bytes: number;
  backup_type: "manual" | "auto";
  status: "success" | "failed";
  created_at: string;
}

export interface DatabaseInfo {
  path: string;
  exists: boolean;
  size_bytes: number;
}

export type LicenseStatus = "active" | "grace" | "suspended" | "expired";

export interface LicenseInfo {
  license_key: string;
  plan_name: string | null;
  medicine_limit: number | null;
  status: LicenseStatus;
  expiry_date: string | null;
  grace_period_days: number;
  last_verified_at: string | null;
}

export interface InventoryFilter {
  search?: string;
  status?: "all" | "low_stock" | "expiring_soon" | "expired";
  page?: number;
  pageSize?: number;
}

export type PaymentMethod = "cash" | "upi" | "card" | "credit";
export type InvoiceStatus = "completed" | "cancelled";

export interface Invoice {
  id: string;
  pharmacy_id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  doctor_name: string | null;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  total_paise: number;
  payment_method: PaymentMethod;
  amount_paid_paise: number;
  change_paise: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  medicine_id: string;
  medicine_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  unit: string;
  quantity: number;
  purchase_price_paise: number;
  unit_price_paise: number;
  discount_paise: number;
  total_paise: number;
  created_at: string;
}

export interface NewInvoiceItemInput {
  medicine_id: string;
  medicine_name: string;
  batch_number?: string | null;
  expiry_date?: string | null;
  unit: string;
  quantity: number;
  purchase_price_paise: number;
  unit_price_paise: number;
  discount_paise?: number;
}

export interface NewInvoiceInput {
  customer_name?: string;
  customer_phone?: string;
  doctor_name?: string;
  discount_paise?: number;
  tax_paise?: number;
  payment_method: PaymentMethod;
  amount_paid_paise?: number;
  notes?: string;
  items: NewInvoiceItemInput[];
}

export interface InvoiceFilter {
  search?: string;
  status?: "all" | "completed" | "cancelled";
  payment_method?: "all" | PaymentMethod;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// Reporting Types
export interface SalesReportSummary {
  total_sales_paise: number;
  total_invoices_count: number;
  total_items_sold: number;
  total_profit_paise: number;
  payment_breakdown: {
    cash_paise: number;
    upi_paise: number;
    card_paise: number;
    credit_paise: number;
  };
}

export interface SalesTransactionRow {
  id: string;
  invoice_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  items_count: number;
  payment_method: string;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  total_paise: number;
  profit_paise: number;
  status: string;
}

export interface StockValuationRow {
  id: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  unit: string;
  purchase_price_paise: number;
  selling_price_paise: number;
  total_cost_paise: number;
  total_retail_paise: number;
}

export interface ReorderItemRow {
  id: string;
  name: string;
  generic_name: string | null;
  quantity: number;
  minimum_stock_level: number;
  deficit: number;
  unit: string;
  supplier_name: string | null;
  purchase_price_paise: number;
  estimated_cost_paise: number;
}

export interface ExpiryAlertRow {
  id: string;
  name: string;
  batch_number: string | null;
  expiry_date: string;
  days_remaining: number;
  quantity: number;
  unit: string;
  purchase_price_paise: number;
  value_at_risk_paise: number;
  status: "expired" | "expiring_soon";
}

export interface MovementAuditRow {
  id: string;
  created_at: string;
  medicine_name: string;
  type: string;
  quantity_before: number;
  quantity_after: number;
  change: number;
  reason: string | null;
}

