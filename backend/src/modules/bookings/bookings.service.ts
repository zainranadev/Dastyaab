import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { pageArgs, paginated } from '../../common/dto/pagination.dto';
import { err } from '../../common/errors/app-exception';
import { Actor } from '../../common/status/status-machine';
import { StatusService } from '../../common/status/status.service';
import { AuthUser } from '../../common/types';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CancelBookingDto, ListBookingsDto, UpdateBookingStatusDto } from './dto/booking.dto';

/** BR-36: phone numbers exist ONLY on booking payloads, i.e. after a booking is created. */
const partyInclude = {
  problem: { select: { id: true, title: true, city: true, area: true, category: { select: { name: true } } } },
  customer: { select: { id: true, fullName: true, phone: true } },
  contractor: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: StatusService,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, dto: ListBookingsDto) {
    const where: Prisma.BookingWhereInput = dto.status ? { status: dto.status } : {};
    if (user.role === 'CUSTOMER') where.customerId = user.id;
    if (user.role === 'CONTRACTOR') where.contractorId = user.id;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({ where, include: partyInclude, orderBy: { createdAt: 'desc' }, ...pageArgs(dto) }),
      this.prisma.booking.count({ where }),
    ]);
    return paginated(rows, total, dto);
  }

  async findOne(user: AuthUser, id: string) {
    const booking = await this.requireVisible(user, id);
    const [history, review] = await Promise.all([
      this.prisma.statusHistory.findMany({
        where: { entityType: 'BOOKING', entityId: id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, fromStatus: true, toStatus: true, changedBy: true, note: true, createdAt: true },
      }),
      this.prisma.review.findFirst({
        where: { bookingId: id, deletedAt: null },
        select: { id: true, rating: true, comment: true, createdAt: true },
      }),
    ]);
    return { ...booking, statusHistory: history, review };
  }

  /** BR-32: only the assigned contractor moves a booking forward. */
  async updateStatus(user: AuthUser, id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.requireVisible(user, id);
    if (booking.contractorId !== user.id) throw err.forbidden('You are not the contractor on this booking.');

    await this.prisma.$transaction((tx) =>
      this.status.transition(tx, {
        entity: 'BOOKING', id, from: booking.status, to: dto.status, actor: 'CONTRACTOR', changedBy: user.id, note: dto.note,
      }),
    );

    await this.notifications.create({
      userId: booking.customerId,
      type: 'BOOKING_STATUS',
      title: 'Booking update',
      message: `Status updated to ${dto.status.replace(/_/g, ' ').toLowerCase()}${dto.note ? `: ${dto.note}` : ''}.`,
      entityType: 'BOOKING',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  /** BR-33: only the customer confirms completion. */
  async confirm(user: AuthUser, id: string) {
    const booking = await this.requireVisible(user, id);
    if (booking.customerId !== user.id) throw err.forbidden('Only the customer can confirm completion.');
    await this.prisma.$transaction((tx) => this.completeBooking(tx, booking, 'CUSTOMER', user.id));

    await this.notifications.create({
      userId: booking.contractorId,
      type: 'BOOKING_STATUS',
      title: 'Job completed!',
      message: `${booking.customer.fullName} confirmed the job is completed.`,
      entityType: 'BOOKING',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  /** BR-35: customer while SCHEDULED; contractor while SCHEDULED or ON_THE_WAY (the status machine decides). */
  async cancel(user: AuthUser, id: string, dto: CancelBookingDto) {
    const booking = await this.requireVisible(user, id);
    const actor: Actor | null =
      booking.customerId === user.id ? 'CUSTOMER' : booking.contractorId === user.id ? 'CONTRACTOR' : null;
    if (!actor) throw err.forbidden('Only the customer or contractor can cancel a booking.');

    await this.prisma.$transaction(async (tx) => {
      await this.status.transition(tx, {
        entity: 'BOOKING', id, from: booking.status, to: 'CANCELLED', actor, changedBy: user.id, note: dto.reason,
      });
      await this.status.transition(tx, {
        entity: 'PROBLEM', id: booking.problemId, from: 'BOOKED', to: 'CANCELLED', actor: 'SYSTEM', changedBy: user.id,
        note: 'Booking cancelled',
      });
      if (actor === 'CONTRACTOR') {
        await tx.contractorProfile.updateMany({ where: { userId: booking.contractorId }, data: { cancelledJobs: { increment: 1 } } });
      }
    });

    const targetUserId = actor === 'CUSTOMER' ? booking.contractorId : booking.customerId;
    const actorName = actor === 'CUSTOMER' ? booking.customer.fullName : booking.contractor.fullName;
    await this.notifications.create({
      userId: targetUserId,
      type: 'BOOKING_STATUS',
      title: 'Booking cancelled',
      message: `${actorName} cancelled the booking${dto.reason ? `: ${dto.reason}` : ''}.`,
      entityType: 'BOOKING',
      entityId: id,
    });

    return this.findOne(user, id);
  }

  /** BR-50 (Phase 1: cash). The contractor records that cash was received. Idempotent. */
  async markPaid(user: AuthUser, id: string) {
    const booking = await this.requireVisible(user, id);
    if (booking.contractorId !== user.id) throw err.forbidden('Only the contractor can mark cash as received.');
    if (!['IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED'].includes(booking.status)) {
      throw err.conflict('BOOKING_NOT_PAYABLE', 'Payment can only be recorded once work has started.');
    }
    if (booking.paymentStatus !== 'PAID') {
      await this.prisma.booking.update({ where: { id }, data: { paymentStatus: 'PAID' } });
    }
    return this.findOne(user, id);
  }

  /** BR-34: auto-complete after 72h of silence. Scheduled and idempotent. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCompleteDue(): Promise<number> {
    const hours = this.config.get('BOOKING_AUTO_COMPLETE_HOURS', { infer: true });
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const entries = await this.prisma.statusHistory.findMany({
      where: { entityType: 'BOOKING', toStatus: 'AWAITING_CONFIRMATION', createdAt: { lte: cutoff } },
      select: { entityId: true },
    });
    if (!entries.length) return 0;
    const due = await this.prisma.booking.findMany({
      where: { id: { in: entries.map((e) => e.entityId) }, status: 'AWAITING_CONFIRMATION' },
      take: 200,
    });

    let done = 0;
    for (const booking of due) {
      try {
        await this.prisma.$transaction((tx) => this.completeBooking(tx, booking, 'SYSTEM', null, 'Auto-completed after no response'));
        done++;
      } catch (e) {
        this.logger.warn(`Could not auto-complete booking ${booking.id}: ${(e as Error).message}`);
      }
    }
    return done;
  }

  // ---------- helpers ----------

  private async completeBooking(
    tx: Prisma.TransactionClient,
    booking: { id: string; problemId: string; contractorId: string; status: string },
    actor: Actor,
    changedBy: string | null,
    note?: string,
  ) {
    await this.status.transition(tx, {
      entity: 'BOOKING', id: booking.id, from: booking.status, to: 'COMPLETED', actor, changedBy, note, completedAt: new Date(),
    });
    await this.status.transition(tx, {
      entity: 'PROBLEM', id: booking.problemId, from: 'BOOKED', to: 'COMPLETED', actor: 'SYSTEM', changedBy,
      note: 'Booking completed',
    });
    await tx.contractorProfile.updateMany({ where: { userId: booking.contractorId }, data: { completedJobs: { increment: 1 } } });
  }

  private async requireVisible(user: AuthUser, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: partyInclude });
    if (!booking) throw err.notFound('Booking');
    const isParty = booking.customerId === user.id || booking.contractorId === user.id;
    if (!isParty && user.role !== 'ADMIN') throw err.forbidden('You are not part of this booking.');
    return booking;
  }
}
