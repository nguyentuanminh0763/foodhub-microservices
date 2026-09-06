import { Controller, Get } from '@nestjs/common';

@Controller('orders')
export class HealthController {
  // GET /api/orders/health
  @Get('health')
  health() {
    return {
      service: 'order',
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
