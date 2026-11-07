import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/types';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @ApiBearerAuth()
  @Roles(Role.CUSTOMER)
  @Post('bookings/:id/review')
  create(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user, id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.CUSTOMER)
  @Patch('reviews/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(user, id, dto);
  }

  @Public()
  @Get('contractors/:id/reviews')
  list(@Param('id', ParseUUIDPipe) id: string, @Query() dto: PaginationDto) {
    return this.reviews.listForContractor(id, dto);
  }
}
