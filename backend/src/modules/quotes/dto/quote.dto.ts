import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Trim } from '../../../common/transforms';

export class CreateQuoteDto {
  /** BR-21: integer PKR, greater than 0 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 365)
  estimatedDurationHours: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsDateString()
  proposedStartAt?: string;
}

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}

export class ListQuotesDto extends PaginationDto {}

export class CounterNoteDto {
  @Trim()
  @IsString()
  @MaxLength(500)
  note: string;
}
