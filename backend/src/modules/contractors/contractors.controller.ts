import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { ContractorsService } from './contractors.service';
import { UpsertProfileDto } from './dto/contractor.dto';

@ApiTags('contractors')
@Controller('contractors')
export class ContractorsController {
  constructor(private readonly contractors: ContractorsService) {}

  @ApiBearerAuth()
  @Roles(Role.CONTRACTOR)
  @Get('me/profile')
  myProfile(@CurrentUser() user: AuthUser) {
    return this.contractors.getOwnProfile(user.id);
  }

  @ApiBearerAuth()
  @Roles(Role.CONTRACTOR)
  @Put('me/profile')
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertProfileDto) {
    return this.contractors.upsertProfile(user.id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.CONTRACTOR)
  @Post('me/submit-verification')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser) {
    return this.contractors.submitVerification(user.id);
  }

  @Public()
  @Get(':id')
  publicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractors.getPublic(id);
  }
}
