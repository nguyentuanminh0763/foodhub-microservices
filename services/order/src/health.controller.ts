import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from './prisma.service';

@Controller('orders')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/orders/health
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const base = { service: 'order', uptimeSeconds: Math.round(process.uptime()) };

    try {
      // SELECT 1, not a count: health answers "is the connection alive", not
      // "has a migration run".
      await this.prisma.$queryRaw`SELECT 1`;
      return { ...base, status: 'ok', database: 'up' };
    } catch {
      // 503 so compose healthchecks and the gateway can route on the code.
      res.status(503);
      return { ...base, status: 'degraded', database: 'down' };
    }
  }
}
