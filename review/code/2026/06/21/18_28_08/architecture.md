# Architecture Review

## 발견사항

- **[INFO]** `AiConditionEvaluator` 가 클래스로 구현됐으나 내부 상태가 전혀 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 전체
  - 상세: 모든 메서드가 순수 입출력 함수이며, 클래스 필드(인스턴스 상태)가 없다. 클래스를 쓰는 유일한 이유는 `private readonly conditionEvaluator = new AiConditionEvaluator()` 형태의 collaborator 주입 패턴을 채택했기 때문이다. 무상태 객체이므로 `export const conditionEvaluator = new AiConditionEvaluator()` 싱글턴 또는 순수 함수 네임스페이스로도 충분하나, 미래 NestJS DI 통합이나 하위 단계(`ai/shared/` 승격) 시 클래스 구조가 더 유연하다. 현행 계획상 허용 범위이므로 차단 불필요.
  - 제안: 다음 분할 단계(`ai/shared/` 승격)에서 NestJS `@Injectable()`로 전환하거나 모듈 스코프 싱글턴으로 격상하면 DI 이점을 얻을 수 있다.

- **[INFO]** `AiConditionEvaluator` 가 `AgentToolProvider` 인터페이스를 직접 import — `tool-providers/` 내부 경계 노출
  - 위치: `ai-condition-evaluator.ts` 라인 4 (`import { AgentToolProvider } from './tool-providers/agent-tool-provider.interface'`)
  - 상세: `classifyToolCalls` 가 `toolProviders: AgentToolProvider[]` 를 인자로 받아 무상태를 유지하는 설계는 올바르다. 단, `ConditionClassification.providerToolCalls` 반환 타입에 `AgentToolProvider` 가 포함되어 있어, `AiConditionEvaluator` 의 공개 인터페이스가 provider 도메인에 직접 의존한다. 현재 같은 `ai-agent/` 내부이므로 순환이나 레이어 위반은 없으나, 향후 `ai/shared/` 승격 시 provider 역참조가 생길 수 있다.
  - 제안: 승격 시점에 `ConditionClassification.providerToolCalls` 를 `{ providerKey: string; call: ToolCall }[]` 처럼 provider 인터페이스를 분리한 형태로 re-typing 을 검토한다. 현재 단계에서는 변경 불필요.

- **[INFO]** `AiAgentHandler` 에서 `conditionEvaluator` 가 `private readonly` 필드로 직접 instantiate — DI 없이 하드코딩
  - 위치: `ai-agent.handler.ts` 라인 118 (`private readonly conditionEvaluator = new AiConditionEvaluator()`)
  - 상세: 무상태 collaborator 이므로 테스트 격리 필요성이 낮고, 현재 단위 테스트가 `AiConditionEvaluator` 를 직접 인스턴스화해 검증하므로 실용적 문제는 없다. 그러나 DIP(의존성 역전) 관점에서 외부에서 주입 가능한 형태(`constructor`로 받거나 NestJS DI)가 더 엄격하다.
  - 제안: 2단계 이후 NestJS 모듈로 격상할 때 `@Inject()` 로 전환. 현재 단계에서는 허용.

- **[INFO]** `condToolName` 이 모듈 수준 자유 함수로 export 되면서 클래스 외부에서도 직접 호출 가능 — 표면적 API 확산
  - 위치: `ai-condition-evaluator.ts` 라인 191 (`export function condToolName(...)`)
  - 상세: 테스트에서 `condToolName` 을 직접 import 해 검증하므로 export 가 필요하다. 클래스 내부 static 메서드로도 구현 가능하나, 현행 구조가 명시적이고 테스트 접근성이 높다.
  - 제안: 취향 차이 수준. 현행 방식도 문제없음.

## 요약

이번 변경은 3,400줄 god-handler(`AiAgentHandler`)의 점진적 분해 1단계로, 조건 평가 로직을 무상태 collaborator `AiConditionEvaluator`로 추출하는 behavior-preserving 리팩토링이다. SOLID 관점에서 단일 책임 분리가 명확히 개선됐으며(`AiConditionEvaluator`는 조건 도메인만 담당), 개방-폐쇄를 위한 인터페이스 추상화는 차기 단계로 적절히 유보됐다. `toolProviders` 의존을 인자로 주입받아 클래스 자체의 무상태를 보장한 설계는 결합도 최소화 의도에 부합한다. 모듈 경계는 `nodes/ai/ai-agent/` 내 co-location 으로 유지됐고, 순환 의존성은 없다. 미래 `ai/shared/` 승격 시 `AgentToolProvider` 역참조 및 DI 전환이 추가 검토 필요한 유일한 아키텍처 잔여 부채이나, 현 단계에서는 허용 범위다. 17케이스 단위 테스트 신설로 추출 로직의 회귀 격리가 확보됐다.

## 위험도

NONE
