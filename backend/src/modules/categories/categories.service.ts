import { Injectable } from '@nestjs/common';
import { err } from '../../common/errors/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  }

  async create(dto: CreateCategoryDto) {
    await this.assertNameFree(dto.name, dto.parentId ?? null);
    if (dto.parentId) await this.requireExisting(dto.parentId);
    return this.prisma.category.create({
      data: { name: dto.name, slug: dto.slug ?? slugify(dto.name), parentId: dto.parentId ?? null },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const current = await this.requireExisting(id);
    if (dto.name && dto.name !== current.name) await this.assertNameFree(dto.name, current.parentId, id);
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, slug: dto.slug, isActive: dto.isActive },
    });
  }

  private async requireExisting(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw err.notFound('Category');
    return c;
  }

  /** Postgres treats NULL parents as distinct, so uniqueness within a parent is checked here. */
  private async assertNameFree(name: string, parentId: string | null, exceptId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, parentId, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw err.conflict('DUPLICATE_RESOURCE', 'A category with this name already exists.');
  }
}
