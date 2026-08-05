# CargoFlo - Cargo Export/Import ERP System

A full-featured cargo management ERP similar to Searates Tech, built with React, Node.js, and MySQL.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS, Recharts, React Hook Form |
| Backend | Node.js, Express, Socket.IO |
| Database | MySQL 8+ with Sequelize ORM |
| Auth | JWT (access + refresh tokens) |

---

## Prerequisites

- Node.js 18+
- MySQL 8+
- npm or yarn

---

## Quick Start

### 1. Database Setup

The quickest path — brings up MySQL 8 on `localhost:3306` with an empty
`cargoflo_db`. Tables and seed data are created automatically the first time the
backend boots.

```bash
docker compose up -d
```

Already running MySQL? Create the database by hand instead and point the `DB_*`
values in `backend/.env` at it:

```sql
CREATE DATABASE cargoflo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup

```bash
cd backend

# Copy and configure environment
cp .env.example .env        # Windows: copy .env.example .env
# Edit .env if your MySQL credentials differ from the compose defaults

# Install dependencies
npm install

# Start server (auto-creates all tables and seeds sample data)
npm run dev
```

> `.env` is gitignored — it holds real credentials and must never be committed.
> Change `JWT_SECRET` and `JWT_REFRESH_SECRET` before deploying anywhere.

Backend runs at: http://localhost:5000

### 3. Seed Sample Data (optional but recommended)

```bash
cd backend
npm run seed
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend runs at: http://localhost:3000

---

## Login Credentials

### Admin Panel
- URL: http://localhost:3000/admin/dashboard
- Email: `admin@cargoflo.com`
- Password: `Admin@123`

### User App
- URL: http://localhost:3000/user/dashboard
- Email: `john@example.com`
- Password: `User@123`

---

## AI Features (optional)

The app runs fine without a key — the AI routes simply report "not configured".
To switch them on, set **one** of these in `backend/.env` and restart:

| Variable | Where to get it |
|---|---|
| `GOOGLE_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — keys start `AIza` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) — keys start `sk-ant-` |

Whichever key is present is used. Set `AI_PROVIDER=gemini` or `claude` to force
one when both exist; `GEMINI_MODEL` / `ANTHROPIC_MODEL` override the default model.

What it powers:

- **Assistant** — floating panel (bottom-right) that answers questions about
  live data through tool-calls over shipments, organizations, consolidations,
  CFS entries, invoices, and aggregations. Read-only unless you tick
  *"Allow the assistant to create and update records"*.
- **Document AI** — `POST /api/ai/extract-document` extracts structured
  shipment, package, and commodity lines from a B/L, AWB, packing list, or
  commercial invoice.
- **Insights** — `GET /api/ai/insights` returns margin forecasting, ETA
  slippage, credit-risk scoring, and charge-anomaly detection. These are
  computed directly from your data and need **no** API key.

---

## Features

### Admin Panel
- **Dashboard** — KPI cards, revenue chart, shipment analytics, route stats, activity feed
- **Quotations** — Create/manage freight quotes (FCL, LCL, Air, Road), approve/reject workflow
- **Shipments** — Full shipment lifecycle management with tracking milestones
- **Jobs** — Operational job management linked to shipments
- **Invoices** — Invoice creation, line items, payment tracking, credit notes
- **CRM/Customers** — Customer profiles, contact management, shipment history
- **Rate Management** — Freight rate tables by route, carrier, mode, surcharges
- **Carriers** — Shipping lines, airlines, trucking companies
- **Ports & Airports** — Port/airport database with codes
- **Schedules** — Vessel sailing and flight schedules
- **Reports** — Analytics dashboards with charts
- **Users** — User management, role assignment
- **Settings** — Company profile, system configuration

### User App
- **Dashboard** — Personal KPIs, active shipments, pending quotes, unpaid invoices
- **Request Quote** — Multi-step quote request form
- **My Shipments** — Track all active and past shipments
- **Live Tracking** — Visual tracking timeline with milestones
- **Invoices** — View and download invoices
- **Profile** — Edit profile, change password

---

## API Reference

Base URL: `http://localhost:5000/api`

| Module | Endpoint |
|---|---|
| Auth | `/api/auth` |
| Dashboard | `/api/dashboard` |
| Quotations | `/api/quotations` |
| Shipments | `/api/shipments` |
| Jobs | `/api/jobs` |
| Invoices | `/api/invoices` |
| Customers | `/api/customers` |
| Rates | `/api/rates` |
| Carriers | `/api/carriers` |
| Ports | `/api/ports` |
| Tracking | `/api/tracking` |
| Schedules | `/api/schedules` |
| Users | `/api/users` |
| Reports | `/api/reports` |
| Notifications | `/api/notifications` |
| Documents | `/api/documents` |

---

## Project Structure

```
cargoflo/
├── backend/
│   ├── src/
│   │   ├── config/       # DB config, constants, seed data
│   │   ├── controllers/  # Business logic for each module
│   │   ├── middleware/   # Auth, error handling, file upload
│   │   ├── models/       # Sequelize models with associations
│   │   ├── routes/       # Express route definitions
│   │   └── utils/        # Helpers, email service
│   ├── uploads/          # Uploaded files
│   ├── server.js
│   └── package.json
└── frontend/
    └── src/
        ├── common/       # Shared components (Layout, Table, Modal...)
        ├── context/      # Auth & App context providers
        ├── hooks/        # Custom React hooks
        ├── pages/
        │   ├── admin/    # All admin panel pages
        │   ├── auth/     # Login page
        │   └── user/     # All user app pages
        ├── services/     # API service layer (axios)
        └── utils/        # Frontend utilities
```
