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
import { IntegrationsService } from './integrations.service';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.integrationsService.findAll(workspaceId, query);
  }

  @Get('services')
  getAvailableServices() {
    return this.integrationsService.getAvailableServices();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.create(workspaceId, user.sub, body);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.update(id, workspaceId, body);
  }

  @Post(':id/test')
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.testConnection(id, workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.integrationsService.remove(id, workspaceId);
  }
}
