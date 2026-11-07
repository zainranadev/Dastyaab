import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { CounterNoteDto, CreateQuoteDto, ListQuotesDto, UpdateQuoteDto } from './dto/quote.dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Roles(Role.CONTRACTOR)
  @Post('problems/:id/quotes')
  create(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(user, id, dto);
  }

  @Roles(Role.CUSTOMER, Role.CONTRACTOR, Role.ADMIN)
  @Get('problems/:id/quotes')
  listForProblem(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.listForProblem(user, id);
  }

  // NOTE: declared before ':id' routes so "mine" is never parsed as an id.
  @Roles(Role.CONTRACTOR)
  @Get('quotes/mine')
  mine(@CurrentUser() user: AuthUser, @Query() dto: ListQuotesDto) {
    return this.quotes.mine(user, dto);
  }

  @Roles(Role.CONTRACTOR)
  @Patch('quotes/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(user, id, dto);
  }

  @Roles(Role.CONTRACTOR)
  @Post('quotes/:id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.withdraw(user, id);
  }

  @Roles(Role.CUSTOMER)
  @Post('quotes/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.accept(user, id);
  }

  @Roles(Role.CUSTOMER)
  @Post('quotes/:id/counter')
  @HttpCode(200)
  counter(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CounterNoteDto) {
    return this.quotes.counter(user, id, dto);
  }
}
