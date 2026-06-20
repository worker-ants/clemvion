import { Test } from '@nestjs/testing';
import { NodeComponentsModule } from './node-components.module';
import { NODE_COMPONENT, NodeComponent } from './core/node-component.interface';
import { ALL_NODE_COMPONENTS } from './index';

// 토큰 값은 주입으로만 신뢰성 있게 꺼낼 수 있어, NODE_COMPONENT 를 주입받아 그대로
// 노출하는 probe provider 로 검증한다 (NodeBootstrapService 의 주입 경로와 동일).
const PROBE = Symbol('NODE_COMPONENT_PROBE');

describe('NodeComponentsModule', () => {
  it('NODE_COMPONENT 으로 빌트인 노드 카탈로그 전수를 주입한다 (DI 배선 + 정적 spread 동등)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [NodeComponentsModule],
      providers: [
        {
          provide: PROBE,
          inject: [NODE_COMPONENT],
          useFactory: (components: NodeComponent[]) => components,
        },
      ],
    }).compile();

    const injected = moduleRef.get<NodeComponent[]>(PROBE);

    // NodeBootstrapService 가 주입받는 것과 동일 — 빌트인 카탈로그 배열이어야 한다.
    expect(Array.isArray(injected)).toBe(true);
    expect(injected).toHaveLength(ALL_NODE_COMPONENTS.length);

    // DI 주입 카탈로그와 정적 spread 집합이 정확히 일치 (등록 누락/오염 가드).
    const injectedTypes = new Set(injected.map((c) => c.metadata.type));
    const staticTypes = new Set(
      ALL_NODE_COMPONENTS.map((c) => c.metadata.type),
    );
    expect(injectedTypes).toEqual(staticTypes);
    expect(injectedTypes.size).toBe(injected.length); // 중복 type 없음

    await moduleRef.close();
  });
});
