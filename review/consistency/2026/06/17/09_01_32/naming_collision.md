# 신규 식별자 충돌 분석

검토 모드: `--impl-done`, scope=`spec/5-system/4-execution-engine.md`, diff-base=`claude/engine-split-s1-nodebootstrap`

대상 신규 파일:
- `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts`

---

## 발견사항

### [CRITICAL] `RehydrationError` 이중 정의 — 동일 디렉터리 내 충돌

- **target 신규 식별자**: `export class RehydrationError` — `/codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts`
- **기존 사용처**: `class RehydrationError` (non-exported) — `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts:348`
- **상세**: `execution-engine.service.ts` 에 `class RehydrationError` 가 동일 모듈-레벨에 정의되어 있으며, 동 파일이 `ai-conversation-helpers.ts` 에서 같은 이름으로 **re-export** 하는 `RehydrationError` 를 import 해 사용하게 된다. 현재 worktree 에서는 `execution-engine.service.ts:136` 이 `ai-conversation-helpers` 에서 `RehydrationError` 를 import 하고, `:141-149` 에서 re-export 한다. 그러나 원본 서비스 파일(`execution-engine.service.ts:348`)의 `class RehydrationError` 선언이 **아직 제거되지 않았는지** 또는 제거됐는지 확인이 필요하다. 만약 두 정의가 동시에 존재한다면 `instanceof` 체크가 런타임에 항상 `false` 를 반환하는 무음 충돌이 발생한다(`err instanceof RehydrationError`). Worktree 기준으로 `execution-engine.service.ts` 에서 기존 `class` 선언이 제거됐고 import 로 대체됐음이 확인되므로, **정의 이중화 자체는 해소된 상태다**. 그러나 `execution-engine.service.spec.ts` 가 `execution-engine.service.ts` 에서 `RehydrationError` 를 import 하고(`execution-engine.service.spec.ts:14562-14769` describe block 등), `ai-turn-orchestrator.service.spec.ts` 가 `ai-conversation-helpers.ts` 에서 같은 이름을 import 한다 — 두 spec 파일이 각각 다른 경로의 "같은 이름" 클래스를 쓰므로, `execution-engine.service.ts` 의 re-export 체인이 끊기면 두 클래스 인스턴스가 달라져 `instanceof` 충돌이 재발한다.
- **제안**: `execution-engine.service.ts` 의 기존 `class RehydrationError` 선언 제거 + `ai-conversation-helpers` import 로의 전환이 완료됐는지 CI 빌드 결과로 검증하라. `RehydrationError` 를 직접 `ai-conversation-helpers` 에서 import 하는 단일 경로를 명시적으로 문서화하고, `execution-engine.service.ts` 의 re-export 가 이 역할을 맡는다는 것을 명확히 해 향후 혼선을 방지하라.

---

### [WARNING] `LlmCallRecord` / `TurnDebugEntry` — 동일 역할 인터페이스가 두 위치에 정의

- **target 신규 식별자**: `interface LlmCallRecord` (private) · `interface TurnDebugEntry` (private) — `/codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts:137-154`
- **기존 사용처**:
  - `interface LlmCallTrace` + `interface TurnDebugEntry` — `/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:74-84`
- **상세**: `ai-conversation-helpers.ts` 의 `LlmCallRecord` 는 `LlmCallTrace`(information-extractor) 와 구조가 유사하다(requestPayload/responsePayload/durationMs 공통). `TurnDebugEntry` 는 두 파일에 동일 이름으로 정의됐지만 필드가 미세하게 다르다: `information-extractor` 의 `TurnDebugEntry.llmCalls` 는 `LlmCallTrace[]` (모든 필드 required), `ai-conversation-helpers` 의 `TurnDebugEntry.llmCalls` 는 `LlmCallRecord[]` (모든 필드 optional). 두 인터페이스가 **같은 이름** 이지만 다른 shape 를 갖고, 두 모듈이 `turnDebugHistory` 키로 같은 런타임 데이터를 다루므로, 향후 shape 변경 시 하나만 갱신되어 silent drift 가 발생할 위험이 있다.
- **제안**: `LlmCallRecord` / `TurnDebugEntry` 를 공유 타입 파일(`shared/execution-resume/` 또는 `shared/llm-debug-types.ts`)로 추출하거나, 최소한 `ai-conversation-helpers.ts` 의 주석에 "information-extractor 의 `LlmCallTrace` / `TurnDebugEntry` 와 의도적으로 분리됐음(optional-vs-required 차이)" 을 명기하라. 중기적으로는 두 정의를 하나로 통합할 것을 권고한다.

---

### [WARNING] helper `describe` 블록 중복 — 두 spec 파일이 동일 함수를 각각 테스트

- **target 신규 식별자**: `describe('buildConversationMetaFromResumeState')` / `describe('buildAiMessageDebugFromResumeState')` / `describe('buildConversationConfigFromOutput')` — `/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:925, 999, 1132`
- **기존 사용처**: 같은 함수를 대상으로 한 describe 블록이 `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:14562, 14636, 14769` 에 이미 존재한다.
- **상세**: `buildConversationMetaFromResumeState` 등 세 함수는 `ai-conversation-helpers.ts` 로 이관됐으나, `execution-engine.service.spec.ts` 의 기존 describe 블록이 **제거되지 않은 채** worktree 에 남아 있다. 함수 구현이 변경되면 두 spec 파일이 모두 업데이트되어야 하고, 어느 한 쪽이 누락되면 false green / silent regression 이 발생한다.
- **제안**: `execution-engine.service.spec.ts` 의 세 describe 블록(`buildConversationMetaFromResumeState`, `buildAiMessageDebugFromResumeState`, `buildConversationConfigFromOutput`)을 제거하고 canonical 테스트를 `ai-turn-orchestrator.service.spec.ts` 한 곳으로 통합하라.

---

### [INFO] `withInteractionMeta` — 비export → export 가시성 변경으로 인한 혼용 주의

- **target 신규 식별자**: `export function withInteractionMeta` — `/codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts:91`
- **기존 사용처**: `function withInteractionMeta` (private, non-exported) — `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts:187` (원본 main 브랜치 기준). Worktree 에서는 import 로 전환됨.
- **상세**: 기존에 비공개였던 함수가 공개 export 로 승격됐다. `execution-engine.service.ts` 가 re-export 체인으로 이를 노출하므로 외부 모듈이 직접 import 할 수 있게 됐다. 현재로선 실제 외부 import 는 없으나, 향후 외부 모듈이 `execution-engine.service` 경유로 이를 import 하면 순환 의존 위험이 발생한다.
- **제안**: `ai-conversation-helpers.ts` 에서 직접 import 하도록 경로를 명확히 하고, `execution-engine.service.ts` 의 re-export 는 하위 호환 목적임을 주석으로 표시하라.

---

## 요약

이번 diff 는 `ai-conversation-helpers.ts` 와 `ai-turn-orchestrator.service.ts` 두 신규 파일을 도입한다. 핵심 식별자 충돌은 두 가지다. 첫째, `RehydrationError` 가 `execution-engine.service.ts` 에 기존 비공개 정의로 남아 있다가 `ai-conversation-helpers.ts` 에 공개 export 로 이관됐는데, worktree 기준 원본 정의가 제거되고 import 로 대체됐음이 확인되므로 충돌은 해소됐으나 두 spec 파일이 각각 다른 경로에서 같은 클래스를 import 하는 구조적 취약성이 남는다. 둘째, `TurnDebugEntry` 인터페이스가 `information-extractor.handler.ts` 와 `ai-conversation-helpers.ts` 두 파일에 동일 이름·유사 구조로 중복 정의되어 향후 schema drift 위험이 있다. 세 개의 helper 함수 describe 블록이 두 spec 파일에 중복으로 존재하는 것은 유지보수 부담 문제다.

## 위험도

MEDIUM
