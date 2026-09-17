import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { DomainEvent, EventBus } from './event-bus';

const retain = 7 * 24 * 60 * 60;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  readonly redis: Redis;
  constructor(private readonly bus: EventBus) {
    if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required');
    this.redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    this.redis.on('error', () => {});
  }
  async onModuleInit() {
    await this.redis.ping();
    await this.bus.start('notifications', ['order.created', 'payment.succeeded', 'payment.failed', 'order.confirmed', 'order.ready', 'order.cancelled'], event => this.record(event));
  }
  onModuleDestroy() { this.redis.disconnect(); }

  async record(event: DomainEvent) {
    const now = Date.now();
    const notification = JSON.stringify({ id: event.eventId, type: event.type, ...event.data, createdAt: new Date(now).toISOString() });
    // Dedupe and append are one Redis operation: a crash cannot leave the
    // marker set while the notification itself was never stored.
    await this.redis.eval(`
      if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
      redis.call('SET', KEYS[1], '1', 'EX', ARGV[3])
      for i=2,3 do
        redis.call('ZADD', KEYS[i], ARGV[1], ARGV[2])
        redis.call('ZREMRANGEBYRANK', KEYS[i], 0, -101)
        redis.call('EXPIRE', KEYS[i], ARGV[3])
      end
      return 1`, 3, `notification:seen:${event.eventId}`, `notification:user:${event.data.userId}`, 'notification:admin', now, notification, retain);
  }

  async list(userId: string, admin: boolean) {
    const rows = await this.redis.zrevrange(admin ? 'notification:admin' : `notification:user:${userId}`, 0, 99);
    return rows.map(row => JSON.parse(row));
  }
}
