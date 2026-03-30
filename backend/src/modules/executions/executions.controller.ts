import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { QueryExecutionDto } from './dto/query-execution.dto';

@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

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
}
