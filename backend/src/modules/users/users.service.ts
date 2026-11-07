import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { err } from '../../common/errors/app-exception';
import { PrismaService } from '../../prisma/prisma.service';

/** Never select password_hash for anything that can reach a response. */
export const SAFE_USER = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getSafe(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: SAFE_USER });
    if (!user) throw err.notFound('User');
    return user;
  }
}
