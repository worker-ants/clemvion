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
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { QueryWorkflowDto } from './dto/query-workflow.dto';
import { SaveCanvasDto } from './dto/save-canvas.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';

@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

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

  @Post(':id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body?: { input?: Record<string, unknown> },
  ) {
    // Verify workflow belongs to workspace
    await this.workflowsService.findById(id, workspaceId);
    const executionId = await this.executionEngineService.execute(
      id,
      body?.input,
      user.sub,
    );
    return { executionId };
  }

  @Post(':id/save')
  async saveCanvas(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() _user: JwtPayload,
    @Body() dto: SaveCanvasDto,
  ) {
    return this.workflowsService.saveCanvas(id, workspaceId, dto);
  }

  @Get(':id/export')
  async exportWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.workflowsService.exportWorkflow(id, workspaceId);
  }
}
