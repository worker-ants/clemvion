### 발견사항

- **[INFO]** 신규 외부 패키지 없음
  - 위치: 전체 변경 diff
  - 상세: 모든 신규 의존성은 프로젝트 내부 모듈이며, 기존 `@nestjs/common`, `zod` 등 이미 설치된 패키지만 사용한다. `package.json` 변경 없음.
  - 제안: 해당 없음

---

- **[WARNING]** 역방향 레이어 의존성 — `nodes/` → `execution-engine/` 런타임 import
  - 위치: `ai-agent.handler.ts`
    ```ts
    import {
      applyCap,
      renderThreadAsSystemText,
    } from '../../../modules/execution-engine/conversation-thread/thread-renderer';
    ```
  - 상세: `nodes/` 레이어는 통상 `execution-engine`이 호출하는 순수 핸들러 계층이다. 여기서 `thread-renderer.ts`(value import, 런타임 코드)를 역방향으로 import하면 레이어 규약이 깨진다. `import type`으로 처리된 `ConversationThread`, `NodeRef`, `ThreadHolder`는 타입 소거 후 런타임에 남지 않아 문제없지만, `applyCap` / `renderThreadAsSystemText`는 실제 런타임 의존이다.
  - 제안: `conversation-thread.types.ts`와 `thread-renderer.ts`를 `src/shared/conversation-thread/` 같은 공유 계층으로 추출하면 `nodes`와 `execution-engine` 양쪽이 동일 방향으로 참조할 수 있다. 또는 `AiAgentHandler`가 렌더링 로직을 직접 호출하지 않고 `ConversationThreadService`의 메서드로만 상호작용하도록 인터페이스를 좁히는 방법도 있다.

---

- **[WARNING]** 인라인 동적 `import()` 타입 참조
  - 위치:
    - `background-execution.queue.ts`: `import('../conversation-thread/conversation-thread.types').ConversationThread`
    - `node-component.interface.ts`: `import('...conversation-thread.service').ConversationThreadService`
    - `node-handler.interface.ts`: `import('...conversation-thread.types').ConversationThread`
  - 상세: 인라인 `import()` 타입 표현식은 TypeScript가 지원하지만, IDE 리팩토링(rename, find-all-references), `ts-prune` 같은 dead-code 분석, 일부 빌드 도구의 의존성 그래프 추적에서 누락될 수 있다. 특히 `node-handler.interface.ts`의 `ExecutionContext`는 전체 핸들러 계층이 참조하는 핵심 인터페이스이므로 의존성 가시성이 중요하다.
  - 제안: 최소한 `node-handler.interface.ts`는 상단에 `import type { ConversationThread } from '...'`를 사용하도록 변경한다. 나머지 두 파일도 일관성 차원에서 동일하게 처리하는 것을 권장한다.

---

- **[INFO]** 30+ 스펙 파일에 `createEmptyConversationThread` 일괄 import
  - 위치: `*.spec.ts` 전체
  - 상세: `ExecutionContext`에 `conversationThread`가 non-optional 필드로 추가되면서 모든 기존 테스트 픽스처에 보일러플레이트가 추가됐다. 현재는 단일 팩토리 함수(`createEmptyConversationThread()`)를 통일해 사용 중이므로 단일 진실 원칙은 유지된다. 향후 `ConversationThread` 구조가 변경될 때 이 팩토리만 수정하면 전파되므로 구조 자체는 적절하다.
  - 제안: `makeExecutionContext` 헬퍼(`__test__/make-execution-context.ts`)가 이미 `conversationThread` 기본값을 포함하도록 패치되었으므로, 해당 헬퍼를 사용하지 않는 스펙 파일들도 점진적으로 이 헬퍼로 마이그레이션하면 import 중복을 줄일 수 있다.

---

- **[INFO]** `ConversationThreadService` optional 생성자 패턴
  - 위치: `ai-agent.handler.ts` 생성자, `node-component.interface.ts`의 `HandlerDependencies`
  - 상세: 서비스가 `?` optional로 선언되어 있어 테스트 픽스처에서 생략 가능하다. 의도적인 하위 호환 설계이며 `ai-agent.thread.spec.ts`에서 실제 서비스 인스턴스를 주입하는 테스트로 커버되어 있다. 런타임(프로덕션)에서는 `execution-engine.module.ts`가 providers/exports에 등록하므로 누락되지 않는다.
  - 제안: 프로덕션 경로에서 `undefined`로 동작하는 분기(`if (!this.conversationThreadService)`)가 dead code로 남아있지 않도록 향후 v2에서 non-optional로 승격하는 시점을 `spec/conventions/conversation-thread.md`에 명시해두는 것을 권장한다.

---

- **[INFO]** `conversationHistory` deprecated 필드 backward-compat 유지
  - 위치: `ai-agent.schema.ts`
  - 상세: 기존 `conversationHistory` / `maxHistoryCount` 필드에 `deprecated: true` 메타가 추가되고 UI 라벨이 변경됐다. 스키마는 유지되어 기존 워크플로우 설정값이 조용히 무시된다(핸들러가 읽지 않음). 이는 제거 주기를 명시하는 올바른 deprecation 패턴이다.
  - 제안: 제거 일정(`conversation-thread v2`)이 주석에만 있으므로 `plan/` 문서나 spec Rationale 섹션에도 기록해 추적 누락을 방지하길 권장한다.

---

### 요약

이번 변경은 신규 외부 npm 패키지를 전혀 도입하지 않으며, 모든 의존성은 프로젝트 내부 모듈이다. 핵심 위험은 `nodes/ai/ai-agent/` 레이어가 `execution-engine/conversation-thread/thread-renderer`를 런타임 import하는 역방향 레이어 의존으로, 현재 순환 참조는 발생하지 않지만 `nodes`가 `execution-engine` 구현 세부에 직접 결합되어 향후 리팩토링 비용을 높인다. 인라인 `import()` 타입 표현식의 일관성 부재도 툴링 신뢰성 측면에서 개선이 필요하다. 나머지 변경(스펙 픽스처 일괄 패치, NestJS 모듈 등록, optional 서비스 패턴)은 의존성 관점에서 적절하다.

### 위험도

**LOW**