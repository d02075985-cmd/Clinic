import { IsUUID, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsUUID()
  serviceId: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  quantity?: number = 1;

  // Optional per-invoice price override. When omitted, the service's current
  // default price is used (existing behavior, unchanged). When provided, this
  // exact amount is what gets snapshotted onto the invoice item — the
  // service's own default price is never touched by this.
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  unitPrice?: number;
}
