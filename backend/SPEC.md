# backend: Local Services Problem-Solving Platform

> **Describe the problem. Get it fixed.**

A platform where people report everyday problems (a power fault, a leaking pipe, a wall to be built) and verified local workers (electricians, plumbers, contractors, construction workers) send quotes and fix them. Every job is tracked from posting to payment to review.

This README is the **single source of truth** for what we build, in what order, and what "done" means for each phase.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [Glossary](#3-glossary-read-this-first)
4. [Users and Roles](#4-users-and-roles)
5. [How It Works (End-to-End Flow)](#5-how-it-works-end-to-end-flow)
6. [Business Rules](#6-business-rules)
7. [Status Lifecycles](#7-status-lifecycles)
8. [Tech Stack and Key Decisions](#8-tech-stack-and-key-decisions)
9. [Project Structure](#9-project-structure)
10. [Data Model](#10-data-model)
11. [API Conventions](#11-api-conventions)
12. [Permissions Matrix](#12-permissions-matrix)
13. [Build Phases](#13-build-phases)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Testing Strategy](#15-testing-strategy)
16. [Getting Started](#16-getting-started)
17. [Environment Variables](#17-environment-variables)
18. [Definition of Done](#18-definition-of-done)
19. [Risks and Open Questions](#19-risks-and-open-questions)

---

## 1. Problem Statement

| Who | Pain today |
|---|---|
| **Customers** | They don't know who to trust, don't know what a fair price is, workers no-show, and there is no accountability when work is bad. They find workers by asking around or using Facebook groups. |
| **Contractors** | They get unsteady work, waste time on vague requests, and customers haggle or disappear after the job. |

**Our solution:** a *problem-first* platform. The customer describes the problem with photos and location. Relevant verified contractors send quotes. The customer picks one. The job is tracked, paid, and reviewed.

---

## 2. Goals and Non-Goals

### Goals
- G1. A customer can post a problem in under 2 minutes.
- G2. A customer receives comparable quotes from verified contractors.
- G3. Every job has a clear, trackable status from start to finish.
- G4. Trust is built through verification, reviews tied to completed jobs, and dispute handling.
- G5. Works for local payment reality (cash is a first-class option).

### Non-Goals (explicitly out of scope until stated otherwise)
- Not a general e-commerce or product marketplace.
- No native mobile apps in Phases 0 to 3 (mobile-friendly web only).
- No multi-country or multi-currency support. **Single currency: PKR.**
- No real-time GPS tracking of contractors before Phase 4.
- No contractor payroll or tax features.

---

## 3. Glossary (read this first)

These terms are used consistently everywhere in code, API, and UI.

| Term | Meaning |
|---|---|
| **Customer** | A user who posts problems and hires contractors. |
| **Contractor** | A user who offers services and sends quotes. Includes electricians, plumbers, builders, etc. |
| **Problem** | A request posted by a customer describing what needs fixing. |
| **Category** | A trade type (e.g. Electrical, Plumbing, Construction). Has optional sub-categories. |
| **Quote** | A contractor's offer on a problem: price, time estimate, note. |
| **Booking** | Created when a customer accepts a quote. Represents the actual job. |
| **Review** | A rating and comment from a customer about a completed booking. |
| **Verified contractor** | A contractor whose identity was approved by an admin. Only verified contractors can send quotes. |
| **Admin** | Platform staff who verify contractors, moderate content, and resolve disputes. |

> **Rule:** "Problem" is what the customer posts. "Booking" is the job after a quote is accepted. Never use "job" or "order" in code or API.

---

## 4. Users and Roles

| Role | Can do (summary) |
|---|---|
| `CUSTOMER` | Register, post problems, view and compare quotes, accept a quote, track a booking, confirm completion, review, cancel. |
| `CONTRACTOR` | Register, build a profile, submit for verification, browse matching problems, send quotes, update booking status, view earnings. |
| `ADMIN` | Verify or reject contractors, manage categories, moderate problems and reviews, resolve disputes, view analytics. |

- One account has **exactly one role**.
- A person who is both a customer and a contractor must use two separate accounts (simplifies permissions). Revisit in Phase 4.

---

## 5. How It Works (End-to-End Flow)

```
CUSTOMER                         SYSTEM                          CONTRACTOR
   │                                │                                │
   │ 1. Posts problem (photos,      │                                │
   │    category, location, urgency)│                                │
   │───────────────────────────────▶│                                │
   │                                │ 2. Finds matching verified     │
   │                                │    contractors (category+city) │
   │                                │───────────────────────────────▶│
   │                                │                                │ 3. Reviews problem,
   │                                │◀───────────────────────────────│    sends quote
   │ 4. Compares quotes             │                                │
   │◀───────────────────────────────│                                │
   │ 5. Accepts one quote           │                                │
   │───────────────────────────────▶│ 6. Creates Booking, rejects    │
   │                                │    other quotes, notifies      │
   │                                │───────────────────────────────▶│
   │                                │                                │ 7. Updates status:
   │◀───────────────────────────────│◀───────────────────────────────│    on the way → in progress
   │                                │                                │    → work done
   │ 8. Confirms completion         │                                │
   │───────────────────────────────▶│ 9. Booking COMPLETED           │
   │ 10. Leaves a review            │                                │
   │───────────────────────────────▶│                                │
```

---

## 6. Business Rules

Numbered so they can be referenced in code comments, tests, and tickets.

### Accounts
- **BR-01** Email must be unique. Phone number must be unique and in a valid format.
- **BR-02** Passwords: minimum 8 characters, at least one letter and one number. Stored as a hash (argon2 or bcrypt), never in plain text.
- **BR-03** A contractor cannot send quotes until their verification status is `VERIFIED`.

### Problems
- **BR-10** Required fields: title (5 to 100 chars), description (20 to 2000 chars), category, city, urgency.
- **BR-11** A problem accepts a maximum of **5 images**, each **at most 5 MB**, formats `jpg`, `png`, `webp`.
- **BR-12** Urgency values: `EMERGENCY`, `TODAY`, `THIS_WEEK`, `FLEXIBLE`.
- **BR-13** A problem with no accepted quote expires automatically after **7 days** (configurable) and becomes `EXPIRED`.
- **BR-14** A customer can edit a problem only while it is `OPEN` and has **no quotes**. Otherwise they may only cancel it.
- **BR-15** A customer can cancel a problem while it is `OPEN`. Pending quotes become `REJECTED`.

### Quotes
- **BR-20** A contractor can send **only one quote per problem**. They may edit it while it is `PENDING`.
- **BR-21** A quote contains: price (integer PKR, greater than 0), estimated duration (hours or days), message (up to 500 chars), and an optional proposed start time.
- **BR-22** A quote can be sent only if the problem is `OPEN` and the contractor works in that category and city.
- **BR-23** A contractor can withdraw a quote while it is `PENDING`.
- **BR-24** A problem accepts a maximum of **10 quotes** (configurable). After that, no more quotes are allowed.

### Bookings
- **BR-30** Accepting a quote creates exactly **one booking** and sets the problem to `BOOKED`. All other quotes on that problem become `REJECTED`. This happens in **one database transaction**.
- **BR-31** The booking price equals the accepted quote's price. A price change requires an explicit price-adjustment flow (Phase 3), never a silent edit.
- **BR-32** Only the assigned contractor can move a booking forward: `SCHEDULED → ON_THE_WAY → IN_PROGRESS → AWAITING_CONFIRMATION`.
- **BR-33** Only the customer can confirm completion (`AWAITING_CONFIRMATION → COMPLETED`).
- **BR-34** If the customer does not respond within **72 hours** of `AWAITING_CONFIRMATION`, the booking auto-completes. (Customer can still open a dispute within that window.)
- **BR-35** Cancellation: the customer may cancel while `SCHEDULED`. The contractor may cancel while `SCHEDULED` or `ON_THE_WAY`. Contractor cancellations are counted against their reliability score.
- **BR-36** Contact details (phone numbers) are revealed to both parties **only after** a booking is created.

### Reviews
- **BR-40** Only the customer of a `COMPLETED` booking can review, **once per booking**.
- **BR-41** Rating is an integer from 1 to 5. Comment is optional, up to 1000 chars.
- **BR-42** A contractor's average rating is recalculated whenever a review is created, edited, or removed by an admin.
- **BR-43** Reviews can be edited within 48 hours; after that they are locked (admins may remove abusive ones).

### Payments (Phase 1: cash only)
- **BR-50** In Phase 1, payment is **cash on completion**. The contractor marks "payment received" and the customer confirms. No money moves through the platform.
- **BR-51** From Phase 3, platform commission is a configurable percentage of the booking price, charged to the contractor.

---

## 7. Status Lifecycles

### Problem status

```
OPEN ──accept quote──▶ BOOKED ──booking completed──▶ COMPLETED
  │                       │
  ├──customer cancels──▶ CANCELLED ◀──booking cancelled (reopen not allowed in MVP)
  └──7 days, no booking──▶ EXPIRED
```

| From | To | Triggered by |
|---|---|---|
| `OPEN` | `BOOKED` | Customer accepts a quote |
| `OPEN` | `CANCELLED` | Customer cancels |
| `OPEN` | `EXPIRED` | System (scheduled job) |
| `BOOKED` | `COMPLETED` | Booking completes |
| `BOOKED` | `CANCELLED` | Booking cancelled |

### Quote status

| Status | Meaning |
|---|---|
| `PENDING` | Sent, waiting for the customer's decision |
| `ACCEPTED` | Chosen by customer (exactly one per problem) |
| `REJECTED` | Another quote was accepted, or the problem was cancelled or expired |
| `WITHDRAWN` | Contractor took it back |

### Booking status

```
SCHEDULED → ON_THE_WAY → IN_PROGRESS → AWAITING_CONFIRMATION → COMPLETED
    │            │                              │
    └────────────┴──── CANCELLED                └──── DISPUTED (Phase 3) → COMPLETED / CANCELLED
```

| From | To | Allowed actor |
|---|---|---|
| `SCHEDULED` | `ON_THE_WAY` | Contractor |
| `ON_THE_WAY` | `IN_PROGRESS` | Contractor |
| `IN_PROGRESS` | `AWAITING_CONFIRMATION` | Contractor |
| `AWAITING_CONFIRMATION` | `COMPLETED` | Customer (or system after 72h) |
| `SCHEDULED` | `CANCELLED` | Customer or Contractor |
| `ON_THE_WAY` | `CANCELLED` | Contractor |
| `AWAITING_CONFIRMATION` | `DISPUTED` | Customer (Phase 3) |

> Any transition not listed above is **invalid** and must return `409 INVALID_STATUS_TRANSITION`.
> Every transition is recorded in `status_history` (who, when, from, to, optional note).

### Contractor verification status

`UNSUBMITTED → PENDING → VERIFIED | REJECTED` (a rejected contractor may resubmit; admin must give a rejection reason).

---

## 8. Tech Stack and Key Decisions

| Layer | Choice | Why |
|---|---|---|
| Backend | **NestJS** (TypeScript) | Modular, scalable, built-in validation and guards |
| Database | **PostgreSQL** | Relational data, transactions, constraints |
| ORM | **Prisma** | Type-safe queries, simple migrations |
| Auth | **JWT** (access + refresh tokens) | Stateless, standard |
| Validation | `class-validator` + `class-transformer` | DTO validation |
| API docs | **Swagger (OpenAPI)** | Always up-to-date docs |
| File storage | **Cloudinary** or S3-compatible bucket | Image hosting; never store files in the DB |
| Frontend (recommended) | **Next.js + TypeScript** | SSR, good DX |
| Real-time (Phase 2) | NestJS WebSocket gateway (Socket.IO) | Chat and live status |
| Background jobs | `@nestjs/schedule` (Phase 1), BullMQ + Redis (Phase 2+) | Expiry, notifications |
| Testing | Jest + Supertest | Unit and e2e |
| Tooling | ESLint, Prettier, Husky, GitHub Actions | Consistent quality |
| Containers | Docker + docker-compose | Reproducible local setup |

### Decisions (fixed, do not re-debate mid-build)

| # | Decision |
|---|---|
| D1 | REST API, versioned under `/api/v1`. |
| D2 | IDs are UUIDs. |
| D3 | All money is stored as **integer PKR** (no decimals). |
| D4 | All timestamps are stored in **UTC**, serialized as ISO-8601. |
| D5 | Deleting data is **soft delete** (`deleted_at`) for users, problems, and reviews. |
| D6 | Access token lifetime 15 min; refresh token 7 days with rotation. |
| D7 | Phase 1 location filtering is by **city + category**. Distance-based matching starts in Phase 2. |
| D8 | Every status change goes through a single service method that validates the transition table in Section 7. |

---

## 9. Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                 # categories, admin user, demo data
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/         # @Roles(), @CurrentUser()
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   ├── filters/            # global exception filter
│   │   ├── interceptors/       # response transform, logging
│   │   ├── pipes/
│   │   └── dto/                # PaginationDto, etc.
│   ├── config/                 # env validation
│   ├── prisma/                 # PrismaService
│   └── modules/
│       ├── auth/
│       ├── users/
│       ├── contractors/        # profiles + verification
│       ├── categories/
│       ├── problems/
│       ├── quotes/
│       ├── bookings/           # includes status machine
│       ├── reviews/
│       ├── media/              # uploads
│       ├── admin/
│       ├── notifications/      # Phase 2
│       ├── chat/               # Phase 2
│       ├── payments/           # Phase 3
│       └── disputes/           # Phase 3
├── test/                       # e2e tests
├── docker-compose.yml
├── .env.example
└── README.md
```

**Module rule:** each module owns its controller, service, DTOs, and tests. Modules talk to each other **through services**, never by touching another module's tables directly.

---

## 10. Data Model

Conventions: every table has `id` (UUID), `created_at`, `updated_at`. `deleted_at` where noted.

### `users`
| Column | Type | Notes |
|---|---|---|
| email | string | unique |
| phone | string | unique |
| password_hash | string | |
| full_name | string | |
| role | enum | `CUSTOMER`, `CONTRACTOR`, `ADMIN` |
| is_active | boolean | default true |
| deleted_at | timestamp | nullable |

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| user_id | FK users | |
| token_hash | string | |
| expires_at | timestamp | |
| revoked_at | timestamp | nullable |

### `categories`
| Column | Type | Notes |
|---|---|---|
| name | string | unique within parent |
| slug | string | unique |
| parent_id | FK categories | nullable (sub-category) |
| is_active | boolean | |

### `contractor_profiles` (1:1 with a contractor user)
| Column | Type | Notes |
|---|---|---|
| user_id | FK users | unique |
| bio | text | up to 1000 chars |
| years_experience | int | |
| city | string | primary city |
| service_areas | string[] | extra areas served |
| verification_status | enum | `UNSUBMITTED`, `PENDING`, `VERIFIED`, `REJECTED` |
| rejection_reason | text | nullable |
| avg_rating | decimal(3,2) | default 0 |
| review_count | int | default 0 |
| completed_jobs | int | default 0 |
| cancelled_jobs | int | default 0 |

### `contractor_categories` (many-to-many)
`contractor_id`, `category_id`

### `problems`
| Column | Type | Notes |
|---|---|---|
| customer_id | FK users | |
| category_id | FK categories | |
| title | string | |
| description | text | |
| city | string | |
| area | string | neighborhood or address text |
| latitude, longitude | decimal | nullable in Phase 1 |
| urgency | enum | see BR-12 |
| budget_min, budget_max | int | optional, PKR |
| status | enum | `OPEN`, `BOOKED`, `COMPLETED`, `CANCELLED`, `EXPIRED` |
| expires_at | timestamp | |
| deleted_at | timestamp | nullable |

### `problem_media`
`problem_id`, `url`, `type` (`IMAGE`; `VIDEO` and `AUDIO` in Phase 2), `size_bytes`

### `quotes`
| Column | Type | Notes |
|---|---|---|
| problem_id | FK | |
| contractor_id | FK users | |
| price | int | PKR, > 0 |
| estimated_duration_hours | int | |
| proposed_start_at | timestamp | nullable |
| message | string | up to 500 |
| status | enum | `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN` |

**Constraint:** unique (`problem_id`, `contractor_id`). Partial unique index: only one `ACCEPTED` quote per problem.

### `bookings`
| Column | Type | Notes |
|---|---|---|
| problem_id | FK | unique (one booking per problem) |
| quote_id | FK | unique |
| customer_id, contractor_id | FK users | |
| agreed_price | int | PKR |
| scheduled_at | timestamp | |
| status | enum | see Section 7 |
| payment_method | enum | `CASH` (Phase 1) |
| payment_status | enum | `UNPAID`, `PAID` |
| completed_at | timestamp | nullable |

### `status_history`
`entity_type` (`PROBLEM` or `BOOKING`), `entity_id`, `from_status`, `to_status`, `changed_by`, `note`, `created_at`

### `reviews`
| Column | Type | Notes |
|---|---|---|
| booking_id | FK | unique |
| customer_id, contractor_id | FK users | |
| rating | int | 1 to 5 |
| comment | text | nullable |
| deleted_at | timestamp | nullable |

### Later-phase tables (do not create before their phase)
`messages`, `conversations`, `notifications`, `payments`, `wallet_transactions`, `disputes`, `dispute_evidence`, `warranties`, `recurring_services`.

---

## 11. API Conventions

- **Base URL:** `/api/v1`
- **Auth header:** `Authorization: Bearer <access_token>`
- **Format:** JSON only.
- **Pagination:** `?page=1&limit=20` (max limit 50). Response includes `meta: { page, limit, total, totalPages }`.
- **Filtering and sorting:** `?status=OPEN&category=plumbing&city=Faisalabad&sort=-created_at`

### Success response
```json
{
  "data": { "...": "..." },
  "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
}
```

### Error response (always this shape)
```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Booking cannot move from SCHEDULED to COMPLETED.",
    "details": []
  }
}
```

### Standard error codes
| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Role or ownership not allowed |
| 403 | `CONTRACTOR_NOT_VERIFIED` | Unverified contractor tries to quote |
| 404 | `NOT_FOUND` | Resource missing |
| 409 | `INVALID_STATUS_TRANSITION` | Transition not in the table |
| 409 | `DUPLICATE_RESOURCE` | e.g. second quote on same problem |
| 409 | `PROBLEM_NOT_OPEN` | Quote or action on a non-open problem |
| 413 | `FILE_TOO_LARGE` | Over 5 MB |
| 415 | `UNSUPPORTED_FILE_TYPE` | Not jpg, png or webp |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected (never leak stack traces) |

### Endpoints by module (Phase 1 / MVP)

**Auth**
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register customer or contractor |
| POST | `/auth/login` | Returns access and refresh tokens |
| POST | `/auth/refresh` | Rotate tokens |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/me` | Current user |

**Categories**
| Method | Path | Description |
|---|---|---|
| GET | `/categories` | List (public) |
| POST / PATCH | `/categories`, `/categories/:id` | Admin only |

**Contractors**
| Method | Path | Description |
|---|---|---|
| GET | `/contractors/me/profile` | Own profile |
| PUT | `/contractors/me/profile` | Create or update profile |
| POST | `/contractors/me/submit-verification` | `UNSUBMITTED/REJECTED → PENDING` |
| GET | `/contractors/:id` | Public profile with rating and reviews |

**Problems**
| Method | Path | Description |
|---|---|---|
| POST | `/problems` | Customer creates a problem |
| GET | `/problems` | Customer: own problems. Contractor: matching open problems |
| GET | `/problems/:id` | Detail (owner, matching contractor, or admin) |
| PATCH | `/problems/:id` | Edit (BR-14) |
| POST | `/problems/:id/cancel` | Cancel (BR-15) |
| POST | `/problems/:id/media` | Upload images (BR-11) |

**Quotes**
| Method | Path | Description |
|---|---|---|
| POST | `/problems/:id/quotes` | Contractor sends quote |
| GET | `/problems/:id/quotes` | Problem owner sees all quotes |
| PATCH | `/quotes/:id` | Contractor edits own pending quote |
| POST | `/quotes/:id/withdraw` | Contractor withdraws |
| POST | `/quotes/:id/accept` | Customer accepts, creates booking (transaction) |
| GET | `/quotes/mine` | Contractor's own quotes |

**Bookings**
| Method | Path | Description |
|---|---|---|
| GET | `/bookings` | Own bookings (either role) |
| GET | `/bookings/:id` | Detail with status history |
| POST | `/bookings/:id/status` | Body: `{ "status": "ON_THE_WAY", "note": "..." }` |
| POST | `/bookings/:id/confirm` | Customer confirms completion |
| POST | `/bookings/:id/cancel` | Cancel with reason |
| POST | `/bookings/:id/mark-paid` | Contractor marks cash received |

**Reviews**
| Method | Path | Description |
|---|---|---|
| POST | `/bookings/:id/review` | Customer reviews |
| PATCH | `/reviews/:id` | Edit within 48h |
| GET | `/contractors/:id/reviews` | Public list |

**Admin**
| Method | Path | Description |
|---|---|---|
| GET | `/admin/contractors?status=PENDING` | Verification queue |
| POST | `/admin/contractors/:id/verify` | Approve |
| POST | `/admin/contractors/:id/reject` | Reject (reason required) |
| GET | `/admin/problems`, `/admin/bookings` | Oversight |
| DELETE | `/admin/reviews/:id` | Remove abusive review |

---

## 12. Permissions Matrix

| Action | Customer | Contractor | Admin |
|---|:-:|:-:|:-:|
| Register / login | ✅ | ✅ | ✅ |
| Post a problem | ✅ | ❌ | ❌ |
| View own problems | ✅ | ❌ | ✅ (all) |
| Browse matching open problems | ❌ | ✅ (verified, matching category and city) | ✅ |
| Send a quote | ❌ | ✅ (verified only) | ❌ |
| View quotes on a problem | ✅ (own problem) | ✅ (own quote only) | ✅ |
| Accept a quote | ✅ (own problem) | ❌ | ❌ |
| Update booking progress | ❌ | ✅ (assigned) | ❌ |
| Confirm completion | ✅ (own booking) | ❌ | ❌ |
| Review a contractor | ✅ (completed booking) | ❌ | ❌ |
| Verify contractors | ❌ | ❌ | ✅ |
| Manage categories | ❌ | ❌ | ✅ |
| Remove reviews | ❌ | ❌ | ✅ |

**Ownership rule:** a user can only read or modify resources they own or are a party to, even if their role allows the action type. Always check ownership in the service layer, not only in guards.

---

## 13. Build Phases

Each phase has a **goal**, **tasks**, **deliverables**, and **acceptance criteria**. Do not start a phase until the previous one meets its acceptance criteria.

---

### Phase 0: Foundation (Week 1)

**Goal:** a clean, running backend skeleton with database and auth-ready infrastructure.

**Tasks**
- [ ] `nest new backend`, set up Git, ESLint, Prettier, Husky pre-commit
- [ ] Docker Compose with PostgreSQL (and later Redis)
- [ ] Prisma setup, first migration, `PrismaService`
- [ ] Config module with env validation (app fails fast if env is missing)
- [ ] Global validation pipe, global exception filter (error shape from Section 11), response interceptor
- [ ] Swagger at `/api/docs`
- [ ] Health endpoint `GET /health`
- [ ] GitHub Actions: lint + test on every push
- [ ] Seed script: categories (Electrical, Plumbing, Construction, Carpentry, Painting, AC and Appliance Repair, Cleaning, Other) and one admin user

**Deliverables:** running app, migrations, seed, CI green.

**Acceptance criteria**
- `docker compose up` + `npm run start:dev` works from a fresh clone using `.env.example`.
- `GET /health` returns 200 and confirms DB connectivity.
- Invalid input to any endpoint returns the standard error shape.

---

### Phase 1: MVP Core (Weeks 2 to 6)

**Goal:** the full problem → quote → booking → review loop works end-to-end with cash payment.

#### 1.1 Auth and Users (Week 2)
- [ ] Register (customer/contractor), login, refresh with rotation, logout, `/auth/me`
- [ ] `JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@CurrentUser()`
- [ ] Password hashing, rate limiting on auth routes
- [ ] Unit and e2e tests for all auth flows

**Done when:** BR-01, BR-02 are enforced; a customer token cannot access contractor-only routes (403).

#### 1.2 Categories and Contractor Profiles (Week 3)
- [ ] Categories CRUD (admin), public list
- [ ] Contractor profile create/update, category and city selection
- [ ] Submit verification; admin approve/reject with reason
- [ ] Public contractor profile

**Done when:** an unverified contractor gets `403 CONTRACTOR_NOT_VERIFIED` on quoting (tested later in 1.4).

#### 1.3 Problems and Media (Week 4)
- [ ] Create, list, detail, edit, cancel problem (BR-10 to BR-15)
- [ ] Image upload with size/type validation, stored in Cloudinary/S3
- [ ] Contractor feed: open problems filtered by their categories and city, paginated
- [ ] Scheduled job to expire problems (BR-13)
- [ ] `status_history` recording

**Done when:** every validation rule in BR-10 to BR-15 has a passing test.

#### 1.4 Quotes and Bookings (Week 5)
- [ ] Send, edit, withdraw quote (BR-20 to BR-24)
- [ ] Accept quote → create booking **in a single transaction** (BR-30)
- [ ] Booking status machine with transition table (BR-32 to BR-35)
- [ ] Mark cash paid (BR-50)
- [ ] Auto-complete after 72h (BR-34)
- [ ] Contact details revealed only after booking (BR-36)

**Done when:** a concurrency test (two simultaneous accepts on the same problem) results in exactly one booking; all invalid transitions return `409`.

#### 1.5 Reviews and Admin (Week 6)
- [ ] Create/edit review, rating aggregation (BR-40 to BR-43)
- [ ] Admin: verification queue, remove reviews, list problems/bookings
- [ ] Basic frontend (Next.js) covering the main flow for each role *(or Postman collection + Swagger if the frontend starts later)*

**Phase 1 acceptance criteria (MVP complete)**
1. A new customer can register, post a problem with photos, and see quotes.
2. A verified contractor can see matching problems and send exactly one quote.
3. Accepting a quote creates one booking and rejects all other quotes.
4. A booking can only move along the allowed transitions, and each change is logged.
5. A completed booking can be reviewed once; the contractor's average rating updates.
6. An admin can verify a contractor and remove a review.
7. All endpoints are documented in Swagger; e2e test suite covers the full happy path and key failure paths.

---

### Phase 2: Communication and Smart Matching (Weeks 7 to 9)

**Goal:** make the platform feel alive and send better problems to better contractors.

- [ ] **Notifications:** in-app + email (SMS/WhatsApp optional) for: new matching problem, new quote, quote accepted/rejected, every booking status change, review received
- [ ] **Chat** per booking and per quote (WebSocket + stored history); phone numbers still hidden until booking
- [ ] **Distance-based matching:** store lat/long, Haversine distance filter (radius configurable, default 15 km)
- [ ] **Ranking:** score = category match (required) + distance + rating + response time + completion rate; send problems to top N (default 10) contractors
- [ ] **Phone OTP verification** for registration
- [ ] **Voice notes and short video** (limit 30 s / 20 MB) on problems
- [ ] **Urdu and Roman Urdu** UI strings (i18n)
- [ ] Redis + BullMQ for notification queue and reliable scheduled jobs

**Acceptance criteria**
- A new quote triggers a notification to the customer within 5 seconds.
- Contractors outside the radius do not see the problem.
- Chat messages persist and are only visible to the two participants.

---

### Phase 3: Payments, Trust and Disputes (Weeks 10 to 13)

**Goal:** protect both sides and make the platform financially sustainable.

- [ ] **Digital payments:** integrate one provider first (JazzCash **or** Easypaisa), then the other
- [ ] **Escrow (optional per booking):** customer pays → funds held → released on confirmation
- [ ] **Commission engine** (BR-51) and **contractor wallet** with transaction ledger
- [ ] **Payout requests** (contractor withdraws wallet balance; admin approves)
- [ ] **Dispute system:** customer opens a dispute within the confirmation window, uploads evidence, admin resolves (full release, refund, or partial)
- [ ] **Price adjustment flow:** contractor proposes extra cost, customer must approve (BR-31)
- [ ] **Document-based verification:** CNIC and certificate uploads, admin review
- [ ] **Contractor reliability score** (cancellations, no-shows, disputes)
- [ ] Audit log for all admin actions

**Acceptance criteria**
- Money movements are recorded in an append-only ledger and balances always reconcile.
- Dispute resolution changes booking and payment state correctly.
- No payment can be processed twice (idempotency keys).

---

### Phase 4: Differentiators (Weeks 14 to 18)

**Goal:** features that make the product stand out from asking around.

- [ ] **AI problem diagnosis:** the customer uploads a photo, and the AI suggests the likely issue, the right category, and a rough cost range (always labelled "estimate")
- [ ] **Warranty tracking:** each booking can carry a warranty period; one-tap re-request to the same contractor
- [ ] **Recurring services:** reminders and re-booking (AC servicing, tank cleaning)
- [ ] **Multi-trade problems:** split one request (e.g. bathroom renovation) into sub-problems per trade
- [ ] **Contractor teams:** a contractor account can add helpers and manage multiple bookings
- [ ] **Live location sharing** during `ON_THE_WAY`
- [ ] **Community problems:** public neighborhood issues with upvotes and contractor bids
- [ ] **Analytics dashboard** for admin (busiest categories, response times, conversion)

**Acceptance criteria:** each feature behind a feature flag, with its own tests and docs.

---

### Phase 5: Hardening and Launch (Weeks 19 to 20)

**Goal:** production-ready, secure, observable.

- [ ] Security review (OWASP Top 10 checklist), dependency audit, secrets management
- [ ] Rate limiting, Helmet, CORS allow-list, request size limits
- [ ] Database indexes reviewed against real query plans; load test key endpoints
- [ ] Logging (structured), error tracking (e.g. Sentry), uptime monitoring
- [ ] Automated daily database backups and a tested restore
- [ ] Production deployment (Docker, CI/CD, staging + production environments)
- [ ] Terms of Service, Privacy Policy, data deletion flow
- [ ] Pilot launch in **one city** with a small set of contractors; collect feedback

**Acceptance criteria**
- p95 response time under 500 ms for core read endpoints at 100 concurrent users.
- Restore from backup tested successfully.
- Zero critical or high vulnerabilities in the audit.

---

## 14. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Security** | Hashed passwords, JWT expiry, refresh rotation, input validation on every endpoint, ownership checks, rate limiting, no secrets in Git |
| **Privacy** | Phone numbers hidden until booking; users can request account deletion; images served via signed or public CDN URLs only for the problem's parties where feasible |
| **Performance** | Indexes on foreign keys and filter columns (`status`, `category_id`, `city`, `created_at`); pagination on every list |
| **Reliability** | Multi-step operations in transactions; scheduled jobs are idempotent |
| **Observability** | Request ID on every log line; errors reported with context |
| **Maintainability** | Strict TypeScript, no `any` without justification, modules with single responsibility |
| **Accessibility and UX** | Mobile-first, readable on low-end phones and slow networks, Urdu support |

---

## 15. Testing Strategy

| Level | What | Tool |
|---|---|---|
| Unit | Services, status machine, price and rating calculations | Jest |
| Integration | Prisma queries, transactions | Jest + test database |
| E2E | Full API flows | Supertest |
| Manual | Role-based walkthroughs | Swagger / Postman |

**Mandatory tests**
- Every transition in the status tables (valid passes, invalid returns 409).
- Quote acceptance concurrency (only one booking).
- Permission checks (each role and each ownership case).
- Every business rule BR-xx has at least one test that references its ID.

**Coverage target:** 80% on services, 100% on the status machine.

---

## 16. Getting Started

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- npm or pnpm

### Setup
```bash
# 1. Clone
git clone <repo-url> backend
cd backend

# 2. Environment
cp .env.example .env

# 3. Start database
docker compose up -d

# 4. Install and migrate
npm install
npx prisma migrate dev
npx prisma db seed

# 5. Run
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/api/docs`

### Useful scripts
| Command | Purpose |
|---|---|
| `npm run start:dev` | Dev server with reload |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npx prisma studio` | Browse database |
| `npx prisma migrate dev --name <name>` | Create a migration |

---

## 17. Environment Variables

| Variable | Example | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `3000` | API port |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/services` | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | *(long random string)* | Access token secret |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_SECRET` | *(long random string)* | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `CLOUDINARY_URL` | `cloudinary://...` | Image storage (or S3 variables) |
| `PROBLEM_EXPIRY_DAYS` | `7` | BR-13 |
| `MAX_QUOTES_PER_PROBLEM` | `10` | BR-24 |
| `BOOKING_AUTO_COMPLETE_HOURS` | `72` | BR-34 |
| `REDIS_URL` | `redis://localhost:6379` | Phase 2+ |
| `COMMISSION_PERCENT` | `8` | Phase 3 |

The app **must refuse to start** if required variables are missing or invalid.

---

## 18. Definition of Done

A task or feature is **done** only when:

- [ ] It meets the relevant business rules (BR-xx) and acceptance criteria.
- [ ] Input is validated; errors use the standard error shape.
- [ ] Permissions and ownership are enforced and tested.
- [ ] Unit and e2e tests are written and passing.
- [ ] Swagger documentation is updated.
- [ ] Database changes have a migration (no manual schema edits).
- [ ] Lint passes and CI is green.
- [ ] The change is reviewed (self-review checklist if working solo).

---

## 19. Risks and Open Questions

### Risks and mitigations
| Risk | Mitigation |
|---|---|
| Customers bypass the platform after getting contact info | Reveal contact only after booking; reputation and warranty benefits for staying on-platform |
| Fake contractors | Admin verification, ID checks in Phase 3, reliability score |
| Chicken-and-egg (no contractors, no customers) | Launch in **one city** and onboard contractors first |
| Low trust in online payments | Cash is supported from day one |
| Scope creep | Follow the phases; anything new goes to the next phase backlog |

### Open questions (decide before the related phase starts)
| # | Question | Needed by |
|---|---|---|
| Q1 | Which city is the pilot city? | Phase 1 (seed data) |
| Q2 | Is commission charged per job or via a subscription? | Phase 3 |
| Q3 | Which payment provider is integrated first? | Phase 3 |
| Q4 | Which AI provider is used for diagnosis, and what is the cost limit per request? | Phase 4 |
| Q5 | Should one person be allowed to hold both roles? | Phase 4 |

---

## License

To be decided.
