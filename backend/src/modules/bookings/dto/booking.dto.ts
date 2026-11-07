import { BookingStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Trim } from '../../../common/transforms';

export class ListBookingsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}

/** Contractors can only push a booking forward here (BR-32). Cancel and confirm have their own endpoints. */
export class UpdateBookingStatusDto {
  @IsIn(['ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_CONFIRMATION'])
  status: 'ON_THE_WAY' | 'IN_PROGRESS' | 'AWAITING_CONFIRMATION';

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CancelBookingDto {
  @Trim()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason: string;
}
