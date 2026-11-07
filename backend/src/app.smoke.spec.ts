/**
 * Smoke test: boots the REAL app module (DI, guards, pipes, filters, interceptors, routes)
 * with the database mocked out. It catches wiring mistakes in seconds, with no Postgres.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://x:x@localhost:5432/services_test';
process.env.JWT_ACCESS_SECRET = 'smoke-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'smoke-refresh-secret-0123456789abcdef';

import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const CONTRACTOR_ID = '22222222-2222-4222-8222-222222222222';

describe('API smoke (database mocked)', () => {
  let app: NestExpressApplication;
  let jwt: JwtService;
  const users = new Map<string, { id: string; role: string; email: string }>([
    [CUSTOMER_ID, { id: CUSTOMER_ID, role: 'CUSTOMER', email: 'c@test.dev' }],
    [CONTRACTOR_ID, { id: CONTRACTOR_ID, role: 'CONTRACTOR', email: 'w@test.dev' }],
  ]);
  const prismaMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
    user: { findFirst: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve(users.get(where.id) ?? null)) },
    category: { findMany: jest.fn().mockResolvedValue([{ id: 'x', name: 'Plumbing', slug: 'plumbing', parentId: null }]) },
    contractorProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    chatMessage: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  };
  const tokenFor = (id: string) =>
    jwt.signAsync({ sub: id }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 300 });

  beforeAll(async () => {
    const { AppModule } = await import('./app.module');
    const { PrismaService } = await import('./prisma/prisma.service');
    const { configureApp } = await import('./app.setup');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health -> 200 when the database answers', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok', db: 'up' } });
  });

  it('GET /health -> 503 in the standard error shape when the database is down', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error).toHaveProperty('details');
  });

  it('every response carries a request id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/categories is public and wrapped as { data }', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(res.body.data[0].slug).toBe('plumbing');
  });

  it('protected routes return 401 UNAUTHORIZED without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token', details: [] } });
  });

  it('unknown routes return 404 NOT_FOUND in the standard shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('BR-02: weak passwords fail with VALIDATION_ERROR and per-field details', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', phone: '123', password: 'short', fullName: 'A', role: 'ADMIN' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'phone', 'password', 'fullName', 'role']));
  });

  it('nobody can register as ADMIN, and unknown fields are rejected', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.co', phone: '+923001234567', password: 'Passw0rdOK', fullName: 'Ali', role: 'ADMIN', isActive: true })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('pagination limit is capped at 50', async () => {
    const token = await tokenFor(CUSTOMER_ID);
    const res = await request(app.getHttpServer())
      .get('/api/v1/problems?limit=999')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a customer token cannot use admin-only routes (403 FORBIDDEN)', async () => {
    const token = await tokenFor(CUSTOMER_ID);
    const res = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Roofing' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('a contractor cannot post problems (403 FORBIDDEN)', async () => {
    const token = await tokenFor(CONTRACTOR_ID);
    await request(app.getHttpServer()).post('/api/v1/problems').set('Authorization', `Bearer ${token}`).send({}).expect(403);
  });

  it('an unverified contractor gets 403 CONTRACTOR_NOT_VERIFIED on the problem feed', async () => {
    const token = await tokenFor(CONTRACTOR_ID);
    const res = await request(app.getHttpServer()).get('/api/v1/problems').set('Authorization', `Bearer ${token}`).expect(403);
    expect(res.body.error.code).toBe('CONTRACTOR_NOT_VERIFIED');
  });

  it('a token for a deleted or deactivated user is rejected', async () => {
    const ghost = '33333333-3333-4333-8333-333333333333';
    const token = await tokenFor(ghost);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('notifications endpoint requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
  });

  it('GET /api/v1/notifications/unread-count returns unread count for user', async () => {
    const token = await tokenFor(CUSTOMER_ID);
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ data: { unreadCount: 0 } });
  });

  it('POST /api/v1/bookings/:id/messages rejects invalid UUID for booking', async () => {
    const token = await tokenFor(CUSTOMER_ID);
    await request(app.getHttpServer())
      .post('/api/v1/bookings/not-a-uuid/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello' })
      .expect(400);
  });
});
