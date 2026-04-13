import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../../common/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: '서비스 헬스 체크',
    description:
      '서비스와 외부 의존성(DB, Redis)의 상태를 점검합니다. 인증이 필요하지 않습니다.',
  })
  @ApiOkResponse({
    description: '전체 서비스 상태',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
            version: { type: 'string', example: '1.0.0' },
            uptime: {
              type: 'integer',
              description: '서비스 기동 후 경과 시간(초)',
            },
            checks: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['healthy', 'unhealthy'] },
                  latency: {
                    type: 'integer',
                    description: '체크 소요 시간(ms)',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: '의존 서비스 중 하나 이상이 비정상 상태',
  })
  async check() {
    return this.healthService.check();
  }
}
