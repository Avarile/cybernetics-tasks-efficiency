import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import env from '../src/utils/env';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use(cookieParser());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('login returns an access token and sets the refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: env.ADMIN_ACCOUNT, password: env.ADMIN_ACCOUNT_PASSWORD })
      .expect(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.role).toBe('admin');
    const setCookie = res.headers['set-cookie'][0];
    expect(setCookie).toContain(env.REFRESH_COOKIE_NAME);
    accessToken = res.body.data.accessToken;
    refreshCookie = setCookie;
  });

  it('GET /api/v1/auth/me returns the current user with a valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.email).toBe(env.ADMIN_ACCOUNT);
  });

  it('rejects protected routes without a token (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('removed POST /api/v1/auth/register returns 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'x', email: 'x@y.com', password: 'password1' })
      .expect(404);
  });

  it('refresh rotates the token using the cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
  });

  it('admin can create a member; created user can log in and is forbidden from creating objectives', async () => {
    const email = `member_${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/persons')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Member', email, password: 'password123', role: 'member' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    const memberToken = login.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/objectives')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'X', ownerPersonId: 1, scope: 'team', period: '2026-Q3' })
      .expect(403);
  });
});
