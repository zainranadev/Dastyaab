# SortItOut: local services platform

Built in phases so each layer is proven before the next one sits on it.
`services-api/SPEC.md` is the original spec; every rule comment in the code (BR-xx, D-xx) points back to it.

```
docker-compose.yml   Postgres 16 (+ a services_test database for e2e)
services-api/        NestJS 11 + Prisma + PostgreSQL        (Phase A, port 3000)
web/                 Next.js 15 + Tailwind, Muted Clay / Sandstone theme  (Phase B, port 3001)
```

## Run it

```bash
docker compose up -d                       # Postgres

# Phase A: backend
cd services-api
cp .env.example .env                       # then set both JWT secrets (16+ chars)
npm install
npx prisma migrate dev --name init         # creates tables + generates the client
npm run db:seed                            # categories, admin, demo customer + verified contractor
npm run start:dev                          # http://localhost:3000/api/docs

# Phase B: frontend (new terminal)
cd web
cp .env.local.example .env.local
npm install && npm run dev                 # http://localhost:3001
```

Seeded logins: `admin@services.local / Admin12345`, `customer@demo.local` and `contractor@demo.local` (both `Demo12345`).

## Phase gates (run in this order; fix before moving on)

| Gate | Command | Proves |
|---|---|---|
| 1. Types | `npm run typecheck` | the code and Prisma schema agree |
| 2. Unit | `npm test` | status machine (every allowed and forbidden move), plus a no-database smoke test of DI, guards, validation and the error shape |
| 3. Build | `npm run build` | production bundle compiles |
| 4. API e2e | see below | the full Phase 1 flow against a real database |
| 5. Frontend | `cd web && npm run typecheck && npm run build` | UI compiles against the API types |

```bash
cd services-api
cp .env.test.example .env.test
DATABASE_URL=postgresql://services:services@localhost:5432/services_test npx prisma migrate deploy
npm run test:e2e        # refuses to run unless the database name contains "test"
```

## Debugging map

- Every response has an `x-request-id` header, and every log line carries it.
- Errors always look like `{ "error": { "code", "message", "details" } }`. `code` tells you which layer rejected the request.
- `401` is the JWT guard, `403` is role/ownership/verification, `409` is a status rule, `400` is DTO validation (see `details`).
- All status changes go through `common/status/status.service.ts`, which validates against `status-machine.ts` and writes `status_history`.
- Config problems show up at startup as a list of exactly which variables are wrong.

## Deviations from the spec (all small)

- Frontend is a separate Next.js app, as the spec recommends. The NestJS API is the backend.
- Extra error codes for clearer 409s: `PROBLEM_HAS_QUOTES`, `QUOTE_LIMIT_REACHED`, `QUOTE_NOT_PENDING`, `BOOKING_NOT_COMPLETED`, `BOOKING_NOT_PAYABLE`, `REVIEW_LOCKED`, `SERVICE_UNAVAILABLE`.
- "Only one accepted quote per problem" is enforced by a compare-and-set on the problem status plus `bookings.problem_id UNIQUE`, so no partial index is needed.
- Image storage: `STORAGE_DRIVER=local` for dev (served from `/uploads`), `cloudinary` for production.
- Tokens live in `localStorage` in the web app. Before launch, move them to httpOnly cookies (spec Phase 5 hardening).
- Not in Phase 1 by design: notifications, disputes, online payments, maps, chat.
