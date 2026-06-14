import { Test } from '@nestjs/testing';
import { MetricsModule } from './metrics.module';
import { BusinessMetricsService } from './business-metrics.service';

/**
 * MetricsModule smoke 테스트 (SUMMARY I-8).
 * @Global 설정·provider 등록·export 오류를 조기에 잡는다.
 */
describe('MetricsModule (smoke)', () => {
  it('BusinessMetricsService 가 @Global MetricsModule 을 통해 주입 가능하다', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    const svc = moduleRef.get(BusinessMetricsService);
    expect(svc).toBeDefined();
    expect(svc).toBeInstanceOf(BusinessMetricsService);
  });
});
