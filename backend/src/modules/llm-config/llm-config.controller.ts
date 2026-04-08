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
import { LlmConfigService } from './llm-config.service';
import { LlmService } from '../llm/llm.service';
import { CreateLlmConfigDto } from './dto/create-llm-config.dto';
import { UpdateLlmConfigDto } from './dto/update-llm-config.dto';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Controller('llm-configs')
export class LlmConfigController {
  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly llmService: LlmService,
  ) {}

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.llmConfigService.findAll(workspaceId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.llmConfigService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateLlmConfigDto,
  ) {
    return this.llmConfigService.create(workspaceId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateLlmConfigDto,
  ) {
    const result = await this.llmConfigService.update(id, workspaceId, dto);
    this.llmService.clearClientCache(id);
    return result;
  }

  @Patch(':id/set-default')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.llmConfigService.setDefault(id, workspaceId);
  }

  @Post(':id/test')
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.llmService.testConnection(id, workspaceId);
  }

  @Get(':id/models')
  async listModels(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.llmService.listModels(id, workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    this.llmService.clearClientCache(id);
    await this.llmConfigService.remove(id, workspaceId);
  }
}
