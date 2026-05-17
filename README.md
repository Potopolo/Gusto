# Nutrition

Private personal meal planner, shopping list, and nutrition tracker. UI in French.
See `../PLAN-nutrition.md` (on the Desktop) for the full project spec.

## Setup

```bash
npm install
npm run db:generate   # create initial migration from schema
npm run db:migrate    # apply migrations to data/local.db
npm run db:seed       # insert household + 2 users + equipment
npm run dev           # http://localhost:5173
```

Default password is in `.env.local` (`HOUSEHOLD_PASSWORD`). Change it before deploying anywhere.

## Reset DB

```bash
npm run db:reset
```
