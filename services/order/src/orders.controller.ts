import { BadRequestException, Body, Controller, DefaultValuePipe, ForbiddenException, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto, TransitionDto } from './orders.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  private user(req: Request) {
    const id = req.headers['x-user-id'];
    if (typeof id !== 'string' || !id) throw new UnauthorizedException();
    return id;
  }
  @Get() list(@Req() req: Request, @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number) {
    if (offset < 0) throw new BadRequestException('offset must be nonnegative');
    return this.orders.list(this.user(req), req.headers['x-user-role'] === 'admin', offset);
  }
  @Get(':id') get(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.orders.get(id, this.user(req), req.headers['x-user-role'] === 'admin');
  }
  @Post() create(@Req() req: Request, @Headers('idempotency-key') key: string, @Body() body: CreateOrderDto) {
    return this.orders.create(this.user(req), key ?? '', body);
  }
  @Patch(':id/status') transition(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() body: TransitionDto) {
    if (req.headers['x-user-role'] !== 'admin') throw new ForbiddenException('Administrator access required');
    return this.orders.transition(id, body.status);
  }
}
