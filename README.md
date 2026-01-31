# UK Parliament Bill Amendment Query Website

A web application to query UK Parliament bill amendment data, replicating and extending your existing PowerQuery functionality with a local database to handle API rate limiting.

## Tech Stack

- **Backend**: Node.js + TypeScript + Express + Prisma (SQLite)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts
- **Database**: SQLite (easily migratable to PostgreSQL)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (will be installed if not present)

### Setup

1. **Install dependencies and set up database:**

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Or manually:

```bash
# Install pnpm if needed
npm install -g pnpm

# Install dependencies
pnpm install

# Generate Prisma client and create database
pnpm db:generate
pnpm --filter @bill-data-app/backend run db:push

# Build shared types
pnpm --filter @bill-data-app/shared run build
```

2. **Run initial data sync:**

```bash
pnpm sync
```

This fetches data from the UK Parliament APIs for the last 4 sessions. It may take 10-30 minutes depending on the amount of data.

3. **Start development servers:**

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure

```
billDataApp/
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── backend/         # Express API + Prisma + Sync jobs
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── routes/      # API endpoints
│   │       ├── services/    # Database service
│   │       ├── sync/        # Sync job logic
│   │       └── parliament-api/  # Rate-limited API client
│   └── frontend/        # React + Vite
│       └── src/
│           ├── pages/       # Page components
│           ├── components/  # Reusable components
│           └── api/         # API client
├── data/parliament.db   # SQLite database (created after sync)
└── scripts/             # Setup scripts
```

## API Endpoints

### Amendments
- `GET /api/v1/amendments` - Search amendments
  - Query params: `memberId`, `billId`, `sessionId`, `decision`, `skip`, `take`
- `GET /api/v1/amendments/stats` - Amendment statistics
  - Query params: `groupBy` (bill|decision|member|stage), `sessionId`, `memberId`

### Bills
- `GET /api/v1/bills` - List bills
  - Query params: `sessionId`, `activeOnly`, `skip`, `take`
- `GET /api/v1/bills/:id` - Bill details with stages
- `GET /api/v1/bills/:id/stages/:stageId/amendments` - Amendments for a stage

### Members
- `GET /api/v1/members/search` - Search members by name
  - Query params: `q`, `house`, `take`
- `GET /api/v1/members/:id` - Member details with amendment stats

### Other
- `GET /api/v1/sessions` - List parliamentary sessions
- `GET /api/v1/sync/status` - Sync job status and database stats

## Features

### Amendment Search
- Search by member/sponsor with autocomplete
- Filter by session, bill, and decision status
- Paginated results table
- CSV export

### Statistics
- Group amendments by bill, decision, stage, or member
- Bar charts and pie charts
- Filter by session and member

### Bills List
- Browse active bills by session
- View amendment counts per bill

### Member Profile
- View member details and party
- Decision breakdown pie chart
- Recent amendments list

## Sync Job

The sync job replicates your PowerQuery logic:

1. Fetches bills for the last 4 sessions
2. Filters out withdrawn, defeated, and enacted bills
3. Fetches all stages for each bill
4. Fetches amendments for each stage
5. Stores sponsor/member details

**Rate limiting**: 5 requests/second with exponential backoff on 429 responses.

### Running Sync

```bash
# Full sync (all data)
pnpm sync

# Or from the backend package
pnpm --filter @bill-data-app/backend run sync
```

## Data Sources

- [UK Parliament Bills API](https://bills-api.parliament.uk/)
- [UK Parliament Members API](https://members-api.parliament.uk/)
