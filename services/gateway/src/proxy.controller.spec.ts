import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';

// Every assertion here goes over a real socket: a real Nest app on a real port,
// talking to a real upstream on another one. Nothing is mocked, because the
// thing under test IS the network behaviour — a mocked fetch would prove only
// that the mock was configured the way the test expected.

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
    // Slower than the gateway's patience, on purpose: this is the 504 case.
    if (req.url?.includes('/slow')) {
      setTimeout(() => res.end('too late'), TIMEOUT_MS * 3);
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

  // A port that was real for a moment and then stopped being real. Connecting
  // here gets ECONNREFUSED immediately — the 503 case, without a 5s wait.
  const corpse = createServer();
  const deadPort = await listen(corpse);
  await close(corpse);

  // The routing table is built from process.env when proxy.controller is first
  // loaded, so env must be set BEFORE the import below. That is why AppModule is
  // imported dynamically: a normal top-level import would freeze the defaults
  // (localhost:3001/3002) into the table and every test would hit the wrong port.
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
    // originalUrl, not the matched route: the downstream service must see
    // exactly what the client asked for, query string included.
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
    // On an object literal, TARGETS['constructor'] resolves up the prototype
    // chain to Object.prototype.constructor: a truthy value, so the guard would
    // pass and fetch would be handed a function where a URL belongs.
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
  // The distinction the gateway breakage exercise in CLAUDE.md is about:
  // nobody answered vs answered too late. Different causes, different fixes.
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
