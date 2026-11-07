import {
  Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { MAX_IMAGES_PER_PROBLEM, imageUploadOptions } from '../media/media.service';
import { CreateProblemDto, ListProblemsDto, UpdateProblemDto } from './dto/problem.dto';
import { ProblemsService } from './problems.service';

@ApiTags('problems')
@ApiBearerAuth()
@Controller('problems')
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}

  @Roles(Role.CUSTOMER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProblemDto) {
    return this.problems.create(user, dto);
  }

  /** Customer: own problems. Contractor: matching open problems. */
  @Roles(Role.CUSTOMER, Role.CONTRACTOR, Role.ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() dto: ListProblemsDto) {
    return this.problems.list(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.problems.findOne(user, id);
  }

  @Roles(Role.CUSTOMER)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProblemDto) {
    return this.problems.update(user, id, dto);
  }

  @Roles(Role.CUSTOMER)
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.problems.cancel(user, id);
  }

  @Roles(Role.CUSTOMER)
  @Post(':id/media')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', MAX_IMAGES_PER_PROBLEM, imageUploadOptions))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.problems.addMedia(user, id, files);
  }
}
