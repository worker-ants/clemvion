import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiOkWrappedResponse } from '../../common/swagger';
import { SystemStatusService } from './system-status.service';
import { SystemStatusOverviewDto } from './dto/system-status-response.dto';

/**
 * 시스템 상태 API — 전체 BullMQ 큐의 집계 카운트·health.
 * 시스템 전역 API 이므로 워크스페이스 스코핑(X-Workspace-Id)을 적용하지 않는다.
 * spec: spec/5-system/16-system-status-api.md
 */
@ApiTags('System Status')
@ApiBearerAuth('access-token')
@Controller('system-status')
export class SystemStatusController {
  constructor(private readonly systemStatusService: SystemStatusService) {}

  @Get('overview')
  @ApiOperation({
    summary: '시스템 상태 개요',
    description:
      '전체 BullMQ 큐의 상태별 집계 카운트, 포화도, 파생 health 를 반환합니다. ' +
      '개별 job·payload 는 노출하지 않으며, 워크스페이스/유저 무관한 시스템 전역 집계입니다. ' +
      'admin role 제한 없음 — 집계 카운트만 반환하므로 민감정보 노출이 구조적으로 불가능하며, 모든 로그인 사용자가 접근 가능한 의도적 설계입니다.',
  })
  @ApiOkWrappedResponse(SystemStatusOverviewDto, {
    description: '시스템 상태 개요',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getOverview(): Promise<SystemStatusOverviewDto> {
    return this.systemStatusService.getOverview();
  }
}
