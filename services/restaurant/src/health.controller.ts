import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from './prisma.service';

@Controller('restaurants')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/restaurants/health
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const base = { service: 'restaurant', uptimeSeconds: Math.round(process.uptime()) };

    try {
      // SELECT 1, not a count on `restaurants`: a health check should report
      // whether the connection is alive, not whether a migration has run. A
      // query against a real table would fail on an empty-but-healthy database.
      await this.prisma.$queryRaw`SELECT 1`;
      return { ...base, status: 'ok', database: 'up' };
    } catch {
      // 503, not 200-with-a-sad-field: this endpoint is read by machines —
      // compose healthchecks, the gateway, later a readiness probe. They route
      // on the status code and never open the body.
      res.status(503);
      return { ...base, status: 'degraded', database: 'down' };
    }
  }
}
