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
      // SELECT 1, not a count: health answers "is the connection alive", not
      // "has a migration run". A count fails on an empty-but-healthy database.
      await this.prisma.$queryRaw`SELECT 1`;
      return { ...base, status: 'ok', database: 'up' };
    } catch {
      // 503, not 200 with a sad field: compose healthchecks, the gateway and
      // later a readiness probe route on the status code and never read the body.
      res.status(503);
      return { ...base, status: 'degraded', database: 'down' };
    }
  }
}
