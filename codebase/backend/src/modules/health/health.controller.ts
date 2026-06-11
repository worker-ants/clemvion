import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ApiOkWrappedResponse } from '../../common/swagger';
import { HealthService } from './health.service';
import {
  HealthCheckDto,
  HealthCheckItemDto,
} from './dto/responses/health-response.dto';
import { ApiExtraModels } from '@nestjs/swagger';
import { Public } from '../../common/decorators';

@ApiTags('Health')
@ApiExtraModels(HealthCheckItemDto)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Readiness probe (spec/data-flow/9-observability.md §1.1).
   *
   * DB·Redis 의존성을 점검해 정상이면 200, 하나라도 비정상이면 503 을 반환한다.
   * 503 일 때도 응답 body(`{ status, version, uptime, checks }`)는 그대로 유지된다
   * — throw 가 아닌 응답 status 설정(`@Res({ passthrough: true })`)이라
   * GlobalExceptionFilter 의 `{ error: {...} }` shape 로 변형되지 않는다.
   * k8s readinessProbe 가 이 경로를 쓴다 (의존성 장애 시 503 → Service 에서 제외).
   */
  @Public()
  @Get()
  @ApiOperation({
    summary: '서비스 헬스 체크 (readiness)',
    description:
      '서비스와 외부 의존성(DB, Redis)의 상태를 점검합니다. 정상이면 200, 하나 이상 비정상이면 503 을 반환합니다. 인증이 필요하지 않습니다.',
  })
  @ApiOkWrappedResponse(HealthCheckDto, {
    description: '전체 서비스 상태 (healthy)',
  })
  @ApiServiceUnavailableResponse({
    type: HealthCheckDto,
    description:
      '의존 서비스 중 하나 이상이 비정상 상태 (unhealthy) — body 구조는 200 과 동일',
  })
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.check();
    res.status(
      result.status === 'healthy'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return result;
  }

  /**
   * Liveness probe (spec/data-flow/9-observability.md §1.1).
   *
   * 의존성(DB/Redis)을 점검하지 않고 프로세스 생존만 확인해 항상 200 을 반환한다.
   * liveness 가 외부 의존성을 검사하면 DB 장애 시 전 replica 가 동시 재시작되는
   * 크래시루프 위험이 있어, 의존성 점검은 readiness(`/api/health`)에만 둔다.
   */
  @Public()
  @Get('live')
  @ApiOperation({
    summary: '서비스 생존 확인 (liveness)',
    description:
      '의존성을 점검하지 않고 프로세스 생존만 확인합니다. 항상 200 을 반환합니다. 인증이 필요하지 않습니다.',
  })
  @ApiOkResponse({
    description: '프로세스 생존',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
      required: ['status'],
    },
  })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
