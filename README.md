# LSPay

A multi-tenant school wallet + POS kiosk app:

- **Parents** top up their children's wallets (via Paystack) and track spending.
- **Schools (tenants)** issue NFC/QR cards, manage inventory, and run a checkout kiosk.
- **Super admin** manages tenants, staff, and card issuance across the platform.

This is a **frontend-only** React + Vite app. Out of the box it runs on an
in-memory store (`src/store.tsx`) that resets on every full page reload — perfect
for demos. To make data persistent, follow the included Supabase setup guide.

---

## Quick start

Requirements: **Node.js 20+** and npm.

```bash
# 1. Install dependencies
npm install

# 2. Create your env file and add your keys
cp .env.example .env
#    then edit .env (Paystack key + Supabase URL/anon key)

# 3. Run the dev server
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

Other scripts:

- `npm run build` — production build into `dist/`
- `npm run serve` — preview the production build
- `npm run typecheck` — TypeScript check (no emit)

---

## Demo credentials

The in-memory store and `supabase/seed.sql` both ship with these accounts:

| Role         | Email                 | Password   |
| ------------ | --------------------- | ---------- |
| Super Admin  | `admin@lspay.com`     | `admin123` |
| School Admin | `sarah@greenwood.edu` | `green123` |
| Parent       | `helen@family.com`    | `parent123`|

> These passwords are plaintext for prototyping only. Use real password hashing
> before deploying anything real.

---

## Environment variables

All client env vars are prefixed with `VITE_` (see `.env.example`):

| Variable                   | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack publishable key for parent wallet top-ups |
| `VITE_SUPABASE_URL`        | Supabase Project URL                               |
| `VITE_SUPABASE_ANON_KEY`   | Supabase public anon key                           |

Without a Paystack key, the top-up flow shows a "not configured" message instead
of launching checkout.

---

## Setting up Supabase (PostgreSQL)

Full step-by-step instructions are in **`LSPay-Supabase-Setup-Guide.docx`**
(included in the download alongside this folder). In short:

1. Create a Supabase project at https://supabase.com.
2. In the SQL Editor, run `supabase/schema.sql`, then optionally `supabase/seed.sql`.
3. Copy your Project URL + anon key into `.env`.
4. Use the provided `src/lib/supabaseClient.ts` to replace the in-memory
   functions in `src/store.tsx` with Supabase queries (the guide walks through
   one full example).

---

## Tech stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS v4 + shadcn/ui (Radix primitives)
- wouter (routing), TanStack Query
- Paystack (`@paystack/inline-js`) for payments
- `@zxing/browser` for QR scanning, Web NFC for NFC scanning
- Supabase (`@supabase/supabase-js`) — optional persistent backend

## Project structure

```
src/
  components/      UI: layout, tenant screens, QrScanner, shadcn/ui primitives
  hooks/           use-mobile, use-toast
  lib/             types, utils, paystack, NFC/QR scanner hooks, supabaseClient
  pages/           SuperAdmin, TenantConsole, ParentPortal, auth/*
  store.tsx        in-memory app state + actions (swap for Supabase)
  theme.tsx        light/dark theme provider
supabase/
  schema.sql       full PostgreSQL schema
  seed.sql         optional demo data
```
