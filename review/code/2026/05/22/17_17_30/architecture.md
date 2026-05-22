# 아키텍처(Architecture) 코드 리뷰 결과

**대상**: AI Agent presentation tool family (`render_*`) — 27개 파일
**검토 일시**: 2026-05-22
**검토 유형**: 아키텍처 관점

---

## 발견사항

### 1. PresentationType 이중 정의 — 단일 진실 원칙 위반

- **[WARNING]** `PresentationType` 유니언 타입이 백엔드와 프론트엔드에 각각 별도로 정의됨
  - 위치:
    - 백엔드: `/codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` L36-42
    - 프론트엔드: `/codebase/frontend/src/lib/conversation/conversation-utils.ts` L52-59
  - 상세: 동일 도메인 개념인 `PresentationType = 'table' | 'chart' | 'carousel' | 'template' | 'form'` 이 두 곳에 별도로 정의되어 있다. 또한 백엔드 `ai-agent.schema.ts` 에는 `PRESENTATION_TOOL_TYPES` 배열 상수 및 `PresentationToolType` 파생 타입이 추가로 존재해 동일 개념을 세 위치에서 관리하는 구조가 된다. 셋 중 하나라도 새 type 을 추가(예: `video`, `map`)할 때 나머지 둘을 동기적으로 수동 갱신해야 하며, TS 컴파일러는 이를 감지하지 못한다. 프론트-백 공유 타입 패키지(`codebase/packages/`)가 있다면 단일 소스로 이동할 수 있다.
  - 제안: `PRESENTATION_TOOL_TYPES` 상수(배열 as const)를 `shared/conversation-thread/conversation-thread.types.ts` 에 단일 정의하고, `PresentationToolType` / `PresentationType` 을 이 배열에서 파생하도록 통일한다. `ai-agent.schema.ts` 는 공유 모듈을 import 하여 `z.enum(PRESENTATION_TOOL_TYPES)` 로 구성한다.

---

### 2. 레이어 경계 위반 — AI 노드가 Presentation 노드 스키마를 직접 import

- **[WARNING]** `render-tool-provider.ts` 가 5종 presentation 노드의 zod schema 를 직접 import
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` L7-11
  - 상세: `nodes/ai` 레이어가 `nodes/presentation/{table,chart,carousel,template,form}` 레이어를 직접 참조한다. 형제 노드 레이어 간 직접 import 는 모듈 경계를 약화시킨다. Presentation 노드의 내부 schema 변경이 AI 노드 컴파일/런타임에 직접 영향을 미치며, 두 레이어의 변경 주기가 결합된다. 현재는 단방향이라 순환 의존이 없으나 (역방향 import 없음 확인), 향후 presentation 노드가 AI 관련 타입을 역으로 참조하게 되는 실수를 허용하는 구조다.
  - 제안: Presentation 노드별 schema 를 `nodes/presentation/_shared/schemas/index.ts` 또는 별도 패키지(`@project/presentation-schemas`)로 올려서 양측이 공통 하위 레이어를 참조하도록 아키텍처를 정렬한다. 이렇게 하면 AI 레이어와 Presentation 레이어가 동등한 위치에서 공유 schema 를 참조하는 구조가 된다.

---

### 3. execution-store 에서의 re-export 패턴 — 잘못된 추상화 경계

- **[WARNING]** `execution-store.ts` 가 `conversation-utils.ts` 의 타입을 re-export
  - 위치: `/codebase/frontend/src/lib/stores/execution-store.ts` L63-74
  - 상세: 스토어 파일은 상태 관리 책임을 가진다. 타입 정의의 소스를 re-export 하는 책임까지 추가하면 단일 책임 원칙에 위배된다. 주석에 "Re-exported from conversation-utils so legacy imports resolve here" 라고 명시되어 있어 레거시 호환을 위한 임시 조치임을 나타내지만, 이런 패턴이 장기화되면 의존 방향이 불명확해진다. `PresentationPayload` 를 사용하는 컴포넌트 중 일부는 `execution-store` 에서, 일부는 `conversation-utils` 에서 직접 import 하게 되어 일관성이 없다. 실제로 `assistant-presentations-block.tsx` 는 `conversation-utils` 에서 직접 import 하는 반면 `execution-store.ts` 는 re-export 경로를 유지하고 있다.
  - 제안: 레거시 import 경로를 일괄 마이그레이션하고 re-export 를 제거한다. 또는 공식적인 "barrel" 모듈을 명시적으로 설계하여 어느 경로를 정식으로 사용할지 명확히 한다.

---

### 4. `AgentToolResult` 인터페이스 비대화 — ISP 위반

- **[INFO]** `AgentToolResult` 가 `render_*` 전용 4개 필드를 수용하면서 인터페이스 비대화
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts` L111-380
  - 상세: `presentationPayload`, `blockingFormRender`, `presentationSchemaViolation`, `presentationCall` 네 필드가 모두 `render_*` 전용이며 다른 provider(KB, MCP, 조건) 에서는 절대 set 되지 않는다. 인터페이스 분리 원칙 관점에서 `render_*` 전용 관심사가 공용 결과 인터페이스에 누적되고 있다. 현재는 5개 provider 가 있고 추후 `tool_*` (일반 도구) provider 가 추가되면 이 인터페이스가 더 비대해질 가능성이 있다.
  - 제안: `AgentToolResult` 와 별개인 `RenderToolResult extends AgentToolResult` discriminated union 을 도입하거나, presentation 전용 필드를 `presentationMeta?: { payload?, formRender?, violation?, call? }` 처럼 하나의 선택적 네임스페이스 필드로 그루핑하면 인터페이스 오염을 제한할 수 있다. 단, 현재 코드량이 많지 않고 handler 에서 해당 필드를 직접 참조하는 패턴이 정착되어 있어 당장의 리스크는 낮다.

---

### 5. `jsonSchemaCache` 모듈 수준 가변 전역 상태 — 확장성 주의

- **[INFO]** `render-tool-provider.ts` 의 `jsonSchemaCache` 가 모듈 수준 가변 객체
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` L88-97
  - 상세: `const jsonSchemaCache: Partial<Record<PresentationType, Record<string, unknown>>> = {}` 는 모듈이 로드될 때 한 번 생성되고 이후 변경된다. 현재 구조에서는 `zod` schema 가 런타임에 변하지 않으므로 실질적 문제는 없다. 그러나 멀티 테넌트 환경에서 schema 가 워크스페이스별로 달라지거나 테스트 격리가 필요한 상황에서 전역 가변 상태가 문제가 될 수 있다. `RenderToolProvider` 인스턴스가 하나이므로 인스턴스 필드로 격리 가능하다.
  - 제안: `private readonly jsonSchemaCache` 를 `RenderToolProvider` 인스턴스 필드로 이동한다. 기능 차이는 없지만 테스트 격리와 인스턴스 수명주기 관리가 명확해진다.

---

### 6. `PresentationItem` 컴포넌트의 `default: return null` — 타입 안전성 갭

- **[INFO]** `assistant-presentations-block.tsx` 의 switch 문에 `default: return null` 이 TypeScript 타입 좁힘을 우회
  - 위치: `/codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` L56-73
  - 상세: `PresentationPayload.type` 은 `PresentationType` 유니언으로 완전히 열거되어 있으므로 switch 는 이미 모든 케이스를 커버하고 있다. `default: return null` 은 불가능한 케이스를 처리하는 것처럼 보이지만, 향후 backend 에서 새 type 이 추가되고 frontend 타입 정의 갱신이 누락되면 silently 아무것도 렌더하지 않는 조용한 실패가 발생한다. 이는 두 번째 발견사항(이중 정의)과 연동된다.
  - 제안: `default` 케이스를 `satisfies never` exhaustive check 로 교체하거나, 타입 정의가 단일화된 이후 `never` 단언을 추가하여 새 type 추가 시 컴파일 오류로 명시적 실패를 유도한다.

---

### 7. `overlayDefaults` 의 `defaults === null` 처리 누락

- **[INFO]** `overlayDefaults` 함수가 `defaults === null` 케이스를 처리하지 않음
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` L107-132
  - 상세: 함수 시그니처는 `defaults: unknown` 을 받는다. `defaults === undefined` 는 첫 줄에서 처리되어 llmPayload 를 반환하지만, `defaults === null` 은 처리되지 않아 `typeof defaults === 'object'` 분기에서 null 체크 (`defaults !== null`) 에 걸려 최하단 `return defaults` (즉 null 반환)로 떨어진다. 사용자가 JSON 편집기에서 `defaults: null` 을 입력한 경우 LLM 페이로드 전체가 null 로 덮어씌워지는 예상치 못한 동작이 발생한다.
  - 제안: `if (defaults === undefined || defaults === null) return llmPayload;` 로 첫 줄을 확장한다.

---

## 요약

이번 변경은 `AgentToolProvider` 추상화를 기반으로 `RenderToolProvider` 를 추가하는 Open/Closed 원칙에 충실한 설계로, 기존 KB/MCP provider 구조를 깔끔하게 확장한다. Provider 패턴, prefix-based dispatch, zod schema 재사용, tail-truncate 정책 등 핵심 아키텍처 결정은 적절하다. 다만 `PresentationType` 이 백엔드 shared 타입, schema 상수, 프론트엔드 conversation-utils 세 곳에 분산 정의된 점은 향후 5종 이외의 presentation type 추가 시 동기화 실패 위험이 존재한다. 또한 `render-tool-provider.ts` 가 형제 레이어인 presentation 노드 schema 를 직접 import 하는 구조는 presentation 노드 레이어와의 경계를 약화시킨다. `execution-store` re-export 패턴은 단기 레거시 호환 목적으로 이해되나 공식화되지 않은 채로 방치되면 의존 방향을 혼란스럽게 만든다. `overlayDefaults` 의 `null` 처리 누락은 낮지만 실용적인 버그 위험이다. 전반적으로 구조 자체는 견고하며 위험도가 낮은 편이나, 타입 단일화와 레이어 경계 정리를 로드맵에 반영하는 것이 확장성 관점에서 권장된다.

---

## 위험도

LOW

> 즉각적인 런타임 오류를 유발하는 구조적 결함은 없다. `PresentationType` 이중 정의와 레이어 경계 위반은 현재보다 더 많은 presentation type 이 추가될 때 기술 부채가 누적되는 패턴이며, `overlayDefaults null` 처리 누락은 엣지 케이스 버그 가능성이 있다.
