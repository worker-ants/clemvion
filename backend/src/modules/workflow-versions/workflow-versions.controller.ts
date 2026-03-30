import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { WorkflowVersionsService } from './workflow-versions.service';

@Controller('workflows/:wfId/versions')
export class WorkflowVersionsController {
  constructor(
    private readonly workflowVersionsService: WorkflowVersionsService,
  ) {}

  @Get()
  async findByWorkflow(@Param('wfId', ParseUUIDPipe) wfId: string) {
    return this.workflowVersionsService.findByWorkflow(wfId);
  }
}
