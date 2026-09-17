import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

let app: INestApplication;
let upstream: Server;
let base: string;
const secret = 'gateway-test-secret-longer-than-thirty-two-characters';

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.INTERNAL_TOKEN = 'internal-test-token';
  process.env.DEMO_CUSTOMER_PASSWORD = 'test-customer-password';
  process.env.DEMO_ADMIN_PASSWORD = 'test-admin-password';
  // Rate limiting is covered by the Redis-backed full-system checks.
  delete process.env.REDIS_URL;
  upstream = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ userId: req.headers['x-user-id'], role: req.headers['x-user-role'], key: req.headers['idempotency-key'] }));
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  process.env.ORDER_SERVICE_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  const { AppModule } = await import('./app.module');
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0);
  base = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
  upstream?.closeAllConnections();
  await new Promise<void>(resolve => upstream?.close(() => resolve()));
});

it('does not grant access for missing or expired tokens', async () => {
  expect((await fetch(`${base}/api/orders`)).status).toBe(401);
  const token = new JwtService().sign({ sub: 'customer', role: 'customer' }, { secret, expiresIn: -1, issuer: 'foodhub', audience: 'foodhub-api' });
  expect((await fetch(`${base}/api/orders`, { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
});

it('derives identity from the signed token and replaces spoofed headers', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'customer', password: 'test-customer-password' }) });
  expect(login.status).toBe(200);
  const { accessToken } = await login.json() as { accessToken: string };
  const response = await fetch(`${base}/api/orders`, { method: 'POST', headers: {
    'content-type': 'application/json', authorization: `Bearer ${accessToken}`, 'x-user-id': 'admin', 'x-user-role': 'admin', 'idempotency-key': 'retry-test-123',
  }, body: '{}' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ userId: 'customer', role: 'customer', key: 'retry-test-123' });
});

it('rejects a role supplied in the login body', async () => {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'customer', password: 'test-customer-password', role: 'admin' }) });
  expect(response.status).toBe(400);
});
