import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength,
} from 'class-validator';
import { ProblemStatus, Urgency } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Trim } from '../../../common/transforms';

export class CreateProblemDto {
  /** BR-10 */
  @Trim()
  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @Trim()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @IsUUID()
  categoryId: string;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  city: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  area?: string;

  /** BR-12 */
  @IsEnum(Urgency)
  urgency: Urgency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export class UpdateProblemDto extends PartialType(CreateProblemDto) {}

export class ListProblemsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ProblemStatus)
  status?: ProblemStatus;

  /** category slug, e.g. `plumbing` */
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency;

  /** e.g. `-created_at` (newest first, default) */
  @IsOptional()
  @Matches(/^-?(created_at|expires_at|urgency)$/, { message: 'sort must be one of created_at, expires_at, urgency (prefix - for descending)' })
  sort?: string;
}
