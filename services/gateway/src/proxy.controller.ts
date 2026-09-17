import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

// A Map, not an object literal: TARGETS['constructor'] on a literal resolves to
// Object.prototype.constructor and the guard below would wave it through.
const targets = () => new Map<string, string>([
  ['restaurants', process.env.RESTAURANT_SERVICE_URL ?? 'http://localhost:3001'],
  ['orders', process.env.ORDER_SERVICE_URL ?? 'http://localhost:3002'],
  ['payments', process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3003'],
  ['notifications', process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3004'],
]);

@Controller()
export class ProxyController {
  // Express 5 rejects a bare '*' — the wildcard must be named. Trap #2.
  @All([':service', ':service/*rest'])
  async proxy(@Req() req: Request, @Res() res: Response) {
    // Express 5 types a param as string | string[] because of wildcards.
    const service = String(req.params.service);
    const target = targets().get(service);
    if (!target) {
      res.status(404).json({ error: `Unknown service '${service}'` });
      return;
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const url = new URL(target + req.originalUrl);
    const prefix = `/api/${service}`;
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) {
      res.status(400).json({ error: 'Invalid upstream path' });
      return;
    }

    try {
      // originalUrl, not the matched route: the downstream service sees exactly
      // what the client asked for, query string included.
      const upstream = await fetch(url, {
        method: req.method,
        headers: {
          'content-type': 'application/json',
          'x-internal-token': process.env.INTERNAL_TOKEN ?? '',
          'x-user-id': res.locals.user?.sub ?? '',
          'x-user-role': res.locals.user?.role ?? '',
          ...(typeof req.headers['idempotency-key'] === 'string' ? { 'idempotency-key': req.headers['idempotency-key'] } : {}),
        },
        redirect: 'manual',
        body: hasBody ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(Number(process.env.PROXY_TIMEOUT_MS ?? 10000)),
      });

      res
        .status(upstream.status)
        .set('content-type', upstream.headers.get('content-type') ?? 'application/json')
        .send(await upstream.text());
    } catch (err) {
      // 503 nobody answered, 504 answered too late. Different causes, different
      // fixes, so different codes.
      const timedOut = (err as Error)?.name === 'TimeoutError';
      res.status(timedOut ? 504 : 503).json({
        error: timedOut ? 'Upstream timed out' : 'Upstream unreachable',
        service,
      });
    }
  }
}
