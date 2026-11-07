import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Return this from a controller to get `{ data, meta }` in the response. */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: PageMeta,
  ) {}
}

export const pageArgs = (p: PaginationDto) => ({ skip: (p.page - 1) * p.limit, take: p.limit });

export const paginated = <T>(items: T[], total: number, p: PaginationDto) =>
  new Paginated(items, { page: p.page, limit: p.limit, total, totalPages: Math.max(1, Math.ceil(total / p.limit)) });
