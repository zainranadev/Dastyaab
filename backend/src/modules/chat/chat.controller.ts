import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { ChatService } from './chat.service';
import { CreateMessageDto, ListMessagesDto } from './dto/chat.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('bookings/:id/messages')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Query() dto: ListMessagesDto,
  ) {
    return this.chat.getMessages(user, bookingId, dto);
  }

  @Post()
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chat.sendMessage(user, bookingId, dto);
  }
}

