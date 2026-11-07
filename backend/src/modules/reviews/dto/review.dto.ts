import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../../common/transforms';

export class CreateReviewDto {
  /** BR-41 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class UpdateReviewDto extends PartialType(CreateReviewDto) {}
