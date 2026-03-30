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
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { QueryWorkflowDto } from './dto/query-workflow.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryWorkflowDto,
  ) {
    return this.workflowsService.findAll(workspaceId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.workflowsService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowsService.create(workspaceId, user.sub, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.workflowsService.remove(id, workspaceId);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workflowsService.duplicate(id, workspaceId, user.sub);
  }

  @Get(':id/export')
  async exportWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.workflowsService.exportWorkflow(id, workspaceId);
  }
}
