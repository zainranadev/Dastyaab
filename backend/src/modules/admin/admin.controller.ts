import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BookingsService } from '../bookings/bookings.service';
import { ListBookingsDto } from '../bookings/dto/booking.dto';
import { ContractorsService } from '../contractors/contractors.service';
import { ListContractorsAdminDto, RejectContractorDto } from '../contractors/dto/contractor.dto';
import { ListProblemsDto } from '../problems/dto/problem.dto';
import { ProblemsService } from '../problems/problems.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly contractors: ContractorsService,
    private readonly problems: ProblemsService,
    private readonly bookings: BookingsService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.admin.getStats();
  }

  /** Verification queue: GET /admin/contractors?status=PENDING */
  @Get('contractors')
  listContractors(@Query() dto: ListContractorsAdminDto) {
    return this.contractors.listForAdmin(dto);
  }

  @Post('contractors/:id/verify')
  @HttpCode(200)
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractors.verify(id);
  }

  @Post('contractors/:id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectContractorDto) {
    return this.contractors.reject(id, dto.reason);
  }

  @Get('problems')
  listProblems(@CurrentUser() user: AuthUser, @Query() dto: ListProblemsDto) {
    return this.problems.list(user, dto);
  }

  @Get('bookings')
  listBookings(@CurrentUser() user: AuthUser, @Query() dto: ListBookingsDto) {
    return this.bookings.list(user, dto);
  }

  @Delete('reviews/:id')
  removeReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.remove(id);
  }
}
