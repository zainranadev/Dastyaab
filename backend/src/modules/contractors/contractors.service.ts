import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { err } from '../../common/errors/app-exception';
import { pageArgs, paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListContractorsAdminDto, UpsertProfileDto } from './dto/contractor.dto';

const withCategories = {
  categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ContractorProfileInclude;

export const sameCity = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** `city` matches case-insensitively against any of the contractor's cities. */
export const cityFilter = (cities: string[]): Prisma.ProblemWhereInput => ({
  OR: cities.map((c) => ({ city: { equals: c, mode: 'insensitive' as const } })),
});

@Injectable()
export class ContractorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(userId: string) {
    const profile = await this.prisma.contractorProfile.findUnique({ where: { userId }, include: withCategories });
    if (!profile) throw err.notFound('Contractor profile');
    return profile;
  }

  async upsertProfile(userId: string, dto: UpsertProfileDto) {
    const categoryIds = [...new Set(dto.categoryIds)];
    const found = await this.prisma.category.count({ where: { id: { in: categoryIds }, isActive: true } });
    if (found !== categoryIds.length) throw err.validation('One or more categories do not exist or are inactive.');

    const data = {
      bio: dto.bio ?? '',
      yearsExperience: dto.yearsExperience ?? 0,
      city: dto.city,
      serviceAreas: dto.serviceAreas ?? [],
    };
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.contractorProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
      await tx.contractorCategory.deleteMany({ where: { contractorId: profile.id } });
      await tx.contractorCategory.createMany({
        data: categoryIds.map((categoryId) => ({ contractorId: profile.id, categoryId })),
      });
    });
    return this.getOwnProfile(userId);
  }

  /** UNSUBMITTED | REJECTED -> PENDING */
  async submitVerification(userId: string) {
    const profile = await this.getOwnProfile(userId);
    if (profile.verificationStatus !== 'UNSUBMITTED' && profile.verificationStatus !== 'REJECTED') {
      throw err.conflict(
        'INVALID_STATUS_TRANSITION',
        `Verification cannot move from ${profile.verificationStatus} to PENDING.`,
      );
    }
    const res = await this.prisma.contractorProfile.updateMany({
      where: { userId, verificationStatus: profile.verificationStatus },
      data: { verificationStatus: 'PENDING', rejectionReason: null },
    });
    if (res.count !== 1) throw err.conflict('INVALID_STATUS_TRANSITION', 'Verification status changed, please retry.');
    return this.getOwnProfile(userId);
  }

  async getPublic(contractorUserId: string) {
    const p = await this.prisma.contractorProfile.findUnique({
      where: { userId: contractorUserId },
      include: { ...withCategories, user: { select: { fullName: true } } },
    });
    if (!p || p.verificationStatus !== 'VERIFIED') throw err.notFound('Contractor');
    return {
      id: p.userId,
      fullName: p.user.fullName,
      bio: p.bio,
      yearsExperience: p.yearsExperience,
      city: p.city,
      serviceAreas: p.serviceAreas,
      avgRating: p.avgRating,
      reviewCount: p.reviewCount,
      completedJobs: p.completedJobs,
      categories: p.categories.map((c) => c.category),
    };
  }

  /** BR-03 and the matching feed: must be VERIFIED. Returns where this contractor may work. */
  async getMatchContext(userId: string) {
    const p = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      include: { categories: { select: { categoryId: true } } },
    });
    if (!p || p.verificationStatus !== 'VERIFIED') throw err.notVerified();
    return {
      categoryIds: p.categories.map((c) => c.categoryId),
      cities: [p.city, ...p.serviceAreas],
    };
  }

  // ---------- admin ----------

  async listForAdmin(dto: ListContractorsAdminDto) {
    const where: Prisma.ContractorProfileWhereInput = dto.status ? { verificationStatus: dto.status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.contractorProfile.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        ...pageArgs(dto),
        include: {
          ...withCategories,
          user: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      }),
      this.prisma.contractorProfile.count({ where }),
    ]);
    return paginated(rows, total, dto);
  }

  async verify(contractorUserId: string) {
    await this.moveFromPending(contractorUserId, 'VERIFIED', null);
    return this.getOwnProfile(contractorUserId);
  }

  async reject(contractorUserId: string, reason: string) {
    await this.moveFromPending(contractorUserId, 'REJECTED', reason);
    return this.getOwnProfile(contractorUserId);
  }

  private async moveFromPending(userId: string, to: 'VERIFIED' | 'REJECTED', reason: string | null) {
    const profile = await this.getOwnProfile(userId);
    if (profile.verificationStatus !== 'PENDING') {
      throw err.conflict('INVALID_STATUS_TRANSITION', `Verification cannot move from ${profile.verificationStatus} to ${to}.`);
    }
    const res = await this.prisma.contractorProfile.updateMany({
      where: { userId, verificationStatus: 'PENDING' },
      data: { verificationStatus: to, rejectionReason: reason },
    });
    if (res.count !== 1) throw err.conflict('INVALID_STATUS_TRANSITION', 'Verification status changed, please retry.');
  }
}

