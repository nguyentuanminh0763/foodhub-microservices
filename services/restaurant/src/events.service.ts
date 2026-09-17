import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from './event-bus';
import { CatalogService } from './catalog.service';

@Injectable()
export class EventsService implements OnModuleInit {
  constructor(private readonly bus: EventBus, private readonly catalog: CatalogService) {}
  async onModuleInit() {
    await this.bus.start('restaurant-stock', ['order.cancelled'], async event => {
      await this.catalog.release(String(event.data.orderId));
    });
  }
}
