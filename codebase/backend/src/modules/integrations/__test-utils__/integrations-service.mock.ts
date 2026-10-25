import type { Integration } from '../entities/integration.entity';
import type { IntegrationsService } from '../integrations.service';
import type { IntegrationUse } from '../personal-integration-use';

/*
 * 실행 경로(통합 노드 핸들러 · 도구 프로바이더 · 실행 엔진) 테스트가 쓰는 `IntegrationsService` 대역.
 *
 * 인자 타입을 실제 서명에서 가져온다. `getForExecution` 의 서명이 바뀌면 이 대역을 쓰는 테스트의 호출 · 단언이 타입체크
 * ratchet(`scripts/check-backend-typecheck-ratchet.py`)에 걸린다. jest 는 타입을 지우므로 테스트마다 `jest.fn()` 을
 * 따로 만들면 옛 서명으로 단언해도 아무도 모른다. `use` 는 필수 인자다(CLE-NODE-INT-COMMON 「IntegrationsService API
 * (실행 엔진용)」).
 */

export interface IntegrationsServiceMock {
  getForExecution: jest.Mock<
    Promise<Integration>,
    Parameters<IntegrationsService['getForExecution']>
  >;
  logUsage: jest.Mock<
    Promise<void>,
    Parameters<IntegrationsService['logUsage']>
  >;
}

export function makeIntegrationsServiceMock(): IntegrationsServiceMock {
  return {
    getForExecution: jest.fn<
      Promise<Integration>,
      Parameters<IntegrationsService['getForExecution']>
    >(),
    logUsage: jest
      .fn<Promise<void>, Parameters<IntegrationsService['logUsage']>>()
      .mockResolvedValue(undefined),
  };
}

/** 대역을 실제 서비스 자리에 넘긴다. 대역에 없는 메서드를 부르면 테스트가 TypeError 로 실패한다. */
export function asIntegrationsService(
  mock: IntegrationsServiceMock,
): IntegrationsService {
  return mock as unknown as IntegrationsService;
}

/** 리터럴 참조(평가 전 원본과 같은 문자열)를 단 노드의 `use`. */
export function literalUse(nodeId: string | null): IntegrationUse {
  return { nodeId, fromExpression: false };
}
