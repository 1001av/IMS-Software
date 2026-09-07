export type BusinessType = "agro" | "pharma" | "kirana" | "general";

export type SubscriptionStatus = "active" | "expiring_soon" | "expired";

export interface CustomerRecord {
  id: string;
  customerName: string;
  storeName: string;
  phone: string;
  email: string;
  city: string;
  businessType: BusinessType;
  planName: string;
  pricePaise: number;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  subscriptionKey: string;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export type DurationUnit = "preset" | "months" | "days" | "date";

export interface GenerateKeyRequest {
  customerName: string;
  storeName: string;
  phone?: string;
  email?: string;
  city?: string;
  businessType: BusinessType;
  planName: string;
  pricePaise: number;
  startDate?: string; // YYYY-MM-DD (defaults to today)
  durationMode: DurationUnit;
  presetMonths?: number;
  customMonths?: number;
  customDays?: number;
  exactExpiryDate?: string; // YYYY-MM-DD
}

export interface GenerateKeyResponse {
  key: string;
  customerName: string;
  storeName: string;
  businessType: BusinessType;
  planName: string;
  pricePaise: number;
  startDate: string;
  expiryDate: string;
  totalDays: number;
}
