import fs from "fs";
import path from "path";
import { CustomerRecord, ProductRelease, RegisteredDevice, SubscriptionStatus, VaultSnapshotMetadata } from "./types";
import { generateSubscriptionKey, hashPassword } from "./crypto";

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join("/tmp", "pharma-admin-data") : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "customers.json");
const SEED_DATA_FILE = path.join(process.cwd(), "data", "customers.json");
const VAULT_DIR = path.join(DATA_DIR, "vault");

// Optional persistent cloud database via Upstash Redis or Vercel KV REST API
const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
let isKvSynced = false;

function computeStatus(expiryDate?: string, explicitStatus?: SubscriptionStatus): SubscriptionStatus {
  if (explicitStatus === "pending_activation" || !expiryDate || expiryDate.trim() === "") {
    return "pending_activation";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < today) {
    return "expired";
  }

  const soon = new Date(today);
  soon.setDate(soon.getDate() + 14);
  if (expiry <= soon) {
    return "expiring_soon";
  }

  return "active";
}

function getFutureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getPastDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function createSeedData(): CustomerRecord[] {
  const todayStr = new Date().toISOString().slice(0, 10);

  const seeds: Omit<CustomerRecord, "subscriptionKey" | "status" | "createdAt" | "updatedAt">[] = [
    {
      id: "cust-agro-001",
      customerName: "Ramesh Patel",
      storeName: "Kisan Krishi Seva Kendra",
      phone: "+91 98260 12345",
      email: "kisan.kendra@example.com",
      city: "Sehore, Madhya Pradesh",
      businessType: "agro",
      planName: "Kisan Pro Annual (1 Year)",
      pricePaise: 499900,
      startDate: getPastDate(30),
      expiryDate: getFutureDate(335),
    },
    {
      id: "cust-pharma-002",
      customerName: "Dr. Arvind Sharma",
      storeName: "Shree Ganesh Medical Store",
      phone: "+91 94250 67890",
      email: "shree.ganesh.med@example.com",
      city: "Indore, Madhya Pradesh",
      businessType: "pharma",
      planName: "Pharmacy Enterprise (6 Months)",
      pricePaise: 299900,
      startDate: getPastDate(45),
      expiryDate: getFutureDate(135),
    },
    {
      id: "cust-kirana-003",
      customerName: "Suresh Gupta",
      storeName: "Mahavir Kirana & FMCG Store",
      phone: "+91 98930 54321",
      email: "mahavir.kirana@example.com",
      city: "Bhopal, Madhya Pradesh",
      businessType: "kirana",
      planName: "Retail Standard (3 Months)",
      pricePaise: 149900,
      startDate: getPastDate(80),
      expiryDate: getFutureDate(10), // Expiring in 10 days!
    },
    {
      id: "cust-agro-004",
      customerName: "Devendra Singh",
      storeName: "Patel Fertilizer & Pesticides",
      phone: "+91 97520 99887",
      email: "patel.agro@example.com",
      city: "Hoshangabad, Madhya Pradesh",
      businessType: "agro",
      planName: "Agro Seasonal Plan (6 Months)",
      pricePaise: 249900,
      startDate: getPastDate(15),
      expiryDate: getFutureDate(165),
    },
    {
      id: "cust-pharma-005",
      customerName: "Mukesh Chouhan",
      storeName: "Sanjeevani Chemist & Druggist",
      phone: "+91 98270 11223",
      email: "sanjeevani.chem@example.com",
      city: "Ujjain, Madhya Pradesh",
      businessType: "pharma",
      planName: "Starter Trial (30 Days)",
      pricePaise: 0,
      startDate: getPastDate(40),
      expiryDate: getPastDate(10), // Expired 10 days ago!
    },
  ];

  return seeds.map((s) => {
    const key = generateSubscriptionKey({
      customerName: s.customerName,
      storeName: s.storeName,
      planName: s.planName,
      pricePaise: s.pricePaise,
      startDate: s.startDate,
      expiryDate: s.expiryDate,
      businessType: s.businessType,
    });
    return {
      ...s,
      passwordHash: hashPassword("admin123"),
      maxDevices: 2,
      registeredDevices: [],
      subscriptionKey: key,
      status: computeStatus(s.expiryDate),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

// Global in-memory cache to persist during serverless execution life
let memoryStore: CustomerRecord[] | null = null;

function loadCustomers(): CustomerRecord[] {
  if (memoryStore) {
    // Refresh computed status on each fetch
    return memoryStore.map((c) => ({
      ...c,
      maxDevices: c.maxDevices || 2,
      registeredDevices: c.registeredDevices || [],
      passwordHash: c.passwordHash || hashPassword("admin123"),
      status: computeStatus(c.expiryDate, c.status),
    }));
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      memoryStore = JSON.parse(content);
      return memoryStore!.map((c) => ({
        ...c,
        maxDevices: c.maxDevices || 2,
        registeredDevices: c.registeredDevices || [],
        passwordHash: c.passwordHash || hashPassword("admin123"),
        status: computeStatus(c.expiryDate, c.status),
      }));
    } else if (fs.existsSync(SEED_DATA_FILE)) {
      // Seed from repository data file on cold start (e.g. on Vercel)
      const content = fs.readFileSync(SEED_DATA_FILE, "utf-8");
      memoryStore = JSON.parse(content);
      persistToFile(memoryStore!);
      return memoryStore!.map((c) => ({
        ...c,
        maxDevices: c.maxDevices || 2,
        registeredDevices: c.registeredDevices || [],
        passwordHash: c.passwordHash || hashPassword("admin123"),
        status: computeStatus(c.expiryDate, c.status),
      }));
    }
  } catch (err) {
    console.warn("Could not read customers file, using defaults:", err);
  }

  memoryStore = createSeedData();
  persistToFile(memoryStore);
  return memoryStore;
}

function persistToFile(data: CustomerRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    // Read-only environment like Vercel serverless
    console.warn("Storage writing skipped (environment read-only):", err);
  }
}

async function syncToKV(data: CustomerRecord[]): Promise<void> {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/set/ims_customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(JSON.stringify(data)),
    });
  } catch (err) {
    console.warn("Background KV sync failed:", err);
  }
}

async function syncFromKV(): Promise<boolean> {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const res = await fetch(`${KV_URL}/get/ims_customers`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (!json.result) return false;
    const parsed = typeof json.result === "string" ? JSON.parse(json.result) : json.result;
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryStore = parsed;
      persistToFile(parsed);
      isKvSynced = true;
      return true;
    }
  } catch (err) {
    console.warn("KV syncFromKV failed:", err);
  }
  return false;
}

export function getAllCustomers(): CustomerRecord[] {
  if (KV_URL && KV_TOKEN && !isKvSynced) {
    syncFromKV().catch(() => {});
  }
  return loadCustomers().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getAllCustomersAsync(): Promise<CustomerRecord[]> {
  if (KV_URL && KV_TOKEN && !isKvSynced) {
    await syncFromKV();
  }
  return getAllCustomers();
}

export function getCustomerById(id: string): CustomerRecord | undefined {
  const all = getAllCustomers();
  return all.find((c) => c.id === id);
}

export function findCustomerByEmail(email: string): CustomerRecord | undefined {
  const all = getAllCustomers();
  const clean = email.trim().toLowerCase();
  return all.find((c) => c.email && c.email.trim().toLowerCase() === clean);
}

export function saveCustomer(record: CustomerRecord): CustomerRecord {
  const all = loadCustomers();
  const index = all.findIndex((c) => c.id === record.id);

  const updatedRecord: CustomerRecord = {
    ...record,
    maxDevices: record.maxDevices || 2,
    registeredDevices: record.registeredDevices || [],
    passwordHash: record.passwordHash || hashPassword("admin123"),
    status: computeStatus(record.expiryDate, record.status),
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    all[index] = updatedRecord;
  } else {
    all.unshift(updatedRecord);
  }

  memoryStore = all;
  persistToFile(all);
  syncToKV(all).catch(() => {});
  return updatedRecord;
}

export function deleteCustomer(id: string): boolean {
  const all = loadCustomers();
  const filtered = all.filter((c) => c.id !== id);
  if (filtered.length === all.length) return false;

  memoryStore = filtered;
  persistToFile(filtered);
  syncToKV(filtered).catch(() => {});
  return true;
}

/**
 * Registers a new computer or updates an existing device registration.
 * Enforces the strict max 2 authorized computers limit.
 */
export function registerCustomerDevice(
  customerId: string,
  deviceId: string,
  deviceName: string
): { device: RegisteredDevice; customer: CustomerRecord } {
  const customer = getCustomerById(customerId);
  if (!customer) {
    throw new Error("Customer account not found.");
  }

  const existingDeviceIndex = customer.registeredDevices.findIndex(
    (d) => d.deviceId === deviceId
  );

  const now = new Date().toISOString();

  if (existingDeviceIndex >= 0) {
    // Device already registered on this customer account: update last seen & name
    customer.registeredDevices[existingDeviceIndex].lastSeenAt = now;
    customer.registeredDevices[existingDeviceIndex].deviceName = deviceName;
    const updated = saveCustomer(customer);
    return {
      device: customer.registeredDevices[existingDeviceIndex],
      customer: updated,
    };
  }

  // Check 2-device quota limit
  const max = customer.maxDevices || 2;
  if (customer.registeredDevices.length >= max) {
    const names = customer.registeredDevices.map((d) => `"${d.deviceName}"`).join(" and ");
    throw new Error(
      `Device limit reached (${customer.registeredDevices.length}/${max} active devices: ${names}). Please deactivate an existing device from settings before signing in on this computer.`
    );
  }

  // Assign device prefix: First device is 'A', second is 'B'
  const usedPrefixes = new Set(customer.registeredDevices.map((d) => d.devicePrefix));
  const assignedPrefix = !usedPrefixes.has("A") ? "A" : "B";

  const newDevice: RegisteredDevice = {
    deviceId,
    deviceName: deviceName.trim() || `Computer ${assignedPrefix}`,
    devicePrefix: assignedPrefix,
    registeredAt: now,
    lastSeenAt: now,
  };

  customer.registeredDevices.push(newDevice);
  const updated = saveCustomer(customer);
  return { device: newDevice, customer: updated };
}

/** Revokes a registered computer from an account (or resets all if deviceId === 'all') */
export function revokeCustomerDevice(customerId: string, deviceId: string): CustomerRecord {
  const customer = getCustomerById(customerId);
  if (!customer) {
    throw new Error("Customer account not found.");
  }

  if (deviceId === "all") {
    customer.registeredDevices = [];
  } else {
    customer.registeredDevices = customer.registeredDevices.filter(
      (d) => d.deviceId !== deviceId
    );
  }
  return saveCustomer(customer);
}

/** Saves an encrypted Cloud Vault snapshot locally */
export function saveVaultSnapshot(
  customerId: string,
  dataBase64: string,
  metaInput: {
    version: number;
    uploadedByDeviceId: string;
    uploadedByDeviceName: string;
    devicePrefix: string;
    sizeBytes: number;
    checksumSha256?: string;
  }
): VaultSnapshotMetadata {
  try {
    const custVaultDir = path.join(VAULT_DIR, customerId);
    if (!fs.existsSync(custVaultDir)) {
      fs.mkdirSync(custVaultDir, { recursive: true });
    }

    const metadata: VaultSnapshotMetadata = {
      customerId,
      version: metaInput.version,
      uploadedByDeviceId: metaInput.uploadedByDeviceId,
      uploadedByDeviceName: metaInput.uploadedByDeviceName,
      devicePrefix: metaInput.devicePrefix,
      sizeBytes: metaInput.sizeBytes,
      checksumSha256: metaInput.checksumSha256,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(custVaultDir, "latest.enc"), dataBase64, "utf-8");
    fs.writeFileSync(
      path.join(custVaultDir, "latest.meta.json"),
      JSON.stringify(metadata, null, 2),
      "utf-8"
    );

    return metadata;
  } catch (err: any) {
    console.error("Failed to persist vault snapshot to disk:", err);
    throw new Error(`Cloud vault storage failure: ${err?.message}`);
  }
}

/** Retrieves the latest encrypted Cloud Vault snapshot */
export function getLatestVaultSnapshot(
  customerId: string
): { dataBase64: string; metadata: VaultSnapshotMetadata } | null {
  try {
    const custVaultDir = path.join(VAULT_DIR, customerId);
    const dataFile = path.join(custVaultDir, "latest.enc");
    const metaFile = path.join(custVaultDir, "latest.meta.json");

    if (!fs.existsSync(dataFile) || !fs.existsSync(metaFile)) {
      return null;
    }

    const dataBase64 = fs.readFileSync(dataFile, "utf-8");
    const metadata: VaultSnapshotMetadata = JSON.parse(
      fs.readFileSync(metaFile, "utf-8")
    );

    return { dataBase64, metadata };
  } catch (err) {
    console.warn("Could not read vault snapshot:", err);
    return null;
  }
}

const RELEASES_FILE = path.join(DATA_DIR, "releases.json");
const SEED_RELEASES_FILE = path.join(process.cwd(), "data", "releases.json");

const DEFAULT_RELEASES: Record<string, ProductRelease> = {
  agro: {
    version: "1.0.0",
    notes: "Agro Kendra IMS v1.0.0 - Production release.",
    pub_date: new Date().toISOString(),
    url: "https://github.com/1001av/IMS-Software/releases/download/v1.0.0/Agro-Kendra-IMS_1.0.0_x64-setup.nsis.zip",
    signature: "",
    isDeployed: false,
  },
  kirana: {
    version: "1.0.0",
    notes: "Kirana Store IMS v1.0.0 - Production release.",
    pub_date: new Date().toISOString(),
    url: "https://github.com/1001av/IMS-Software/releases/download/v1.0.0/Kirana-Store-IMS_1.0.0_x64-setup.nsis.zip",
    signature: "",
    isDeployed: false,
  },
  pharma: {
    version: "1.0.0",
    notes: "Pharma IMS v1.0.0 - Production release.",
    pub_date: new Date().toISOString(),
    url: "https://github.com/1001av/IMS-Software/releases/download/v1.0.0/Pharma-IMS_1.0.0_x64-setup.nsis.zip",
    signature: "",
    isDeployed: false,
  },
};

/** Retrieves all product release configurations */
export function getProductReleases(): Record<string, ProductRelease> {
  try {
    if (!fs.existsSync(RELEASES_FILE)) {
      if (fs.existsSync(SEED_RELEASES_FILE)) {
        const rawSeed = fs.readFileSync(SEED_RELEASES_FILE, "utf-8");
        const parsed = JSON.parse(rawSeed);
        try {
          fs.mkdirSync(DATA_DIR, { recursive: true });
          fs.writeFileSync(RELEASES_FILE, JSON.stringify(parsed, null, 2), "utf-8");
        } catch (_) {}
        return { ...DEFAULT_RELEASES, ...parsed };
      }
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(RELEASES_FILE, JSON.stringify(DEFAULT_RELEASES, null, 2), "utf-8");
      } catch (_) {}
      return DEFAULT_RELEASES;
    }
    const raw = fs.readFileSync(RELEASES_FILE, "utf-8");
    return { ...DEFAULT_RELEASES, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("Failed to read releases from disk, using defaults:", err);
    return DEFAULT_RELEASES;
  }
}

/** Deploys or updates a software release for a product */
export function deployProductRelease(
  product: string,
  release: Partial<ProductRelease>
): ProductRelease {
  const all = getProductReleases();
  const current = all[product] || DEFAULT_RELEASES[product] || DEFAULT_RELEASES.agro;
  const updated: ProductRelease = {
    version: release.version?.trim() || current.version,
    notes: release.notes?.trim() || current.notes,
    pub_date: new Date().toISOString(),
    url: release.url?.trim() || current.url,
    signature: release.signature || current.signature || "",
    isDeployed: release.isDeployed !== undefined ? release.isDeployed : true,
  };
  all[product] = updated;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RELEASES_FILE, JSON.stringify(all, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not write releases file (read-only):", e);
  }
  return updated;
}
