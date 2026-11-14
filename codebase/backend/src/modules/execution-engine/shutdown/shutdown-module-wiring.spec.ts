import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule } from '@nestjs/core';
import { ExecutionEngineModule } from '../execution-engine.module';

describe('ExecutionEngineModule — 안전 종료 배선', () => {
  it('DiscoveryModule 을 import 한다 (ShutdownStateService 가 워커를 찾는 데 쓴다)', () => {
    // ShutdownStateService 는 DiscoveryService 를 선택 주입으로 받는다.
    // import 가 빠지면 DI 는 통과하지만 워커 pause · 강제 close 가 조용히 사라진다.
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      ExecutionEngineModule,
    ) as unknown[];
    expect(imports).toContain(DiscoveryModule);
  });
});
