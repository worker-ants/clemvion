import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ApiOkPaginatedResponse } from '../../common/swagger';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditLogDto } from './dto/responses/audit-log-response.dto';
import { WorkspaceId } from '../../common/decorators';
import { Roles } from '../../common/guards/roles.guard';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  // [Spec Auth §4.2/§5 — 감사 보고 V-03] Admin+ 한정. RolesGuard 가 멤버십+역할을 함께
  // 검증하므로 X-Workspace-Id 위조에 의한 비멤버 열람도 차단된다.
  @Roles('admin')
  @ApiOperation({
    summary: '감사 로그 목록 조회 (Admin+)',
    description:
      '현재 워크스페이스의 감사 로그(Audit Log)를 페이지네이션하여 반환합니다. 액션·리소스 타입·사용자·기간으로 필터링할 수 있습니다. Admin 이상 역할 전용.',
  })
  @ApiOkPaginatedResponse(AuditLogDto, {
    description: '감사 로그 목록 (페이지네이션, 사용자 정보 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '권한 부족 (Admin 미만) 또는 비멤버' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryAuditLogDto,
  ) {
    return this.auditLogsService.findAll(workspaceId, query);
  }
}
