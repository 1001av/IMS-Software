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
    appName: "Pharma IMS",
    badgeText: "Pharmacy & Healthcare Edition",
    tagline: "Pharmaceutical Inventory & Prescription Billing",
    storeNamePlaceholder: "e.g. Shree Ganesh Medical Store",
    itemLabel: "Medicine",
    itemLabelPlural: "Medicines",
    genericLabel: "Salt Composition / Generic Molecule",
    genericPlaceholder: "e.g. Paracetamol 650mg, Amoxicillin + Clavulanic Acid",
    customerLabel: "Patient / Customer Name",
    customerPlaceholder: "e.g. Suresh Kumar",
    referenceLabel: "Prescribing Doctor / Clinic",
    referencePlaceholder: "e.g. Dr. A. Sharma (MBBS, MD)",
    receiptTitle: "PHARMACY TAX INVOICE / CASH MEMO",
    receiptFooter: "Medicines sold cannot be returned without original cash memo. Wish you good health!",
    licenseFields: [
      { key: "license_drug", label: "Drug License No. (Form 20B / 21B)", placeholder: "e.g. DL-20B-9842" },
      { key: "license_pharmacist", label: "Pharmacist Registration No.", placeholder: "e.g. PH-REG-4521" },
      { key: "license_fssai", label: "FSSAI Food/Nutraceutical Lic No.", placeholder: "e.g. 10020011000123" },
      { key: "gstin", label: "GSTIN (Tax ID)", placeholder: "e.g. 23AAAAA0000A1Z5" },
    ],
    categories: [
      "Antibiotics",
      "Analgesics & Pain Relief",
      "Cardiac & Diabetic Care",
      "Syrups & Suspensions",
      "Vitamins & Supplements",
      "Injections & Vials",
      "Surgical & First Aid",
      "Ointments & Creams",
      "OTC Healthcare",
      "Other Medicines",
    ],
    units: [
      "Strip",
      "Box",
      "Bottle",
      "Vial",
      "Ampoule",
      "Tablet",
      "Capsule",
      "Tube",
      "Sachet",
      "pcs",
    ],
    primaryColorHex: "#0D9488", // Teal 600
    accentColorHex: "#14B8A6",  // Teal 500
  },

  kirana: {
    id: "kirana",
    appName: "Kirana Store IMS",
    badgeText: "Kirana & Retail Supermarket Edition",
    tagline: "Grocery, FMCG & Daily Provisions Inventory",
    storeNamePlaceholder: "e.g. Mahavir Kirana & General Store",
    itemLabel: "Grocery Item",
    itemLabelPlural: "Grocery Items",
    genericLabel: "Brand / Variety / Grade",
    genericPlaceholder: "e.g. Premium Basmati Rice, Whole Wheat Chakki Atta",
    customerLabel: "Customer / Account Holder Name",
    customerPlaceholder: "e.g. Rajesh Gupta",
    referenceLabel: "Area / Delivery Address / Khata Note",
    referencePlaceholder: "e.g. Main Market, Shop No. 4",
    receiptTitle: "RETAIL CASH MEMO / KIRANA TAX INVOICE",
    receiptFooter: "Thank you for shopping with us! Please visit again.",
    licenseFields: [
      { key: "license_fssai", label: "FSSAI License No.", placeholder: "e.g. 10020011000123" },
      { key: "license_trade", label: "Shop Act / Trade License No.", placeholder: "e.g. TR-2026-98" },
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
      "Can",
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

/**
 * Compile-time Target Product Edition.
 * Each business vertical is an independent product build (e.g. Agro Kendra IMS).
 * Defaults to 'agro' (Agro Kendra IMS).
 */
export const TARGET_PRODUCT_TYPE: BusinessType =
  ((import.meta as any).env?.VITE_PRODUCT_VERTICAL as BusinessType) || "agro";

/** Retrieves active product vertical. Anchored to target product build. */
export function getActiveBusinessType(): BusinessType {
  return TARGET_PRODUCT_TYPE;
}

/** Legacy helper kept for compatibility; product is strictly anchored to build */
export function setActiveBusinessType(_type: BusinessType): void {
  // Product vertical is anchored at build time to ensure 100% integrity
}

/** Helper to retrieve business configuration. */
export function getBusinessConfig(type?: BusinessType): BusinessConfig {
  const active = type || TARGET_PRODUCT_TYPE;
  return BUSINESS_CONFIGS[active] || BUSINESS_CONFIGS.agro;
}

/** React hook that provides the immutable business product configuration. */
export function useBusinessConfig(): BusinessConfig {
  return getBusinessConfig();
}
