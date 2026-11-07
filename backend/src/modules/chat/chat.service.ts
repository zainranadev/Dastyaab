import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { pageArgs, paginated } from '../../common/dto/pagination.dto';
import { err } from '../../common/errors/app-exception';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMessageDto, ListMessagesDto } from './dto/chat.dto';

const senderInclude = {
  sender: {
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  },
} satisfies Prisma.ChatMessageInclude;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getVisibleBooking(user: AuthUser, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { id: true, fullName: true } },
        contractor: { select: { id: true, fullName: true } },
        problem: { select: { id: true, title: true } },
      },
    });
    if (!booking) throw err.notFound('Booking');
    const isParty = booking.customerId === user.id || booking.contractorId === user.id || user.role === 'ADMIN';
    if (!isParty) throw err.forbidden('You are not part of this booking conversation.');
    return booking;
  }

  async getMessages(user: AuthUser, bookingId: string, dto: ListMessagesDto) {
    await this.getVisibleBooking(user, bookingId);

    const where: Prisma.ChatMessageWhereInput = { bookingId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: senderInclude,
        ...pageArgs(dto),
      }),
      this.prisma.chatMessage.count({ where }),
    ]);
    return paginated(rows, total, dto);
  }

  async sendMessage(user: AuthUser, bookingId: string, dto: CreateMessageDto) {
    const booking = await this.getVisibleBooking(user, bookingId);
    if (booking.customerId !== user.id && booking.contractorId !== user.id) {
      throw err.forbidden('Only booking participants can send messages.');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        bookingId,
        senderId: user.id,
        content: dto.content,
      },
      include: senderInclude,
    });

    // Notify the other party
    const recipientId = user.id === booking.customerId ? booking.contractorId : booking.customerId;
    const senderName = user.id === booking.customerId ? booking.customer.fullName : booking.contractor.fullName;
    const preview = dto.content.length > 80 ? `${dto.content.slice(0, 77)}...` : dto.content;

    await this.notifications.create({
      userId: recipientId,
      type: 'NEW_MESSAGE',
      title: `Message from ${senderName}`,
      message: preview,
      entityType: 'BOOKING',
      entityId: bookingId,
    });

    return message;
  }
}
