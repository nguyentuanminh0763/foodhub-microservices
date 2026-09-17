import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class RestaurantDto {
  @IsString() @Length(1, 120) name: string;
}

export class DishDto {
  @IsString() @Length(1, 120) name: string;
  @IsInt() @Min(0) @Max(10_000_000) priceVnd: number;
  @IsInt() @Min(0) @Max(1_000_000) stock: number;
}

export class UpdateDishDto extends PartialType(DishDto) {}

export class ReservationItemDto {
  @IsInt() @Min(1) dishId: number;
  @IsInt() @Min(1) @Max(100) quantity: number;
}

export class ReserveDto {
  @IsInt() @Min(1) restaurantId: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => ReservationItemDto)
  items: ReservationItemDto[];
}
