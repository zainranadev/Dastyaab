import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto, pageArgs, paginated } from '../../common/dto/pagination.dto';
import { err } from '../../common/errors/app-exception';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // BR-43

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** BR-40: only the customer of a COMPLETED booking, once per booking. */
  async create(user: AuthUser, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { select: { fullName: true } } },
    });
    if (!booking) throw err.notFound('Booking');
    if (booking.customerId !== user.id) throw err.forbidden('Only the customer of this booking can review it.');
    if (booking.status !== 'COMPLETED') {
      throw err.conflict('BOOKING_NOT_COMPLETED', 'You can review a booking only after it is completed.');
    }
    const existing = await this.prisma.review.findUnique({ where: { bookingId } });
    if (existing) throw err.conflict('DUPLICATE_RESOURCE', 'This booking already has a review.');

    const review = await this.prisma.$transaction(async (tx) => {
      const rev = await tx.review.create({
        data: {
          bookingId,
          customerId: user.id,
          contractorId: booking.contractorId,
          rating: dto.rating,
          comment: dto.comment || null,
        },
      });
      await this.recalculate(tx, booking.contractorId); // BR-42
      return rev;
    });

    await this.notifications.create({
      userId: booking.contractorId,
      type: 'REVIEW_RECEIVED',
      title: 'New review received',
      message: `${booking.customer.fullName} left a ${dto.rating}-star review for your completed job.`,
      entityType: 'BOOKING',
      entityId: bookingId,
    });

    return review;
  }

  /** BR-43: editable for 48 hours, then locked. */
  async update(user: AuthUser, id: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findFirst({ where: { id, deletedAt: null } });
    if (!review) throw err.notFound('Review');
    if (review.customerId !== user.id) throw err.forbidden('This is not your review.');
    if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw err.conflict('REVIEW_LOCKED', 'Reviews can only be edited within 48 hours.');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id },
        data: { rating: dto.rating, comment: dto.comment === undefined ? undefined : dto.comment || null },
      });
      await this.recalculate(tx, review.contractorId);
      return updated;
    });
  }

  /** Admin: remove an abusive review (soft delete, D5). */
  async remove(id: string) {
    const review = await this.prisma.review.findFirst({ where: { id, deletedAt: null } });
    if (!review) throw err.notFound('Review');
    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.recalculate(tx, review.contractorId);
    });
    return { removed: true };
  }

  async listForContractor(contractorId: string, dto: PaginationDto) {
    const where: Prisma.ReviewWhereInput = { contractorId, deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(dto),
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          customer: { select: { fullName: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(rows, total, dto);
  }

  /** BR-42: recomputed from scratch on every create, edit or removal (never drifts). */
  private async recalculate(tx: Prisma.TransactionClient, contractorId: string) {
    const agg = await tx.review.aggregate({
      where: { contractorId, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await tx.contractorProfile.updateMany({
      where: { userId: contractorId },
      data: { avgRating: Math.round((agg._avg.rating ?? 0) * 100) / 100, reviewCount: agg._count.rating },
    });
  }
}
