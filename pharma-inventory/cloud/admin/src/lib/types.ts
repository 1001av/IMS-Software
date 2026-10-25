export type BusinessType = "agro" | "pharma" | "kirana" | "general";

export type SubscriptionStatus = "active" | "expiring_soon" | "expired" | "pending_activation";

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  devicePrefix: string; // e.g. "A", "B"
  registeredAt: string;
  lastSeenAt: string;
}

export interface CustomerRecord {
  id: string;
  customerName: string;
  storeName: string;
  phone: string;
  email: string;
  passwordHash?: string;
  city: string;
  businessType: BusinessType;
  planName: string;
  pricePaise: number;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  subscriptionKey: string;
  status: SubscriptionStatus;
  maxDevices: number; // Default 2 authorized computers
  registeredDevices: RegisteredDevice[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultSnapshotMetadata {
  customerId: string;
  version: number;
  uploadedByDeviceId: string;
  uploadedByDeviceName: string;
  devicePrefix: string;
  sizeBytes: number;
  checksumSha256?: string;
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

export interface ProductRelease {
  version: string;
  notes: string;
  pub_date: string;
  url: string;
  signature?: string;
  isDeployed: boolean;
}
