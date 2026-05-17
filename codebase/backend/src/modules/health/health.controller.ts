import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
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

  @Public()
  @Get()
  @ApiOperation({
    summary: '서비스 헬스 체크',
    description:
      '서비스와 외부 의존성(DB, Redis)의 상태를 점검합니다. 인증이 필요하지 않습니다.',
  })
  @ApiOkWrappedResponse(HealthCheckDto, { description: '전체 서비스 상태' })
  @ApiServiceUnavailableResponse({
    description: '의존 서비스 중 하나 이상이 비정상 상태',
  })
  async check() {
    return this.healthService.check();
  }
}
