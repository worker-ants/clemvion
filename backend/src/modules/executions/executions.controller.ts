import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { QueryExecutionDto } from './dto/query-execution.dto';

@Controller('executions')
export class ExecutionsController {
  constructor(
    private readonly executionsService: ExecutionsService,
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.executionsService.findById(id);
  }

  @Get('workflow/:workflowId')
  async findByWorkflow(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Query() query: QueryExecutionDto,
  ) {
    return this.executionsService.findByWorkflow(workflowId, query);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  async stop(@Param('id', ParseUUIDPipe) id: string) {
    return this.executionsService.stop(id);
  }

  @Post(':id/continue')
  @HttpCode(HttpStatus.OK)
  continueExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { formData?: unknown },
  ) {
    this.executionEngineService.continueExecution(id, body?.formData);
    return { success: true };
  }
}
