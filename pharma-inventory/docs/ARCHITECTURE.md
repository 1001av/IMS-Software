# Pharma Inventory — Architecture & System Design

## 1. Core Stack

| Layer | Technology | Rationale |
|---|---|---|
| Desktop Shell | **Tauri 2.x** (Rust) | Minimal RAM footprint (~30-50MB), native Windows Webview2, fast native I/O for database operations. |
| Desktop Frontend | **React 18 + TypeScript + Tailwind CSS** | Clean, accessible UI designed for small-shop counter screens with visible keyboard focus and readable typography. |
| Local Database | **SQLite** (`tauri-plugin-sql`, sqlx) in **WAL mode** | Embedded zero-configuration database; Write-Ahead Logging (WAL) guarantees crash-safe atomic transactions. |
| Routing | **HashRouter** | File-system-based client routing inside the local Windows desktop webview. |
| Business Tooling | **Node.js standalone CLI** (`cloud/tools/`) | Generates cryptographically verifiable offline subscription keys for customers. |

---

## 2. Non-Negotiable Principle: 100% Offline-First

> **The local SQLite database (`pharma.db`) is the sole source of truth for all pharmacy operations.**
> - Day-to-day inventory actions (Adding medicines, updating batches, tracking stock, adjusting quantities, calculating inventory valuation) never make network calls.
> - The application works reliably with zero internet connection, disconnected Wi-Fi, or on a completely air-gapped Windows computer.
> - No mandatory online activation, license validation pings, or internet check on startup.

---

## 3. Subscription Business Model (Offline-Capable)

Although the software operates 100% offline, it is offered under a **subscription pricing model**:

```
Customer / Shop Name → Subscription Plan → Start Date → Expiry Date → Price
```

### Key Generation & Activation Flow:
1. **Business Side Generation**:
   Our business operations team defines the customer subscription using our CLI tool:
   ```bash
   node cloud/tools/generateSubscriptionKey.js --customer "Apex Meds" --plan "Standard Plan" --price 999 --days 365
   ```
   This generates a self-contained, tamper-proof offline key (`PHARMA-<PAYLOAD>-<SIGNATURE>`).
2. **Customer Activation (No Internet Required)**:
   The pharmacy owner receives this key (via SMS, WhatsApp, or invoice) and enters it in the **Subscription** tab of their desktop app.
3. **Local Validation**:
   The desktop app validates the cryptographic HMAC signature locally using Web Crypto and updates SQLite (`subscriptions` table).
4. **Subscription Expiry Policy (Non-Blocking Warning Banner)**:
   - When a subscription expires, the application **never locks or deletes inventory data**.
   - A clear **warning banner** appears across the top informing the owner that their subscription has expired, providing our contact info for renewal.
   - Core inventory search, stock adjustments, and valuation remain completely functional.

---

## 4. Money & Identifiers

- **Paise Storage**: All prices (`purchase_price_paise`, `selling_price_paise`, `price_paise`) are stored as **integer paise** (1 INR = 100 paise) in SQLite to eliminate floating-point arithmetic errors.
- **Display Formatting**: Converted to rupees at the UI boundary using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **UUIDv4**: All primary keys (`pharmacy.id`, `medicines.id`, `inventory_movements.id`) are client-generated UUIDv4 strings.

---

## 5. Local Data Safety & Backups

- **Local Backup**: The app includes a dedicated **Backup & Restore** screen allowing the user to export the local SQLite database to any directory, external drive, or USB pen drive at any time.
- **Safety Precaution on Restore**: When restoring from a backup file, the app automatically preserves a pre-restore backup (`pharma.db.pre_restore.bak`) before overwriting.
- **Audit Logging**: Every stock change is logged to `inventory_movements` (`initial`, `adjustment`, `sale`, `return`) with timestamps, prior quantity, and reason.
- **Soft Deletion**: Medicines are soft-deleted (`is_deleted = 1`) to prevent irreversible accidental deletion.

---

## 6. Billing, Invoicing & POS Counter

- **Real-Time Stock Synchronized Sales**:
  - Point-of-sale checkout records invoices in `invoices` and itemized lines in `invoice_items`.
  - Atomically decrements medicine stock and logs `inventory_movements` with `type = 'sale'`.
  - Prevents overselling with real-time inventory validation.
- **Sequential Invoicing**:
  - Uses `INV-YYYYMMDD-XXXX` format generated locally in SQLite.
- **Invoice Reversal / Returns**:
  - Cancelling an invoice restores inventory quantities and logs audit movements with `type = 'return'`.
- **Receipt Printing**:
  - Modal view optimized with `@media print` rules for thermal slips (80mm) and A4/A5 cash memos.

---

## 7. Reports & CSV Export

- **Supported Analytics**:
  - **Sales & Revenue**: Tracks sales volume, gross margin (revenue minus purchase cost), and payment breakdown (Cash, UPI, Card).
  - **Inventory Valuation**: Calculates total cost valuation vs potential retail value.
  - **Low Stock & Reordering**: Computes unit deficits and estimated restocking budgets.
  - **Expiry Alerts**: Tracks expired items and items expiring within 30, 60, 90, or 180 days with financial value at risk.
  - **Movement Audit**: Complete ledger of adjustments, additions, sales, and returns.
- **RFC-4180 CSV Export**:
  - Generates UTF-8 BOM (`\uFEFF`) CSV files that open cleanly in Microsoft Excel on Windows without character encoding errors.
- **Print / PDF**:
  - Native print stylesheet renders clean reports without web application chrome.

