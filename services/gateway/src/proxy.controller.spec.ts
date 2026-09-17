import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';

// Nothing mocked: real Nest app, real upstream, real sockets. The network
// behaviour is what is under test.

const TIMEOUT_MS = 200;

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: Server): Promise<void> {
  server.closeAllConnections(); // the /slow handler still holds one open
  return new Promise((resolve) => server.close(() => resolve()));
}

let app: INestApplication;
let upstream: Server;
let base: string;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    if (req.url?.includes('/slow')) {
      setTimeout(() => res.end('too late'), TIMEOUT_MS * 3); // the 504 case
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ service: 'restaurant', method: req.method, url: req.url, body }));
    });
  });
  const upstreamPort = await listen(upstream);

  // Opened then closed: ECONNREFUSED immediately, no 5s wait. The 503 case.
  const corpse = createServer();
  const deadPort = await listen(corpse);
  await close(corpse);

  // TARGETS is built from process.env at import time, so env must be set before
  // the import. A top-level one would freeze localhost:3001 into the table.
  process.env.RESTAURANT_SERVICE_URL = `http://127.0.0.1:${upstreamPort}`;
  process.env.ORDER_SERVICE_URL = `http://127.0.0.1:${deadPort}`;
  process.env.PROXY_TIMEOUT_MS = String(TIMEOUT_MS);

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api'); // main.ts does this; without it every path 404s
  await app.listen(0);
  base = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await close(upstream);
});

describe('routing', () => {
  it('forwards a known service to its upstream, path and query intact', async () => {
    const res = await fetch(`${base}/api/restaurants/health?verbose=1`);

    expect(res.status).toBe(200);
    // originalUrl, not the matched route: the query string must survive the hop.
    expect(await res.json()).toMatchObject({
      service: 'restaurant',
      url: '/api/restaurants/health?verbose=1',
    });
  });

  it('404s an unknown service, without opening a socket', async () => {
    const res = await fetch(`${base}/api/drivers/health`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Unknown service 'drivers'" });
  });

  it("404s 'constructor' — the whole reason TARGETS is a Map", async () => {
    // On an object literal this resolves to Object.prototype.constructor:
    // truthy, so the guard passes and fetch is handed a function.
    const res = await fetch(`${base}/api/constructor/health`);

    expect(res.status).toBe(404);
  });

  it('forwards method and body on a write', async () => {
    const res = await fetch(`${base}/api/restaurants/dishes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Pho' }),
    });

    expect(await res.json()).toMatchObject({ method: 'POST', body: '{"name":"Pho"}' });
  });
});

describe('upstream failure', () => {
  // Nobody answered vs answered too late: different causes, different fixes.
  it('503s when nothing is listening', async () => {
    const res = await fetch(`${base}/api/orders/health`);

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'Upstream unreachable', service: 'orders' });
  });

  it('504s when the upstream answers too slowly', async () => {
    const res = await fetch(`${base}/api/restaurants/slow`);

    expect(res.status).toBe(504);
    expect(await res.json()).toMatchObject({ error: 'Upstream timed out' });
  });

  it('contains the blast radius to the broken route', async () => {
    // orders is down for the whole file; restaurants must not notice.
    const [down, ok] = await Promise.all([
      fetch(`${base}/api/orders/health`),
      fetch(`${base}/api/restaurants/health`),
    ]);

    expect([down.status, ok.status]).toEqual([503, 200]);
  });
});
