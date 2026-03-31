import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PreviewExpressionDto } from './dto/preview-expression.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.schedulesService.findAll(workspaceId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.schedulesService.findById(id, workspaceId);
  }

  @Get(':id/preview')
  async getPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query('count') count?: string,
  ) {
    return this.schedulesService.getPreview(
      id,
      workspaceId,
      count ? parseInt(count, 10) : 5,
    );
  }

  @Post('preview')
  async previewExpression(@Body() dto: PreviewExpressionDto) {
    return this.schedulesService.getPreviewFromExpression(
      dto.cronExpression,
      dto.timezone,
      dto.count,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(workspaceId, dto);
  }

  @Post(':id/run-now')
  @HttpCode(HttpStatus.ACCEPTED)
  async runNow(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.runNow(id, workspaceId, user.sub);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.schedulesService.remove(id, workspaceId);
  }
}
