import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BookingsService } from './bookings.service';
import { CancelBookingDto, ListBookingsDto, UpdateBookingStatusDto } from './dto/booking.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Roles(Role.CUSTOMER, Role.CONTRACTOR)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() dto: ListBookingsDto) {
    return this.bookings.list(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.findOne(user, id);
  }

  @Roles(Role.CONTRACTOR)
  @Post(':id/status')
  @HttpCode(200)
  updateStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookings.updateStatus(user, id, dto);
  }

  @Roles(Role.CUSTOMER)
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.confirm(user, id);
  }

  @Roles(Role.CUSTOMER, Role.CONTRACTOR)
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelBookingDto) {
    return this.bookings.cancel(user, id, dto);
  }

  @Roles(Role.CONTRACTOR)
  @Post(':id/mark-paid')
  @HttpCode(200)
  markPaid(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.markPaid(user, id);
  }
}
