import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalProblems,
      openProblems,
      totalBookings,
      activeBookings,
      completedBookings,
      pendingContractors,
      verifiedContractors,
      totalCustomers,
    ] = await this.prisma.$transaction([
      this.prisma.problem.count({ where: { deletedAt: null } }),
      this.prisma.problem.count({ where: { status: 'OPEN', deletedAt: null } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: { status: { in: ['SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_CONFIRMATION'] } },
      }),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.contractorProfile.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.contractorProfile.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    ]);

    return {
      totalProblems,
      openProblems,
      totalBookings,
      activeBookings,
      completedBookings,
      pendingContractors,
      verifiedContractors,
      totalCustomers,
    };
  }
}

