import { useEffect, useState } from "react";

export type BusinessType = "agro" | "pharma" | "kirana" | "general";

export interface BusinessConfig {
  id: BusinessType;
  appName: string;
  badgeText: string;
  tagline: string;
  storeNamePlaceholder: string;
  itemLabel: string;
  itemLabelPlural: string;
  genericLabel: string;
  genericPlaceholder: string;
  customerLabel: string;
  customerPlaceholder: string;
  referenceLabel: string;
  referencePlaceholder: string;
  receiptTitle: string;
  receiptFooter: string;
  licenseFields: { key: string; label: string; placeholder: string }[];
  categories: string[];
  units: string[];
  primaryColorHex: string;
  accentColorHex: string;
}

export const BUSINESS_CONFIGS: Record<BusinessType, BusinessConfig> = {
  agro: {
    id: "agro",
    appName: "Agro Kendra IMS",
    badgeText: "Agro & Krishi Kendra Edition",
    tagline: "Agrochemicals, Seeds & Fertilizer Management",
    storeNamePlaceholder: "e.g. Kisan Krishi Seva Kendra",
    itemLabel: "Agro Product",
    itemLabelPlural: "Agro Products",
    genericLabel: "Technical Name / Active Ingredient",
    genericPlaceholder: "e.g. Chlorantraniliprole 18.5% SC, NPK 19:19:19",
    customerLabel: "Farmer / Buyer Name",
    customerPlaceholder: "e.g. Ramesh Patel / Farmer",
    referenceLabel: "Village / Tehsil",
    referencePlaceholder: "e.g. Rampur Village",
    receiptTitle: "KISAN CASH MEMO / AGRO TAX INVOICE",
    receiptFooter: "Authorized Dealer of Certified Seeds, Fertilizers & Pesticides. Thank you, Jai Kisan!",
    licenseFields: [
      { key: "license_pesticide", label: "Pesticide License No.", placeholder: "e.g. PEST-LIC-2026-88" },
      { key: "license_fertilizer", label: "Fertilizer License No.", placeholder: "e.g. FERT-LIC-2026-42" },
      { key: "license_seed", label: "Seed License No.", placeholder: "e.g. SEED-LIC-2026-19" },
      { key: "gstin", label: "GSTIN (Tax ID)", placeholder: "e.g. 23AAAAA0000A1Z5" },
    ],
    categories: [
      "Insecticides",
      "Fungicides",
      "Herbicides / Weedicides",
      "Fertilizers & Bio-fertilizers",
      "Seeds & Hybrids",
      "Plant Growth Regulators (PGR)",
      "Micro-nutrients & Tonics",
      "Sprayers & Farm Equipment",
      "Other Agricultural Inputs",
    ],
    units: [
      "Litre",
      "ml",
      "Kg",
      "gm",
      "Bag (50kg)",
      "Bag (25kg)",
      "Packet",
      "Bottle",
      "Canister",
      "Box",
      "pcs",
    ],
    primaryColorHex: "#059669", // Emerald 600
    accentColorHex: "#10B981",  // Emerald 500
  },

  pharma: {
    id: "pharma",
    appName: "Pharma Inventory",
    badgeText: "Pharmacy & Medical Edition",
    tagline: "Pharmaceutical Inventory & Prescription Billing",
    storeNamePlaceholder: "e.g. Shree Ganesh Medical Store",
    itemLabel: "Medicine",
    itemLabelPlural: "Medicines",
    genericLabel: "Generic Formula / Salt",
    genericPlaceholder: "e.g. Paracetamol, Amoxicillin",
    customerLabel: "Patient / Customer Name",
    customerPlaceholder: "e.g. Suresh Kumar",
    referenceLabel: "Doctor / Prescriber",
    referencePlaceholder: "e.g. Dr. A. Sharma",
    receiptTitle: "RETAIL CASH MEMO / TAX INVOICE",
    receiptFooter: "Get Well Soon! Medicines sold cannot be returned without original cash memo.",
    licenseFields: [
      { key: "license_drug", label: "Drug License No. (20B / 21B)", placeholder: "e.g. DL-20B-9842" },
      { key: "license_pharmacist", label: "Pharmacist Reg. No.", placeholder: "e.g. PH-REG-4521" },
      { key: "gstin", label: "GSTIN (Tax ID)", placeholder: "e.g. 23AAAAA0000A1Z5" },
    ],
    categories: [
      "Antibiotics",
      "Analgesics / Pain Relief",
      "Syrups & Suspensions",
      "Vitamins & Supplements",
      "Injections & Vials",
      "Surgical & First Aid",
      "Ointments & Creams",
      "Cardiac & Diabetic",
      "Other Healthcare",
    ],
    units: [
      "Strip",
      "Box",
      "Bottle",
      "Vial",
      "Tablet",
      "Capsule",
      "Tube",
      "pcs",
    ],
    primaryColorHex: "#0D9488", // Teal 600
    accentColorHex: "#14B8A6",  // Teal 500
  },

  kirana: {
    id: "kirana",
    appName: "Kirana Store IMS",
    badgeText: "Kirana & Retail Edition",
    tagline: "Grocery, FMCG & Daily Provisions Inventory",
    storeNamePlaceholder: "e.g. Mahavir Kirana & General Store",
    itemLabel: "Grocery Item",
    itemLabelPlural: "Grocery Items",
    genericLabel: "Brand / Variety / Grade",
    genericPlaceholder: "e.g. Premium Basmati, Whole Wheat Chakki",
    customerLabel: "Customer Name",
    customerPlaceholder: "e.g. Anita Sharma",
    referenceLabel: "Area / Address",
    referencePlaceholder: "e.g. Sector 4, Main Market",
    receiptTitle: "RETAIL INVOICE / CASH BILL",
    receiptFooter: "Thank you for shopping with us! Please visit again.",
    licenseFields: [
      { key: "license_fssai", label: "FSSAI License No.", placeholder: "e.g. 10020011000123" },
      { key: "gstin", label: "GSTIN (Tax ID)", placeholder: "e.g. 23AAAAA0000A1Z5" },
    ],
    categories: [
      "Grains, Rice & Pulses (Dal)",
      "Edible Oils & Ghee",
      "Spices, Salt & Masalas",
      "Flour, Sooji & Besan",
      "Packaged Snacks & Biscuits",
      "Beverages, Tea & Coffee",
      "Dairy & Bakery",
      "Personal Care & Soaps",
      "Cleaning & Detergents",
      "Other Household Goods",
    ],
    units: [
      "Kg",
      "gm",
      "Litre",
      "ml",
      "Packet",
      "Pouch",
      "Bag",
      "Bottle",
      "Box",
      "pcs",
    ],
    primaryColorHex: "#2563EB", // Blue 600
    accentColorHex: "#3B82F6",  // Blue 500
  },

  general: {
    id: "general",
    appName: "Retail IMS",
    badgeText: "General Retail Edition",
    tagline: "Universal Inventory & Point-of-Sale System",
    storeNamePlaceholder: "e.g. City Retail Mart",
    itemLabel: "Product",
    itemLabelPlural: "Products",
    genericLabel: "Description / Model",
    genericPlaceholder: "e.g. Model / Specifications",
    customerLabel: "Customer Name",
    customerPlaceholder: "e.g. Customer Name",
    referenceLabel: "Reference / Note",
    referencePlaceholder: "e.g. Referral / Notes",
    receiptTitle: "RETAIL CASH MEMO / INVOICE",
    receiptFooter: "Thank you for your business! Please visit again.",
    licenseFields: [
      { key: "trade_license", label: "Trade License No.", placeholder: "e.g. TR-2026-90" },
      { key: "gstin", label: "GSTIN (Tax ID)", placeholder: "e.g. 23AAAAA0000A1Z5" },
    ],
    categories: ["General Merchandise", "Electronics", "Hardware", "Stationery", "Other"],
    units: ["pcs", "Box", "Set", "Packet", "Kg"],
    primaryColorHex: "#4F46E5", // Indigo 600
    accentColorHex: "#6366F1",
  },
};

/** Retrieves active business vertical preset, default is 'agro'. */
export function getActiveBusinessType(): BusinessType {
  const saved = localStorage.getItem("business_type") as BusinessType;
  if (saved && BUSINESS_CONFIGS[saved]) {
    return saved;
  }
  return "agro"; // Default to Agro Kendra
}

/** Sets active business vertical and broadcasts change event. */
export function setActiveBusinessType(type: BusinessType): void {
  localStorage.setItem("business_type", type);
  window.dispatchEvent(new Event("business_type_changed"));
}

/** Helper to retrieve business configuration. */
export function getBusinessConfig(type?: BusinessType): BusinessConfig {
  const active = type || getActiveBusinessType();
  return BUSINESS_CONFIGS[active] || BUSINESS_CONFIGS.agro;
}

/** React hook that reacts in real-time when the business vertical is changed. */
export function useBusinessConfig(): BusinessConfig {
  const [config, setConfig] = useState<BusinessConfig>(() => getBusinessConfig());

  useEffect(() => {
    const handleUpdate = () => {
      setConfig(getBusinessConfig());
    };

    window.addEventListener("business_type_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("business_type_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return config;
}
