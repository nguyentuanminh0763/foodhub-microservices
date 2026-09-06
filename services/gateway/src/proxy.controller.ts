import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

// The gateway is a dumb proxy: it knows service names, not what an order is.
// A Map, not an object literal, so a request for /api/constructor/... cannot
// resolve to Object.prototype.constructor.
const TARGETS = new Map<string, string>([
  ['restaurants', process.env.RESTAURANT_SERVICE_URL ?? 'http://localhost:3001'],
  ['orders', process.env.ORDER_SERVICE_URL ?? 'http://localhost:3002'],
]);

const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? 5000);

@Controller()
export class ProxyController {
  // Express 5 (NestJS 11) rejects a bare '*' — the wildcard must be named.
  // See CLAUDE_RULES.md trap #2.
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
      // originalUrl keeps the full path and query string, so the downstream
      // service sees exactly what the client asked for.
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
      // 503: nobody answered — the service is down or the name does not resolve.
      // 504: it answered too slowly. Different causes, different fixes, so
      // different status codes. (Gateway breakage exercise in CLAUDE.md.)
      const timedOut = (err as Error)?.name === 'TimeoutError';
      res.status(timedOut ? 504 : 503).json({
        error: timedOut ? 'Upstream timed out' : 'Upstream unreachable',
        service,
        target,
      });
    }
  }
}
