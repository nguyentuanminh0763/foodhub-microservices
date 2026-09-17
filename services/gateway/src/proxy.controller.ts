import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

// A Map, not an object literal: TARGETS['constructor'] on a literal resolves to
// Object.prototype.constructor and the guard below would wave it through.
const TARGETS = new Map<string, string>([
  ['restaurants', process.env.RESTAURANT_SERVICE_URL ?? 'http://localhost:3001'],
  ['orders', process.env.ORDER_SERVICE_URL ?? 'http://localhost:3002'],
]);

const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? 5000);

@Controller()
export class ProxyController {
  // Express 5 rejects a bare '*' — the wildcard must be named. Trap #2.
  @All(':service/*rest')
  async proxy(@Req() req: Request, @Res() res: Response) {
    // Express 5 types a param as string | string[] because of wildcards.
    const service = String(req.params.service);
    const target = TARGETS.get(service);
    if (!target) {
      res.status(404).json({ error: `Unknown service '${service}'` });
      return;
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

    try {
      // originalUrl, not the matched route: the downstream service sees exactly
      // what the client asked for, query string included.
      const upstream = await fetch(target + req.originalUrl, {
        method: req.method,
        headers: hasBody ? { 'content-type': 'application/json' } : undefined,
        body: hasBody ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
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
        target,
      });
    }
  }
}
