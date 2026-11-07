/**
 * Phase 1 end-to-end tests. Needs a migrated Postgres test database:
 *   cp .env.test.example .env.test
 *   DATABASE_URL=postgresql://services:services@localhost:5432/services_test npx prisma migrate deploy
 *   npm run test:e2e
 * Every BR-xx referenced here is the rule from README section 6.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';

type Session = { token: string; id: string };

describe('Phase 1: problem -> quote -> booking -> review', () => {
  let app: NestExpressApplication;
  let prisma: import('../src/prisma/prisma.service').PrismaService;
  let bookings: import('../src/modules/bookings/bookings.service').BookingsService;
  let problems: import('../src/modules/problems/problems.service').ProblemsService;
  let categoryId: string;
  let admin: Session;
  let seq = 0;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const { BookingsService } = await import('../src/modules/bookings/bookings.service');
    const { ProblemsService } = await import('../src/modules/problems/problems.service');
    const { configureApp } = await import('../src/app.setup');

    const dbName = (process.env.DATABASE_URL ?? '').split('/').pop() ?? '';
    if (!/test/i.test(dbName)) {
      throw new Error(`Refusing to run e2e: database "${dbName}" does not contain "test" (tables get truncated).`);
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    bookings = app.get(BookingsService);
    problems = app.get(ProblemsService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE status_history, reviews, bookings, quotes, problem_media, problems, contractor_categories, contractor_profiles, refresh_tokens, categories, users CASCADE',
    );
    categoryId = (await prisma.category.create({ data: { name: 'Plumbing', slug: 'plumbing' } })).id;
    await prisma.user.create({
      data: {
        email: 'admin@e2e.test', phone: '+920000000000', fullName: 'Admin', role: 'ADMIN',
        passwordHash: await bcrypt.hash('Admin12345', 4),
      },
    });
    const login = await http().post('/api/v1/auth/login').send({ email: 'admin@e2e.test', password: 'Admin12345' }).expect(200);
    admin = { token: login.body.data.accessToken, id: login.body.data.user.id };
  });

  afterAll(async () => {
    await app?.close();
  });

  // ---------- helpers ----------
  async function register(role: 'CUSTOMER' | 'CONTRACTOR'): Promise<Session> {
    seq++;
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: `u${seq}@e2e.test`, phone: `+92300${String(1000000 + seq)}`, password: 'Passw0rd1', fullName: `User ${seq}`, role })
      .expect(201);
    return { token: res.body.data.accessToken, id: res.body.data.user.id };
  }

  async function verifiedContractor(): Promise<Session> {
    const c = await register('CONTRACTOR');
    await http().put('/api/v1/contractors/me/profile').set(auth(c.token)).send({ city: 'Faisalabad', categoryIds: [categoryId], yearsExperience: 3 }).expect(200);
    await http().post('/api/v1/contractors/me/submit-verification').set(auth(c.token)).expect(200);
    await http().post(`/api/v1/admin/contractors/${c.id}/verify`).set(auth(admin.token)).expect(200);
    return c;
  }

  const problemBody = (over: Record<string, unknown> = {}) => ({
    title: 'Leaking kitchen pipe',
    description: 'Water is leaking under the kitchen sink since this morning.',
    categoryId,
    city: 'faisalabad', // lowercase on purpose: city matching is case-insensitive
    urgency: 'TODAY',
    ...over,
  });

  async function postProblem(token: string, over: Record<string, unknown> = {}) {
    const res = await http().post('/api/v1/problems').set(auth(token)).send(problemBody(over)).expect(201);
    return res.body.data as { id: string };
  }

  async function sendQuote(token: string, problemId: string, price = 3500) {
    const res = await http()
      .post(`/api/v1/problems/${problemId}/quotes`)
      .set(auth(token))
      .send({ price, estimatedDurationHours: 3, message: 'Can come today' })
      .expect(201);
    return res.body.data as { id: string };
  }

  async function setupBooking() {
    const customer = await register('CUSTOMER');
    const contractor = await verifiedContractor();
    const problem = await postProblem(customer.token);
    const quote = await sendQuote(contractor.token, problem.id);
    const res = await http().post(`/api/v1/quotes/${quote.id}/accept`).set(auth(customer.token)).expect(201);
    return { customer, contractor, problem, quote, booking: res.body.data as { id: string } };
  }

  const advance = (token: string, bookingId: string, status: string) =>
    http().post(`/api/v1/bookings/${bookingId}/status`).set(auth(token)).send({ status });

  // ---------- accounts ----------
  it('BR-01: duplicate email or phone is rejected with 409 DUPLICATE_RESOURCE', async () => {
    const u = await register('CUSTOMER');
    expect(u.id).toBeDefined();
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: `u${seq}@e2e.test`, phone: '+923009999999', password: 'Passw0rd1', fullName: 'Dup', role: 'CUSTOMER' })
      .expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
  });

  it('D6: refresh tokens rotate and a reused token is refused', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: 'rot@e2e.test', phone: '+923008888888', password: 'Passw0rd1', fullName: 'Rotate', role: 'CUSTOMER' })
      .expect(201);
    const first = res.body.data.refreshToken as string;
    const second = await http().post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    expect(second.body.data.refreshToken).not.toBe(first);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(401); // reuse
    await http().post('/api/v1/auth/refresh').send({ refreshToken: second.body.data.refreshToken }).expect(401); // family revoked
  });

  // ---------- problems ----------
  it('BR-03: an unverified contractor cannot quote (403 CONTRACTOR_NOT_VERIFIED)', async () => {
    const customer = await register('CUSTOMER');
    const problem = await postProblem(customer.token);
    const c = await register('CONTRACTOR');
    await http().put('/api/v1/contractors/me/profile').set(auth(c.token)).send({ city: 'Faisalabad', categoryIds: [categoryId] }).expect(200);
    const res = await http()
      .post(`/api/v1/problems/${problem.id}/quotes`)
      .set(auth(c.token))
      .send({ price: 1000, estimatedDurationHours: 1 })
      .expect(403);
    expect(res.body.error.code).toBe('CONTRACTOR_NOT_VERIFIED');
  });

  it('BR-10: invalid problem fields return VALIDATION_ERROR', async () => {
    const customer = await register('CUSTOMER');
    const res = await http().post('/api/v1/problems').set(auth(customer.token)).send(problemBody({ title: 'abc', description: 'too short' })).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('BR-14/BR-15: edit only before quotes; cancel rejects pending quotes', async () => {
    const customer = await register('CUSTOMER');
    const contractor = await verifiedContractor();
    const problem = await postProblem(customer.token);
    await http().patch(`/api/v1/problems/${problem.id}`).set(auth(customer.token)).send({ title: 'Leaking bathroom pipe' }).expect(200);

    const quote = await sendQuote(contractor.token, problem.id);
    const res = await http().patch(`/api/v1/problems/${problem.id}`).set(auth(customer.token)).send({ title: 'Changed again' }).expect(409);
    expect(res.body.error.code).toBe('PROBLEM_HAS_QUOTES');

    await http().post(`/api/v1/problems/${problem.id}/cancel`).set(auth(customer.token)).expect(200);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe('REJECTED');
    const again = await http().post(`/api/v1/problems/${problem.id}/cancel`).set(auth(customer.token)).expect(409);
    expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('BR-11: type, size and count limits on images', async () => {
    const customer = await register('CUSTOMER');
    const problem = await postProblem(customer.token);
    const url = `/api/v1/problems/${problem.id}/media`;
    const png = Buffer.from('89504e470d0a1a0a', 'hex');

    const badType = await http().post(url).set(auth(customer.token)).attach('files', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' }).expect(415);
    expect(badType.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    const tooBig = await http().post(url).set(auth(customer.token)).attach('files', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' }).expect(413);
    expect(tooBig.body.error.code).toBe('FILE_TOO_LARGE');

    for (let i = 0; i < 5; i++) {
      await http().post(url).set(auth(customer.token)).attach('files', png, { filename: `p${i}.png`, contentType: 'image/png' }).expect(201);
    }
    const sixth = await http().post(url).set(auth(customer.token)).attach('files', png, { filename: 'p6.png', contentType: 'image/png' }).expect(400);
    expect(sixth.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('BR-13: open problems expire automatically and pending quotes are rejected', async () => {
    const customer = await register('CUSTOMER');
    const contractor = await verifiedContractor();
    const problem = await postProblem(customer.token);
    const quote = await sendQuote(contractor.token, problem.id);
    await prisma.problem.update({ where: { id: problem.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(await problems.expireStaleProblems()).toBeGreaterThanOrEqual(1);
    expect((await prisma.problem.findUniqueOrThrow({ where: { id: problem.id } })).status).toBe('EXPIRED');
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe('REJECTED');
    expect(await problems.expireStaleProblems()).toBe(0); // idempotent
  });

  // ---------- quotes ----------
  it('BR-20/BR-22: one quote per contractor, only in their category and city; feed matches', async () => {
    const customer = await register('CUSTOMER');
    const contractor = await verifiedContractor();
    const problem = await postProblem(customer.token);
    const elsewhere = await postProblem(customer.token, { city: 'Karachi' });

    const feed = await http().get('/api/v1/problems').set(auth(contractor.token)).expect(200);
    const ids = feed.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(problem.id);
    expect(ids).not.toContain(elsewhere.id);

    await sendQuote(contractor.token, problem.id);
    const dup = await http().post(`/api/v1/problems/${problem.id}/quotes`).set(auth(contractor.token)).send({ price: 900, estimatedDurationHours: 2 }).expect(409);
    expect(dup.body.error.code).toBe('DUPLICATE_RESOURCE');
    await http().post(`/api/v1/problems/${elsewhere.id}/quotes`).set(auth(contractor.token)).send({ price: 900, estimatedDurationHours: 2 }).expect(403);
  });

  it('BR-36: phone numbers are hidden until a booking exists', async () => {
    const customer = await register('CUSTOMER');
    const contractor = await verifiedContractor();
    const problem = await postProblem(customer.token);
    const quote = await sendQuote(contractor.token, problem.id);

    const quotes = await http().get(`/api/v1/problems/${problem.id}/quotes`).set(auth(customer.token)).expect(200);
    expect(JSON.stringify(quotes.body)).not.toContain('+92300');
    const asContractor = await http().get(`/api/v1/problems/${problem.id}`).set(auth(contractor.token)).expect(200);
    expect(JSON.stringify(asContractor.body)).not.toContain('+92300');

    const accepted = await http().post(`/api/v1/quotes/${quote.id}/accept`).set(auth(customer.token)).expect(201);
    const detail = await http().get(`/api/v1/bookings/${accepted.body.data.id}`).set(auth(contractor.token)).expect(200);
    expect(detail.body.data.customer.phone).toMatch(/^\+92300/);
  });

  it('BR-30: two simultaneous accepts on one problem create exactly ONE booking', async () => {
    const customer = await register('CUSTOMER');
    const [c1, c2] = [await verifiedContractor(), await verifiedContractor()];
    const problem = await postProblem(customer.token);
    const q1 = await sendQuote(c1.token, problem.id, 3000);
    const q2 = await sendQuote(c2.token, problem.id, 2800);

    const results = await Promise.all([
      http().post(`/api/v1/quotes/${q1.id}/accept`).set(auth(customer.token)),
      http().post(`/api/v1/quotes/${q2.id}/accept`).set(auth(customer.token)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.booking.count({ where: { problemId: problem.id } })).toBe(1);
    expect((await prisma.problem.findUniqueOrThrow({ where: { id: problem.id } })).status).toBe('BOOKED');
    expect(await prisma.quote.count({ where: { problemId: problem.id, status: 'ACCEPTED' } })).toBe(1);
  });

  // ---------- bookings ----------
  it('BR-31/BR-32/BR-33 + reviews: the whole happy path', async () => {
    const { customer, contractor, problem, quote, booking } = await setupBooking();

    const detail = await http().get(`/api/v1/bookings/${booking.id}`).set(auth(customer.token)).expect(200);
    expect(detail.body.data.agreedPrice).toBe(3500); // BR-31
    expect(detail.body.data.status).toBe('SCHEDULED');
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe('ACCEPTED');

    // invalid or wrong-actor moves
    const skip = await advance(contractor.token, booking.id, 'IN_PROGRESS');
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect((await advance(customer.token, booking.id, 'ON_THE_WAY')).status).toBe(403); // roles guard

    // BR-32: contractor moves it forward
    for (const s of ['ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_CONFIRMATION']) {
      expect((await advance(contractor.token, booking.id, s)).status).toBe(200);
    }
    // review before completion is refused
    const early = await http().post(`/api/v1/bookings/${booking.id}/review`).set(auth(customer.token)).send({ rating: 5 }).expect(409);
    expect(early.body.error.code).toBe('BOOKING_NOT_COMPLETED');

    await http().post(`/api/v1/bookings/${booking.id}/mark-paid`).set(auth(contractor.token)).expect(200);
    await http().post(`/api/v1/bookings/${booking.id}/confirm`).set(auth(contractor.token)).expect(403); // BR-33
    const done = await http().post(`/api/v1/bookings/${booking.id}/confirm`).set(auth(customer.token)).expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.paymentStatus).toBe('PAID');
    expect(done.body.data.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED',
    ]);
    expect((await prisma.problem.findUniqueOrThrow({ where: { id: problem.id } })).status).toBe('COMPLETED');

    // BR-40/BR-41/BR-42: review once; rating aggregates
    await http().post(`/api/v1/bookings/${booking.id}/review`).set(auth(customer.token)).send({ rating: 6 }).expect(400);
    const review = await http().post(`/api/v1/bookings/${booking.id}/review`).set(auth(customer.token)).send({ rating: 4, comment: 'Quick and tidy' }).expect(201);
    await http().post(`/api/v1/bookings/${booking.id}/review`).set(auth(customer.token)).send({ rating: 5 }).expect(409);
    let profile = await prisma.contractorProfile.findUniqueOrThrow({ where: { userId: contractor.id } });
    expect(Number(profile.avgRating)).toBe(4);
    expect(profile.reviewCount).toBe(1);
    expect(profile.completedJobs).toBe(1);

    // BR-43: edit within 48h, locked after
    await http().patch(`/api/v1/reviews/${review.body.data.id}`).set(auth(customer.token)).send({ rating: 5 }).expect(200);
    profile = await prisma.contractorProfile.findUniqueOrThrow({ where: { userId: contractor.id } });
    expect(Number(profile.avgRating)).toBe(5);
    await prisma.review.update({ where: { id: review.body.data.id }, data: { createdAt: new Date(Date.now() - 49 * 3600 * 1000) } });
    const locked = await http().patch(`/api/v1/reviews/${review.body.data.id}`).set(auth(customer.token)).send({ rating: 1 }).expect(409);
    expect(locked.body.error.code).toBe('REVIEW_LOCKED');

    // admin removes the review; rating recalculates
    await http().delete(`/api/v1/admin/reviews/${review.body.data.id}`).set(auth(admin.token)).expect(200);
    profile = await prisma.contractorProfile.findUniqueOrThrow({ where: { userId: contractor.id } });
    expect(profile.reviewCount).toBe(0);
    expect(Number(profile.avgRating)).toBe(0);
  });

  it('BR-35: cancellation rules and the contractor reliability counter', async () => {
    const { customer, contractor, problem, booking } = await setupBooking();
    await advance(contractor.token, booking.id, 'ON_THE_WAY').expect(200);
    // customer cannot cancel once the contractor is on the way
    await http().post(`/api/v1/bookings/${booking.id}/cancel`).set(auth(customer.token)).send({ reason: 'Changed my mind' }).expect(403);
    // contractor can
    await http().post(`/api/v1/bookings/${booking.id}/cancel`).set(auth(contractor.token)).send({ reason: 'Vehicle broke down' }).expect(200);
    const profile = await prisma.contractorProfile.findUniqueOrThrow({ where: { userId: contractor.id } });
    expect(profile.cancelledJobs).toBe(1);
    expect((await prisma.problem.findUniqueOrThrow({ where: { id: problem.id } })).status).toBe('CANCELLED');
  });

  it('BR-34: bookings auto-complete after 72h without a response', async () => {
    const { contractor, booking } = await setupBooking();
    for (const s of ['ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_CONFIRMATION']) await advance(contractor.token, booking.id, s).expect(200);
    expect(await bookings.autoCompleteDue()).toBe(0); // too early

    await prisma.statusHistory.updateMany({
      where: { entityId: booking.id, toStatus: 'AWAITING_CONFIRMATION' },
      data: { createdAt: new Date(Date.now() - 73 * 3600 * 1000) },
    });
    expect(await bookings.autoCompleteDue()).toBeGreaterThanOrEqual(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('COMPLETED');
  });

  // ---------- permissions ----------
  it('ownership: other customers and contractors cannot read or touch someone else\'s resources', async () => {
    const { customer, problem, quote, booking } = await setupBooking();
    const stranger = await register('CUSTOMER');
    const otherContractor = await verifiedContractor();
    await http().get(`/api/v1/problems/${problem.id}`).set(auth(stranger.token)).expect(403);
    await http().post(`/api/v1/problems/${problem.id}/cancel`).set(auth(stranger.token)).expect(403);
    await http().get(`/api/v1/bookings/${booking.id}`).set(auth(stranger.token)).expect(403);
    await http().get(`/api/v1/bookings/${booking.id}`).set(auth(otherContractor.token)).expect(403);
    await http().post(`/api/v1/quotes/${quote.id}/withdraw`).set(auth(otherContractor.token)).expect(403);
    await http().get(`/api/v1/bookings/${booking.id}`).set(auth(customer.token)).expect(200);
    await http().get(`/api/v1/bookings/${booking.id}`).set(auth(admin.token)).expect(200);
  });

  it('admin queue: pending contractors can be rejected with a reason, then resubmit', async () => {
    const c = await register('CONTRACTOR');
    await http().put('/api/v1/contractors/me/profile').set(auth(c.token)).send({ city: 'Lahore', categoryIds: [categoryId] }).expect(200);
    await http().post('/api/v1/contractors/me/submit-verification').set(auth(c.token)).expect(200);

    const queue = await http().get('/api/v1/admin/contractors?status=PENDING').set(auth(admin.token)).expect(200);
    expect(queue.body.data.some((p: { userId: string }) => p.userId === c.id)).toBe(true);

    await http().post(`/api/v1/admin/contractors/${c.id}/reject`).set(auth(admin.token)).send({}).expect(400); // reason required
    await http().post(`/api/v1/admin/contractors/${c.id}/reject`).set(auth(admin.token)).send({ reason: 'ID photo is unreadable' }).expect(200);
    await http().post(`/api/v1/admin/contractors/${c.id}/verify`).set(auth(admin.token)).expect(409); // no longer pending
    await http().post('/api/v1/contractors/me/submit-verification').set(auth(c.token)).expect(200); // resubmit
  });
});
