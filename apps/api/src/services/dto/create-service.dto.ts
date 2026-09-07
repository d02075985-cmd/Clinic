import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  currentPrice: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
