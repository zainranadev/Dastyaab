import { Injectable, Logger } from '@nestjs/common';
import { EntityType, NotificationType, Prisma } from '@prisma/client';
import { pageArgs, paginated } from '../../common/dto/pagination.dto';
import { err } from '../../common/errors/app-exception';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { ListNotificationsDto } from './dto/notification.dto';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: EntityType;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, dto: ListNotificationsDto) {
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (dto.unreadOnly) where.isRead = false;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(dto),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(rows, total, dto);
  }

  async getUnreadCount(user: AuthUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
    return { unreadCount: count };
  }

  async markAsRead(user: AuthUser, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw err.notFound('Notification');
    if (notification.userId !== user.id) throw err.forbidden('This notification is not yours.');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(user: AuthUser) {
    const updated = await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return { count: updated.count };
  }

  /** System method to create a notification, non-blocking if error */
  async create(params: CreateNotificationParams) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          entityType: params.entityType,
          entityId: params.entityId,
        },
      });
    } catch (e) {
      this.logger.error(`Failed to create notification for user ${params.userId}: ${(e as Error).message}`);
      return null;
    }
  }
}

