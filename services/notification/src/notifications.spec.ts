import { randomUUID } from 'node:crypto';
import { EventBus } from './event-bus';
import { NotificationsService } from './notifications.service';

it('stores one notification when the same Kafka event is delivered concurrently', async () => {
  const id = randomUUID();
  const userId = `test-${id}`;
  const service = new NotificationsService(new EventBus());
  try {
    await service.redis.ping();
    const event = { eventId: id, version: 1 as const, type: 'order.created', data: { orderId: 123, userId } };
    await Promise.all(Array.from({ length: 20 }, () => service.record(event)));
    const inbox = await service.list(userId, false);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].id).toBe(id);
    await service.redis.zrem('notification:admin', JSON.stringify(inbox[0]));
  } finally {
    await service.redis.del(`notification:seen:${id}`, `notification:user:${userId}`);
    service.onModuleDestroy();
  }
});
