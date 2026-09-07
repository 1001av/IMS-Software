# Pharma Inventory — Operations & User Guide

## 1. Running the Application in Development

To run the desktop application on Windows:

```bash
# In pharma-inventory/desktop:
npm install
npm run tauri dev
```

To test the frontend independently in a browser:
```bash
npm run dev
```

---

## 2. Packaging the Windows Desktop Installer

The desktop application is built with Tauri 2.0 and NSIS Windows installer support:

```bash
# In pharma-inventory/desktop:
npm run tauri build
```

This compiles the Rust binary and packages a Windows installer (`.exe` / `.msi`) located in:
`pharma-inventory/desktop/src-tauri/target/release/bundle/nsis/`

---

## 3. Business Subscription Management

Our business side generates offline subscription keys using the standalone utility script:

```bash
node cloud/tools/generateSubscriptionKey.js --customer "Customer / Pharmacy Name" --plan "Standard Plan" --price 999 --days 365
```

### Options:
- `--customer`: The pharmacy or owner name.
- `--plan`: The name of the subscription plan (e.g. `Basic`, `Standard`, `Premium Annual`).
- `--price`: Price in rupees (e.g. `499`, `999`, `1999`).
- `--days`: Duration in days (e.g. `30` for monthly, `365` for yearly).

### Sample Output:
```
==================================================
   PHARMA INVENTORY — OFFLINE SUBSCRIPTION KEY   
==================================================
Customer : Sunrise Medical Store
Plan     : Standard Plan
Price    : ₹999.00
Validity : 2026-09-03 to 2027-09-03 (365 days)
--------------------------------------------------
SUBSCRIPTION KEY (Give this key to the customer):
PHARMA-eyJjdXN0b21lck5hbWUiOiJTdW5yaXNlIE1lZGljYWwgU3RvcmUiLCJwbGFuTmFtZSI6IlN0YW5kYXJkIFBsYW4iLCJwcmljZVBhaXNlIjo5OTkwMCwic3RhcnREYXRlIjoiMjAyNi0wOS0wMyIsImV4cGlyeURhdGUiOiIyMDI3LTA5LTAzIiwiaXNzdWVkQXQiOjE3ODg0NTc0Njc4MDJ9-6848c7e9c5f2db867b9dc074c5d5ad6b
==================================================
```

Send the `SUBSCRIPTION KEY` to the customer. They paste it into their desktop app under **Subscription → Activate or Renew with Offline Key**. The app updates immediately with zero internet required.

---

## 4. Features for Pharmacy Owners

### A. First Run Setup
- Shown on first launch to record Pharmacy Name, Owner Name, Phone, and Email.
- Stored permanently in the local SQLite database.

### B. Dashboard
- Real-time totals: Total Medicines, Total Units in stock, Total Inventory Valuation (sum of quantity × purchase price), Low Stock count, Expiring Soon count.
- Clickable stat cards to quickly jump to filtered lists.

### C. Medicine Management
- Add medicines with quantity, unit (strips, tablets, boxes, bottles, vials, etc.), purchase price in rupees, batch, and expiry date.
- Instant search across medicine name, generic name, brand, batch, and manufacturer.
- Status filters: `All`, `Low Stock`, `Expiring Soon`, `Expired`.
- Stock adjustment modal with movement auditing.
- Safe soft deletion.

### D. Local Data Safety & Backup
- Export database backup (`.db`) directly to any folder, external drive, or USB drive.
- Restore from backup file with automated pre-restore safety copy (`pharma.db.pre_restore.bak`).
- History log of all backups created on the computer.

### E. Settings
- Update pharmacy name, owner name, contact information, and address.
- Configurable "Expiring Soon" threshold (30, 60, 90, 180, or 365 days).
- View system storage health and database file diagnostics.

### F. Billing & Invoicing (Point of Sale)
- Access the **Billing** tab or click **+ New Bill (POS)** from the Dashboard.
- Search medicines by name, generic name, or batch number. Live stock levels, batch, and expiry dates are shown instantly.
- Enter quantity and selling price, then click **+ Add to Bill**. Quantity cannot exceed available physical stock.
- Select payment mode (**Cash**, **UPI**, **Card**, **Credit**). When Cash is selected, enter cash tendered to view automatic change return calculations.
- Click **Complete & Print Bill** to finalize the sale, automatically deduct inventory, log an audit movement, and open a print-ready receipt slip.
- Under **Invoices History**, search past sales, view/reprint receipts, or cancel an invoice to return items to stock.

### G. Reports & Analytics Export
- Access the **Reports** tab to inspect 5 specialized business reports:
  1. **Sales & Revenue**: Filter by Today, Last 7 Days, Last 30 Days, or All Time to view revenue, gross profit, and cash vs UPI breakdown.
  2. **Stock Valuation**: Full SKU breakdown comparing purchase cost vs retail value.
  3. **Low Stock & Reorder**: Reorder requisition sheet showing unit deficits and estimated restocking budgets.
  4. **Expiry Alerts**: Items expired or expiring within 30, 60, 90, or 180 days with total financial value at risk.
  5. **Movement Audit Trail**: Complete log of adjustments, additions, sales, and returns.
- Click **📥 Export CSV** on any report to download an RFC-4180 Excel-compatible spreadsheet with UTF-8 BOM encoding.
- Click **Print / PDF** to generate an executive paper report or save directly to PDF.

