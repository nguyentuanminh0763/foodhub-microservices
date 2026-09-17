import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, DefaultValuePipe, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { CatalogService } from './catalog.service';
import { DishDto, ReserveDto, RestaurantDto, UpdateDishDto } from './catalog.dto';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller('restaurants')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  private admin(req: Request) {
    if (req.headers['x-user-role'] !== 'admin') throw new ForbiddenException('Administrator access required');
  }

  @Get()
  list(@Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number) {
    if (offset < 0) throw new BadRequestException('offset must be nonnegative');
    return this.catalog.list(offset);
  }

  @Get(':id') get(@Param('id', ParseIntPipe) id: number) { return this.catalog.get(id); }

  @Post() create(@Req() req: Request, @Body() body: RestaurantDto) {
    this.admin(req); return this.catalog.create(body.name);
  }

  @Patch(':id') update(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() body: RestaurantDto) {
    this.admin(req); return this.catalog.update(id, body.name);
  }

  @Delete(':id') remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    this.admin(req); return this.catalog.remove(id);
  }

  @Post(':id/dishes') addDish(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Body() body: DishDto) {
    this.admin(req); return this.catalog.addDish(id, body);
  }

  @Patch(':id/dishes/:dishId') updateDish(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Param('dishId', ParseIntPipe) dishId: number, @Body() body: UpdateDishDto) {
    this.admin(req); return this.catalog.updateDish(id, dishId, body);
  }

  @Delete(':id/dishes/:dishId') removeDish(@Req() req: Request, @Param('id', ParseIntPipe) id: number, @Param('dishId', ParseIntPipe) dishId: number) {
    this.admin(req); return this.catalog.removeDish(id, dishId);
  }
}

@Controller('internal/reservations')
@ApiExcludeController()
export class ReservationController {
  constructor(private readonly catalog: CatalogService) {}
  @Post(':id') reserve(@Param('id') id: string, @Body() body: ReserveDto) { return this.catalog.reserve(id, body); }
}
