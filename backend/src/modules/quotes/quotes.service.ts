import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { pageArgs, paginated } from '../../common/dto/pagination.dto';
import { err } from '../../common/errors/app-exception';
import { StatusService } from '../../common/status/status.service';
import { AuthUser } from '../../common/types';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractorsService, sameCity } from '../contractors/contractors.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CounterNoteDto, CreateQuoteDto, ListQuotesDto, UpdateQuoteDto } from './dto/quote.dto';

const contractorCard = {
  select: {
    id: true,
    fullName: true,
    contractorProfile: {
      select: { avgRating: true, reviewCount: true, completedJobs: true, yearsExperience: true, city: true },
    },
  },
} satisfies { select: Prisma.UserSelect };

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: StatusService,
    private readonly contractors: ContractorsService,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
  ) {}

  /** BR-03, BR-20, BR-21, BR-22, BR-24 */
  async create(user: AuthUser, problemId: string, dto: CreateQuoteDto) {
    const ctx = await this.contractors.getMatchContext(user.id); // BR-03 -> 403 CONTRACTOR_NOT_VERIFIED

    const problem = await this.prisma.problem.findFirst({ where: { id: problemId, deletedAt: null } });
    if (!problem) throw err.notFound('Problem');
    if (problem.status !== 'OPEN') throw err.conflict('PROBLEM_NOT_OPEN', 'This problem is not open for quotes.');

    const inScope = ctx.categoryIds.includes(problem.categoryId) && ctx.cities.some((c) => sameCity(c, problem.city));
    if (!inScope) throw err.forbidden('You do not work in this category and city.'); // BR-22

    const already = await this.prisma.quote.findUnique({
      where: { problemId_contractorId: { problemId, contractorId: user.id } },
      select: { id: true },
    });
    if (already) throw err.conflict('DUPLICATE_RESOURCE', 'You already sent a quote on this problem.'); // BR-20

    const max = this.config.get('MAX_QUOTES_PER_PROBLEM', { infer: true });
    const active = await this.prisma.quote.count({ where: { problemId, status: { not: 'WITHDRAWN' } } });
    if (active >= max) throw err.conflict('QUOTE_LIMIT_REACHED', `This problem already has ${max} quotes.`); // BR-24

    const [contractor, quote] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }),
      this.prisma.quote.create({
        data: {
          problemId,
          contractorId: user.id,
          price: dto.price,
          estimatedDurationHours: dto.estimatedDurationHours,
          message: dto.message ?? '',
          proposedStartAt: dto.proposedStartAt ? new Date(dto.proposedStartAt) : null,
        },
      }),
    ]);

    await this.notifications.create({
      userId: problem.customerId,
      type: 'NEW_QUOTE',
      title: 'New quote received',
      message: `${contractor?.fullName ?? 'A contractor'} sent a quote of Rs ${dto.price.toLocaleString('en-PK')} on "${problem.title}".`,
      entityType: 'PROBLEM',
      entityId: problem.id,
    });

    return quote;
  }

  /** Owner sees all quotes (cheapest first); a contractor sees only their own; admin sees all. */
  async listForProblem(user: AuthUser, problemId: string) {
    const problem = await this.prisma.problem.findFirst({ where: { id: problemId, deletedAt: null } });
    if (!problem) throw err.notFound('Problem');

    const where: Prisma.QuoteWhereInput = { problemId };
    if (user.role === 'CUSTOMER') {
      if (problem.customerId !== user.id) throw err.forbidden('This is not your problem.');
    } else if (user.role === 'CONTRACTOR') {
      where.contractorId = user.id;
    }
    return this.prisma.quote.findMany({
      where,
      orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
      include: { contractor: contractorCard },
    });
  }

  async mine(user: AuthUser, dto: ListQuotesDto) {
    const where: Prisma.QuoteWhereInput = { contractorId: user.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(dto),
        include: {
          problem: { select: { id: true, title: true, city: true, status: true } },
          booking: { select: { id: true, status: true } },
        },
      }),
      this.prisma.quote.count({ where }),
    ]);
    return paginated(rows, total, dto);
  }

  /** BR-20: editable while PENDING. */
  async update(user: AuthUser, id: string, dto: UpdateQuoteDto) {
    const quote = await this.requireOwnPending(user, id);
    return this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        price: dto.price,
        estimatedDurationHours: dto.estimatedDurationHours,
        message: dto.message,
        proposedStartAt: dto.proposedStartAt ? new Date(dto.proposedStartAt) : undefined,
      },
    });
  }

  /** BR-23 */
  async withdraw(user: AuthUser, id: string) {
    const quote = await this.requireOwnPending(user, id);
    const res = await this.prisma.quote.updateMany({
      where: { id: quote.id, status: 'PENDING' },
      data: { status: 'WITHDRAWN' },
    });
    if (res.count !== 1) throw err.conflict('QUOTE_NOT_PENDING', 'This quote can no longer be withdrawn.');
    return this.prisma.quote.findUniqueOrThrow({ where: { id } });
  }

  /**
   * BR-30: accepting a quote creates exactly ONE booking, books the problem and rejects all
   * other quotes, in ONE transaction. Two simultaneous accepts: the second one blocks on the
   * problem row, then fails the compare-and-set (status is no longer OPEN) -> 409 PROBLEM_NOT_OPEN.
   * BR-31: booking price = quote price.
   */
  async accept(user: AuthUser, id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { problem: { include: { customer: { select: { fullName: true } } } } },
    });
    if (!quote) throw err.notFound('Quote');
    if (quote.problem.customerId !== user.id) throw err.forbidden('This is not your problem.');
    if (quote.status !== 'PENDING') throw err.conflict('QUOTE_NOT_PENDING', 'This quote is no longer pending.');

    return this.prisma.$transaction(async (tx) => {
      await this.status.transition(tx, {
        entity: 'PROBLEM', id: quote.problemId, from: 'OPEN', to: 'BOOKED',
        actor: 'CUSTOMER', changedBy: user.id, note: 'Quote accepted',
      });
      const accepted = await tx.quote.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACCEPTED' } });
      if (accepted.count !== 1) throw err.conflict('QUOTE_NOT_PENDING', 'This quote is no longer pending.');
      await tx.quote.updateMany({
        where: { problemId: quote.problemId, id: { not: id }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      const booking = await tx.booking.create({
        data: {
          problemId: quote.problemId,
          quoteId: id,
          customerId: user.id,
          contractorId: quote.contractorId,
          agreedPrice: quote.price,
          scheduledAt: quote.proposedStartAt ?? new Date(),
        },
      });
      await this.status.record(tx, { entity: 'BOOKING', id: booking.id, from: null, to: 'SCHEDULED', changedBy: user.id });

      // Notify the accepted contractor
      await this.notifications.create({
        userId: quote.contractorId,
        type: 'QUOTE_ACCEPTED',
        title: 'Quote accepted!',
        message: `${quote.problem.customer.fullName} accepted your quote on "${quote.problem.title}". Booking is confirmed.`,
        entityType: 'BOOKING',
        entityId: booking.id,
      });

      // Notify other contractors whose quotes became rejected
      const rejectedQuotes = await tx.quote.findMany({
        where: { problemId: quote.problemId, id: { not: id } },
        select: { contractorId: true },
      });
      for (const r of rejectedQuotes) {
        await this.notifications.create({
          userId: r.contractorId,
          type: 'QUOTE_REJECTED',
          title: 'Quote update',
          message: `Another quote was chosen for "${quote.problem.title}".`,
          entityType: 'PROBLEM',
          entityId: quote.problemId,
        });
      }

      return booking;
    });
  }

  /**
   * Customer sends a counter-note to the contractor on a pending quote.
   * No new table — fires a NEW_MESSAGE notification to the contractor so they
   * can revise their quote (PATCH /quotes/:id) in response.
   */
  async counter(user: AuthUser, id: string, dto: CounterNoteDto) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { problem: { select: { customerId: true, title: true } }, contractor: { select: { fullName: true } } },
    });
    if (!quote) throw err.notFound('Quote');
    if (quote.problem.customerId !== user.id) throw err.forbidden('This is not your problem.');
    if (quote.status !== 'PENDING') throw err.conflict('QUOTE_NOT_PENDING', 'Only pending quotes can receive counter-notes.');

    const sender = await this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
    await this.notifications.create({
      userId: quote.contractorId,
      type: 'NEW_MESSAGE',
      title: 'Counter-note from customer',
      message: `${sender?.fullName ?? 'The customer'} sent a note on "${quote.problem.title}": ${dto.note}`,
      entityType: 'PROBLEM',
      entityId: quote.problemId,
    });

    return { ok: true };
  }

  private async requireOwnPending(user: AuthUser, id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw err.notFound('Quote');
    if (quote.contractorId !== user.id) throw err.forbidden('This is not your quote.');
    if (quote.status !== 'PENDING') throw err.conflict('QUOTE_NOT_PENDING', 'Only pending quotes can be changed.');
    return quote;
  }
}
