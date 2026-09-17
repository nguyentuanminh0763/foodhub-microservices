import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Consumer, Kafka, logLevel, Producer } from 'kafkajs';

export interface DomainEvent {
  eventId: string; version: 1; type: string;
  data: { orderId: number; userId: string; restaurantId?: number; totalVnd?: number; paymentMethod?: string; reason?: string };
}

const topics = ['order.created', 'payment.succeeded', 'payment.failed', 'order.confirmed', 'order.ready', 'order.cancelled'];

@Injectable()
export class EventBus implements OnModuleDestroy {
  private producer?: Producer;
  private consumer?: Consumer;
  ready = false;
  private readonly logger = new Logger(EventBus.name);

  async start(groupId: string, subscriptions: string[], handle: (event: DomainEvent) => Promise<void>) {
    if (!process.env.KAFKA_BROKERS && process.env.NODE_ENV === 'test') return;
    if (!process.env.KAFKA_BROKERS) throw new Error('KAFKA_BROKERS is required');
    const kafka = new Kafka({ clientId: groupId, brokers: process.env.KAFKA_BROKERS.split(','), logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 10 } });
    const admin = kafka.admin();
    await admin.connect();
    try { await admin.createTopics({ waitForLeaders: true, topics: topics.map(topic => ({ topic, numPartitions: 3, replicationFactor: 1 })) }); }
    finally { await admin.disconnect(); }
    this.producer = kafka.producer({ allowAutoTopicCreation: false });
    await this.producer.connect();
    this.consumer = kafka.consumer({ groupId, allowAutoTopicCreation: false });
    this.consumer.on(this.consumer.events.CRASH, () => { this.ready = false; });
    this.consumer.on(this.consumer.events.GROUP_JOIN, () => { this.ready = true; });
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: subscriptions, fromBeginning: true });
    await this.consumer.run({ eachMessage: async ({ topic, message }) => {
      // Do not commit a failed handler: Kafka will redeliver. Invalid external
      // records are logged and skipped, while infrastructure failures are retried.
      let event: DomainEvent;
      try {
        event = JSON.parse(message.value?.toString() ?? '');
        if (event.version !== 1 || event.type !== topic || typeof event.eventId !== 'string' ||
            !Number.isSafeInteger(event.data?.orderId) || event.data.orderId < 1 || typeof event.data.userId !== 'string') throw new Error();
        if (topic === 'order.created' && (!Number.isSafeInteger(event.data.totalVnd) || event.data.totalVnd! < 0 ||
            !['demo_success', 'demo_failure'].includes(event.data.paymentMethod ?? ''))) throw new Error();
      } catch { this.logger.error('Invalid event rejected on ' + topic); return; }
      await handle(event);
    } });
    this.ready = true;
  }

  async publish(id: string, topic: string, key: string, data: unknown) {
    if (!this.producer) throw new Error('Kafka producer unavailable');
    await this.producer.send({ topic, messages: [{ key, value: JSON.stringify({ eventId: id, version: 1, type: topic, data }) }] });
  }

  async onModuleDestroy() {
    this.ready = false;
    await this.consumer?.disconnect();
    await this.producer?.disconnect();
  }
}

