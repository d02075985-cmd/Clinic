import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ChargeType } from '@prisma/client';
import { Type } from 'class-transformer';

export class AddChargeDto {
  @IsEnum(ChargeType)
  chargeType: ChargeType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  chargeValue: number;

  @IsString()
  @IsOptional()
  description?: string;
}
