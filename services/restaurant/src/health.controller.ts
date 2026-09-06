import { Controller, Get } from '@nestjs/common';

@Controller('restaurants')
export class HealthController {
  // GET /api/restaurants/health
  @Get('health')
  health() {
    return {
      service: 'restaurant',
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
