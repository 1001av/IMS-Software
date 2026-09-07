import fs from "fs";
import path from "path";
import { CustomerRecord, SubscriptionStatus } from "./types";
import { generateSubscriptionKey } from "./crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "customers.json");

function computeStatus(expiryDate: string): SubscriptionStatus {
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
      status: computeStatus(c.expiryDate),
    }));
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      memoryStore = JSON.parse(content);
      return memoryStore!.map((c) => ({
        ...c,
        status: computeStatus(c.expiryDate),
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

export function getAllCustomers(): CustomerRecord[] {
  return loadCustomers().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getCustomerById(id: string): CustomerRecord | undefined {
  const all = loadCustomers();
  return all.find((c) => c.id === id);
}

export function saveCustomer(record: CustomerRecord): CustomerRecord {
  const all = loadCustomers();
  const index = all.findIndex((c) => c.id === record.id);

  const updatedRecord = {
    ...record,
    status: computeStatus(record.expiryDate),
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    all[index] = updatedRecord;
  } else {
    all.unshift(updatedRecord);
  }

  memoryStore = all;
  persistToFile(all);
  return updatedRecord;
}

export function deleteCustomer(id: string): boolean {
  const all = loadCustomers();
  const filtered = all.filter((c) => c.id !== id);
  if (filtered.length === all.length) return false;

  memoryStore = filtered;
  persistToFile(filtered);
  return true;
}
