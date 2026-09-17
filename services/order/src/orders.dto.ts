import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, Min, Max, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsInt() @Min(1) dishId: number;
  @IsInt() @Min(1) @Max(100) quantity: number;
}

export class CreateOrderDto {
  @IsInt() @Min(1) restaurantId: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items: OrderItemDto[];
  @IsOptional() @IsIn(['demo_success', 'demo_failure'])
  paymentMethod?: 'demo_success' | 'demo_failure';
}

export class TransitionDto {
  @IsIn(['CONFIRMED', 'READY']) status: 'CONFIRMED' | 'READY';
}
