# Multi-Vertical IMS Admin Portal (Offline Key Authority)

A centralized administrative web application built with **Next.js 14 App Router** and **Tailwind CSS**, designed for seamless deployment on **Vercel**.

## Features

- **Store & Customer Management**: Provision stores across four business verticals:
  - 🌱 **Agro Kendra IMS** (Pesticides, Fertilizers, Seeds)
  - 💊 **Pharma IMS** (Prescriptions, Schedule Drugs, Medical)
  - 🛒 **Kirana & FMCG IMS** (Groceries & Daily Provisions)
  - 🏢 **General Retail IMS** (General merchandise & POS)
- **Flexible Offline Key Generation**:
  - Presets (1 Month, 3 Months, 6 Months, 1 Year, 2 Years)
  - Custom Months
  - Custom Days
  - Exact Date Picker
- **Cryptographic Offline Security**:
  - Generates HMAC-SHA256 digital signatures that verify on desktop devices **without internet connection**.
  - Payload contains customer name, store name, vertical, validity dates, and plan details.
- **1-Click Distribution**:
  - 1-Click Copy License Key
  - 1-Click Send to Customer via WhatsApp with pre-filled instructions
- **Ledger & Metrics**:
  - Active, Expiring Soon (<14 days), and Expired licenses.
  - Revenue tracking and vertical distribution metrics.
  - 1-Click License Renewal directly from the customer table.

## Deploy to Vercel

1. Push this repository to GitHub or GitLab.
2. In the Vercel Dashboard, import the repository and set the Root Directory to:
   ```
   pharma-inventory/cloud/admin
   ```
3. Framework Preset: **Next.js**
4. Deploy!

## Local Development

```bash
cd pharma-inventory/cloud/admin
npm install
npm run dev
```

Visit [http://localhost:3001](http://localhost:3001) in your browser.
