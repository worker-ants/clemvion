### 발견사항

- **[INFO]** `node:crypto` 모듈 사용 (shadow-workflow.ts)
  - 위치: `backend/src/modules/workflow-assistant/tools/shadow-workflow.ts`
  - 상세: `randomUUID`를 `node:crypto`에서 직접 import. NestJS 환경에서는 표준이지만, 일부 런타임 격리 환경에서 `node:` 프리픽스 미지원 가능성 있음 (Node 14.18+ 이상 필요)
  - 제안: 기존 코드베이스에서 `crypto.randomUUID()`를 어떻게 사용하는지 확인 후 일관성 유지. Node 16+ 기준이면 문제없음

- **[INFO]** `nanoid` 신규 import (frontend/src/lib/stores/assistant-store.ts)
  - 위치: `import { nanoid } from "nanoid";`
  - 상세: `nanoid`가 기존 프론트엔드 패키지에 이미 포함되어 있는지 확인 필요. 별도 설치가 필요하다면 4.x(ESM only)와 3.x(CJS) 간 버전 호환 이슈 주의
  - 제안: `package.json` 확인 후 이미 포함된 의존성인지 검증. 포함되어 있지 않다면 `Math.random().toString(36)`이나 `crypto.randomUUID()`로 대체 가능하여 번들 추가 없이 처리 가능

- **[WARNING]** 순환 의존성 위험 — lazy import 패턴 (assistant-store.ts)
  - 위치: `assistant-store.ts` 내 `handleSseEvent` 함수
  - 상세: `editor-store`를 동적 `import()`로 lazy 로드하여 모듈 순환 참조를 회피하고 있음. 이는 순환 의존성이 실재함을 의미하며, `assistant-store → editor-store`이면서 `editor-store`도 `applyAssistantOperation`을 통해 어시스턴트 개념에 결합됨
  - 제안: `applyAssistantOperation`을 별도 `workflow-canvas-commands.ts` 유틸로 분리하거나, 이벤트 버스(Zustand 미들웨어 또는 custom event)를 통해 단방향 의존성으로 재설계하는 것이 장기적으로 안전

- **[INFO]** `ExecutionEngineModule` 의존 (workflow-assistant.module.ts)
  - 위치: `WorkflowAssistantModule` imports
  - 상세: `NodeComponentRegistry`를 얻기 위해 `ExecutionEngineModule` 전체를 import. 실행 엔진 모듈이 DB 연결, 큐, 외부 서비스 등 무거운 의존성을 포함한다면 어시스턴트 모듈 경계가 불필요하게 확대됨
  - 제안: `NodeComponentRegistry`만 별도 모듈(`NodeRegistryModule`)로 분리하여 어시스턴트가 실행 엔진 전체에 의존하지 않도록 리팩토링 검토

- **[INFO]** SSE를 위한 native `fetch` + `ReadableStream` 사용 (frontend/src/lib/api/assistant.ts)
  - 위치: `assistantApi.streamMessage`
  - 상세: `EventSource` 대신 `fetch` + `TextDecoderStream`을 사용. 기존 axios(`apiClient`) 인터셉터(토큰 갱신, 에러 처리)를 우회함. 토큰 만료 시 인터셉터 없이 401을 raw error로 처리하게 됨
  - 제안: 토큰 갱신 로직이 axios 인터셉터에만 있다면, `streamMessage`에도 동일한 토큰 만료 처리(재시도 또는 리프레시)를 별도로 구현해야 함

- **[INFO]** `LlmConfigModule` + `LlmModule` 이중 import
  - 위치: `workflow-assistant.module.ts`
  - 상세: 두 모듈 모두 import되어 있는데, `LlmConfigModule`이 `LlmModule`을 내부적으로 re-export한다면 중복 선언임
  - 제안: 각 모듈의 exports 목록 확인 후 불필요한 중복이면 제거

### 요약

이번 변경은 신규 외부 패키지를 최소화하며 기존 `@nestjs`, `typeorm`, `anthropic`, `openai` SDK를 재활용하는 방향으로 설계되어 의존성 관점에서 전반적으로 건전합니다. 가장 주목할 점은 `assistant-store → editor-store` 간의 lazy import로 우회된 순환 의존성으로, 현재는 동작하지만 유지보수 부채가 될 수 있습니다. `nanoid` 추가 여부와 `ExecutionEngineModule` 전체 의존의 비용을 확인하는 것이 권장됩니다. SSE를 위한 native `fetch` 사용은 axios 인터셉터 우회라는 부작용이 있어 토큰 갱신 처리를 명시적으로 보완해야 합니다.

### 위험도

**LOW**