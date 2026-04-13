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
import { BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from '../nodes/entities/node.entity';
import { WorkflowsService } from './workflows.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { resolveTriggerParameters } from '../execution-engine/utils/resolve-trigger-parameters';
import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigger-parameter-schema';
import { TriggerParameterValidationException } from '../execution-engine/types/trigger-parameter.types';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { QueryWorkflowDto } from './dto/query-workflow.dto';
import { SaveCanvasDto } from './dto/save-canvas.dto';
import { ImportWorkflowDto } from './dto/import-workflow.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';

@Controller('workflows')
export class WorkflowsController {
  private readonly logger = new Logger(WorkflowsController.name);

  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly executionEngineService: ExecutionEngineService,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
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
    @Body()
    body?: {
      input?: Record<string, unknown>;
      parameterValues?: Record<string, unknown>;
    },
  ) {
    // Verify workflow belongs to workspace
    await this.workflowsService.findById(id, workspaceId);

    // Resolve trigger parameters against the workflow's trigger node schema.
    // Accepts `parameterValues` (preferred) or `input.parameters` for
    // back-compat with older clients.
    const rawValues =
      body?.parameterValues ??
      (body?.input && typeof body.input === 'object' && body.input !== null
        ? (body.input.parameters as Record<string, unknown> | undefined)
        : undefined) ??
      {};

    const schema = await loadTriggerParameterSchema(
      this.nodeRepository,
      id,
      this.logger,
    );
    let parameters: Record<string, unknown>;
    try {
      parameters = resolveTriggerParameters(schema, rawValues);
    } catch (err) {
      if (err instanceof TriggerParameterValidationException) {
        throw new BadRequestException({
          code: 'INVALID_TRIGGER_PARAMETERS',
          message: 'Invalid trigger parameters',
          errors: err.errors,
        });
      }
      throw err;
    }

    const executionInput = { ...(body?.input ?? {}), parameters };
    const executionId = await this.executionEngineService.execute(
      id,
      executionInput,
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

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async importWorkflow(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportWorkflowDto,
  ) {
    return this.workflowsService.importWorkflow(workspaceId, user.sub, dto);
  }
}
