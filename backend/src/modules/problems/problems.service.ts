import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PageMeta, pageArgs, paginated } from '../../common/dto/pagination.dto';
import { err } from '../../common/errors/app-exception';
import { StatusService } from '../../common/status/status.service';
import { AuthUser } from '../../common/types';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractorsService, cityFilter, sameCity } from '../contractors/contractors.service';
import { MAX_IMAGES_PER_PROBLEM, MediaService } from '../media/media.service';
import { CreateProblemDto, ListProblemsDto, UpdateProblemDto } from './dto/problem.dto';

const SORT_FIELDS = { created_at: 'createdAt', expires_at: 'expiresAt', urgency: 'urgency' } as const;

const baseInclude = {
  category: { select: { id: true, name: true, slug: true } },
  media: { select: { id: true, url: true } },
  customer: { select: { id: true, fullName: true } }, // never the phone (BR-36)
  _count: { select: { quotes: true } },
} satisfies Prisma.ProblemInclude;

export type { PageMeta };

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: StatusService,
    private readonly contractors: ContractorsService,
    private readonly media: MediaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async create(user: AuthUser, dto: CreateProblemDto) {
    if (dto.budgetMin != null && dto.budgetMax != null && dto.budgetMax < dto.budgetMin) {
      throw err.validation('budgetMax must be greater than or equal to budgetMin');
    }
    const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, isActive: true } });
    if (!category) throw err.validation('Category does not exist or is inactive.');

    const days = this.config.get('PROBLEM_EXPIRY_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const problem = await tx.problem.create({
        data: {
          customerId: user.id,
          categoryId: dto.categoryId,
          title: dto.title,
          description: dto.description,
          city: dto.city,
          area: dto.area ?? '',
          urgency: dto.urgency,
          budgetMin: dto.budgetMin,
          budgetMax: dto.budgetMax,
          latitude: dto.latitude,
          longitude: dto.longitude,
          expiresAt,
        },
        include: baseInclude,
      });
      await this.status.record(tx, { entity: 'PROBLEM', id: problem.id, from: null, to: 'OPEN', changedBy: user.id });
      return problem;
    });
  }

  /** Customer: own problems. Contractor: matching open problems (verified only). Admin: everything. */
  async list(user: AuthUser, dto: ListProblemsDto) {
    const where: Prisma.ProblemWhereInput = { deletedAt: null };
    const and: Prisma.ProblemWhereInput[] = [];

    if (dto.status) where.status = dto.status;
    if (dto.urgency) where.urgency = dto.urgency;
    if (dto.category) where.category = { slug: dto.category };
    if (dto.city) where.city = { equals: dto.city, mode: 'insensitive' };

    let include: Prisma.ProblemInclude = baseInclude;
    if (user.role === 'CUSTOMER') {
      where.customerId = user.id;
    } else if (user.role === 'CONTRACTOR') {
      const ctx = await this.contractors.getMatchContext(user.id); // 403 CONTRACTOR_NOT_VERIFIED
      where.status = 'OPEN';
      where.expiresAt = { gt: new Date() };
      where.categoryId = { in: ctx.categoryIds };
      and.push(cityFilter(ctx.cities));
      include = {
        ...baseInclude,
        quotes: { where: { contractorId: user.id }, select: { id: true, status: true, price: true } },
      };
    }
    if (and.length) where.AND = and;

    const sortKey = dto.sort?.replace(/^-/, '') as keyof typeof SORT_FIELDS | undefined;
    const orderBy: Prisma.ProblemOrderByWithRelationInput = sortKey
      ? { [SORT_FIELDS[sortKey]]: dto.sort?.startsWith('-') ? 'desc' : 'asc' }
      : { createdAt: 'desc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.problem.findMany({ where, include, orderBy, ...pageArgs(dto) }),
      this.prisma.problem.count({ where }),
    ]);
    return paginated(rows, total, dto);
  }

  async findOne(user: AuthUser, id: string) {
    const problem = await this.prisma.problem.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...baseInclude,
        booking: { select: { id: true, status: true, contractorId: true } },
        quotes: user.role === 'CONTRACTOR' ? { where: { contractorId: user.id }, select: { id: true, status: true, price: true } } : false,
      },
    });
    if (!problem) throw err.notFound('Problem');
    await this.assertCanView(user, problem);

    // Only the owner, admin or the booked contractor learn about the booking.
    const showBooking = user.role === 'ADMIN' || problem.customerId === user.id || problem.booking?.contractorId === user.id;
    return { ...problem, booking: showBooking ? problem.booking : null };
  }

  /** BR-14: editable only while OPEN and with no quotes. */
  async update(user: AuthUser, id: string, dto: UpdateProblemDto) {
    const problem = await this.requireOwned(user, id);
    if (problem.status !== 'OPEN') throw err.conflict('PROBLEM_NOT_OPEN', 'Only open problems can be edited.');
    const quotes = await this.prisma.quote.count({ where: { problemId: id } });
    if (quotes > 0) {
      throw err.conflict('PROBLEM_HAS_QUOTES', 'This problem already has quotes, so it can only be cancelled.');
    }
    if (dto.categoryId) {
      const ok = await this.prisma.category.findFirst({ where: { id: dto.categoryId, isActive: true } });
      if (!ok) throw err.validation('Category does not exist or is inactive.');
    }
    const min = dto.budgetMin ?? problem.budgetMin;
    const max = dto.budgetMax ?? problem.budgetMax;
    if (min != null && max != null && max < min) throw err.validation('budgetMax must be greater than or equal to budgetMin');

    return this.prisma.problem.update({ where: { id }, data: dto, include: baseInclude });
  }

  /** BR-15: cancel while OPEN; pending quotes become REJECTED. */
  async cancel(user: AuthUser, id: string) {
    const problem = await this.requireOwned(user, id);
    await this.prisma.$transaction(async (tx) => {
      await this.status.transition(tx, {
        entity: 'PROBLEM', id, from: problem.status, to: 'CANCELLED', actor: 'CUSTOMER', changedBy: user.id,
      });
      await tx.quote.updateMany({ where: { problemId: id, status: 'PENDING' }, data: { status: 'REJECTED' } });
    });
    return this.findOne(user, id);
  }

  /** BR-11: max 5 images in total (size/type are enforced by the upload interceptor). */
  async addMedia(user: AuthUser, id: string, files: Express.Multer.File[]) {
    if (!files?.length) throw err.validation('Attach at least one image in the "files" field.');
    const problem = await this.requireOwned(user, id);
    if (problem.status !== 'OPEN') throw err.conflict('PROBLEM_NOT_OPEN', 'Photos can only be added to open problems.');

    const existing = await this.prisma.problemMedia.count({ where: { problemId: id } });
    if (existing + files.length > MAX_IMAGES_PER_PROBLEM) {
      throw err.validation(`A problem can have at most ${MAX_IMAGES_PER_PROBLEM} images (it already has ${existing}).`);
    }
    const stored = await Promise.all(files.map((f) => this.media.saveImage(f)));
    await this.prisma.problemMedia.createMany({
      data: stored.map((s) => ({ problemId: id, url: s.url, sizeBytes: s.sizeBytes })),
    });
    return this.prisma.problemMedia.findMany({
      where: { problemId: id },
      select: { id: true, url: true, type: true, sizeBytes: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** BR-13: scheduled and idempotent (compare-and-set on status). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStaleProblems(): Promise<number> {
    const stale = await this.prisma.problem.findMany({
      where: { status: 'OPEN', expiresAt: { lte: new Date() }, deletedAt: null },
      select: { id: true },
      take: 200,
    });
    let expired = 0;
    for (const { id } of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.status.transition(tx, {
            entity: 'PROBLEM', id, from: 'OPEN', to: 'EXPIRED', actor: 'SYSTEM', changedBy: null, note: 'Expired automatically',
          });
          await tx.quote.updateMany({ where: { problemId: id, status: 'PENDING' }, data: { status: 'REJECTED' } });
        });
        expired++;
      } catch (e) {
        this.logger.warn(`Could not expire problem ${id}: ${(e as Error).message}`);
      }
    }
    return expired;
  }

  // ---------- helpers ----------

  private async requireOwned(user: AuthUser, id: string) {
    const problem = await this.prisma.problem.findFirst({ where: { id, deletedAt: null } });
    if (!problem) throw err.notFound('Problem');
    if (problem.customerId !== user.id) throw err.forbidden('This is not your problem.');
    return problem;
  }

  private async assertCanView(
    user: AuthUser,
    problem: { id: string; customerId: string; categoryId: string; city: string; status: string },
  ) {
    if (user.role === 'ADMIN' || problem.customerId === user.id) return;
    if (user.role === 'CONTRACTOR') {
      const own = await this.prisma.quote.findUnique({
        where: { problemId_contractorId: { problemId: problem.id, contractorId: user.id } },
        select: { id: true },
      });
      if (own) return;
      const ctx = await this.contractors.getMatchContext(user.id);
      const matches = ctx.categoryIds.includes(problem.categoryId) && ctx.cities.some((c) => sameCity(c, problem.city));
      if (problem.status === 'OPEN' && matches) return;
    }
    throw err.forbidden();
  }
}
