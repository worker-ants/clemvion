import { Global, Module } from '@nestjs/common';
import { BusinessMetricsService } from './business-metrics.service';

/**
 * NF-OB-07 도메인 메트릭. `@Global` 이라 어느 모듈이든 `BusinessMetricsService` 를
 * 추가 import 없이 주입할 수 있다 (execution-engine·llm·continuation 등 계측 지점 분산).
 */
@Global()
@Module({
  providers: [BusinessMetricsService],
  exports: [BusinessMetricsService],
})
export class MetricsModule {}
