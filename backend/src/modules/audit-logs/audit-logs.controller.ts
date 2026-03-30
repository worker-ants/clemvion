import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { WorkspaceId } from '../../common/decorators';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryAuditLogDto,
  ) {
    return this.auditLogsService.findAll(workspaceId, query);
  }
}
