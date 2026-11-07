import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { VerificationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Trim } from '../../../common/transforms';

export class UpsertProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience?: number;

  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  city: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  serviceAreas?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  categoryIds: string[];
}

export class ListContractorsAdminDto extends PaginationDto {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}

export class RejectContractorDto {
  @Trim()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
