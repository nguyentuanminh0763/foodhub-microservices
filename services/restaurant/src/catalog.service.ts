import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DishDto, ReserveDto, UpdateDishDto } from './catalog.dto';

export interface PricedItem { dishId: number; dishName: string; priceVnd: number; quantity: number }

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(skip = 0) {
    return this.prisma.restaurant.findMany({ skip, take: 50, orderBy: { id: 'asc' } });
  }

  async get(id: number) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id }, include: { dishes: { orderBy: { id: 'asc' } } } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  create(name: string) { return this.prisma.restaurant.create({ data: { name: name.trim() } }); }

  async update(id: number, name: string) {
    await this.get(id);
    return this.prisma.restaurant.update({ where: { id }, data: { name: name.trim() } });
  }

  async remove(id: number) {
    await this.get(id);
    return this.prisma.restaurant.delete({ where: { id } });
  }

  async addDish(restaurantId: number, data: DishDto) {
    await this.get(restaurantId);
    return this.prisma.dish.create({ data: { ...data, restaurantId } });
  }

  async updateDish(restaurantId: number, id: number, data: UpdateDishDto) {
    const result = await this.prisma.dish.updateMany({ where: { id, restaurantId }, data });
    if (!result.count) throw new NotFoundException('Dish not found');
    return this.prisma.dish.findUnique({ where: { id } });
  }

  async removeDish(restaurantId: number, id: number) {
    const result = await this.prisma.dish.deleteMany({ where: { id, restaurantId } });
    if (!result.count) throw new NotFoundException('Dish not found');
    return { deleted: true };
  }

  async reserve(id: string, input: ReserveDto) {
    const items = input.items.map(i => ({ dishId: i.dishId, quantity: i.quantity })).sort((a, b) => a.dishId - b.dishId);
    if (new Set(items.map(i => i.dishId)).size !== items.length) throw new BadRequestException('Duplicate dish');
    const request = { restaurantId: input.restaurantId, items };
    return this.prisma.$transaction(async tx => {
      // Per-reservation lock: a timed-out request and its retry may overlap.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
      const previous = await tx.reservation.findUnique({ where: { id } });
      if (previous) {
        const old = previous.request as unknown as ReserveDto;
        if (old.restaurantId !== request.restaurantId || old.items.length !== items.length ||
            old.items.some((i, n) => i.dishId !== items[n].dishId || i.quantity !== items[n].quantity)) {
          throw new ConflictException('Reservation key was already used');
        }
        if (previous.released) throw new ConflictException('Reservation already released');
        return previous.items;
      }
      const priced: PricedItem[] = [];
      for (const item of items) {
        // Conditional UPDATE takes a row lock in Postgres. Even across replicas,
        // exactly one buyer can decrement the last portion.
        const result = await tx.dish.updateMany({
          where: { id: item.dishId, restaurantId: input.restaurantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (!result.count) throw new ConflictException(`Dish ${item.dishId} is unavailable or out of stock`);
        const dish = await tx.dish.findUniqueOrThrow({ where: { id: item.dishId } });
        priced.push({ ...item, dishName: dish.name, priceVnd: dish.priceVnd });
      }
      if (priced.reduce((sum, i) => sum + i.priceVnd * i.quantity, 0) > 2_000_000_000) {
        throw new BadRequestException('Order total is too large');
      }
      await tx.reservation.create({ data: { id, restaurantId: input.restaurantId, request, items: JSON.parse(JSON.stringify(priced)) } });
      return priced;
    }, { timeout: 15000 });
  }

  async release(id: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation || reservation.released) return;
      for (const item of reservation.items as unknown as PricedItem[]) {
        await tx.dish.updateMany({ where: { id: item.dishId }, data: { stock: { increment: item.quantity } } });
      }
      await tx.reservation.update({ where: { id }, data: { released: true } });
    });
  }
}
