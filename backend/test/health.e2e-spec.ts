import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /api/health → ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status_code).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual({ status: 'ok' });
  });

  it('GET /api/health/ready → ready when the database is reachable', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    expect(res.body.data).toEqual({ status: 'ready', db: 'up' });
  });

  it('health is version-neutral — /api/v1/health is not exposed', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(404);
  });
});
