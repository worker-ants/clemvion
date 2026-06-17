# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` 관련 구현 변경
(diff-base: `claude/engine-split-s1-nodebootstrap`, mode: `--impl-done`)

실제 변경 파일:
- `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts` (신규)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (신규)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` (신규)

---

## 발견사항

### [INFO] 파일 명명 규약 — 완전 준수
- target 위치: 세 신규 파일 모두
- 관련 규약: NestJS 프로젝트 관행 (kebab-case, `.service.ts` / `.spec.ts` / `-helpers.ts` suffix)
- 상세: `ai-conversation-helpers.ts`, `ai-turn-orchestrator.service.ts`, `ai-turn-orchestrator.service.spec.ts` 모두 프로젝트 내 기존 파일 명명 패턴(`execution-engine.service.ts`, `handler-output.adapter.ts` 등)과 일치한다. 위반 없음.

### [INFO] WaitingInteractionType 정의 위치 핀 — 규약 준수
- target 위치: `ai-conversation-helpers.ts` 라인 2, 14; `ai-turn-orchestrator.service.ts` 라인 1699
- 관련 규약: `spec/conventions/interaction-type-registry.md §1.1`
- 상세: `WaitingInteractionType` 은 `execution-engine.service.ts` 에 정의를 핀하고 두 신규 파일 모두 `import type` (런타임 소거) 으로만 참조한다. §1.1 "Backend 단일 진실 위치" 요건을 정확히 충족한다.

### [INFO] `source: 'live' | 'injected'` 마커 규약 — 준수
- target 위치: `ai-conversation-helpers.ts` `withSourceMarker` 함수 (라인 209-218), `buildConversationConfigFromOutput` (라인 268)
- 관련 규약: `spec/5-system/6-websocket-protocol.md §4.4.6`
- 상세: 시스템 메시지 필터링 후 비-시스템 메시지에 `source: 'live'` 를 backfill 하고, 이미 `'injected'` / `'live'` 로 마킹된 메시지는 보존하는 패턴이 §4.4.6 계약과 정합한다. 테스트(`buildConversationConfigFromOutput` describe 블록)도 `injected` 보존·`live` backfill·이중 wrap 방지를 커버한다.

### [INFO] `output.error.details.retryable` 불변식 — 준수
- target 위치: `ai-turn-orchestrator.service.spec.ts` 라인 556-564 (`retryable=false 면 retryAfterSec 미동봉 invariant` 테스트)
- 관련 규약: `spec/conventions/node-output.md §3.2.1`
- 상세: `retryable === false` 시 `retryAfterSec` 를 동봉하지 않는 invariant 가 테스트로 검증된다. §3.2.1 의 "retryAfterSec invariant: `retryable === true` 일 때만 set 가능" 을 정확히 가드한다.

### [WARNING] `LLM_API_ERROR` — 미등록 에러 코드의 passthrough 허용
- target 위치: `ai-turn-orchestrator.service.spec.ts` 라인 408-421; `ai-turn-orchestrator.service.ts` `classifyLlmError` 라인 1073-1074
- 관련 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명), `spec/conventions/node-output.md §3.2` (`code` 는 `UPPER_SNAKE_CASE`)
- 상세: `classifyLlmError` 의 fallback 경로 `if (typeof explicitCode === 'string' && explicitCode.length > 0) { return { code: explicitCode, retryable: false }; }` 는 임의의 미등록 코드(예: `LLM_API_ERROR`)를 `output.error.code` 로 그대로 emit 할 수 있다. `LLM_API_ERROR` 는 `codebase/backend/src/nodes/core/error-codes.ts` 에 등록되지 않은 코드다. 테스트 케이스 `'details 필드를 포함한 오류를 처리한다'` 는 `result.code` 를 검증하지 않아, `LLM_API_ERROR` 가 실제 output 에 노출될 때 명명 규약(`error-codes.md §1`, `§2 안정성`) 통제를 벗어난다.
- 제안: (a) 테스트에 `expect(result.code).toBe('LLM_CALL_FAILED')` 어서션을 추가해 `LLM_API_ERROR` 가 `LLM_CALL_FAILED` 로 정규화됨을 명시 검증하거나, (b) `classifyLlmError` 의 "명시 code passthrough" 경로를 `error-codes.ts` 등록 코드 whitelist 로 제한하고 미등록 코드는 `LLM_CALL_FAILED` fallback 으로 내린다. 규약 갱신 없이 구현 레벨에서 해결 가능.

### [INFO] `LLM_CONNECTION_ERROR` 처리 — 규약 내 정규화
- target 위치: `ai-turn-orchestrator.service.ts` `classifyLlmError` 라인 1058-1059; 테스트 라인 529-537
- 관련 규약: `spec/conventions/error-codes.md §4` (내부 전용 분류 코드 정규화)
- 상세: `LLM_CONNECTION_ERROR` 는 client SSE 레이어 레거시 코드로, `classifyLlmError` 가 `LLM_CALL_FAILED (retryable=true)` 로 정규화하며 테스트도 이를 명시 검증한다. `error-codes.md §4` 의 내부 분류 → public 코드 정규화 패턴과 일치한다.

### [INFO] `RehydrationError` 코드 — 엔진 내부 에러 (클라이언트 미노출)
- target 위치: `ai-conversation-helpers.ts` 라인 69-80 (`RehydrationError` class)
- 관련 규약: `spec/conventions/error-codes.md §4` (내부 전용 분류 코드)
- 상세: `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 는 엔진 내부 재수화 분기 코드로, `output.error.code` 로 직접 클라이언트에 발행되지 않는다 (엔진 dead-letter 마킹용). `error-codes.md §4` 의 "클라이언트 미노출 내부 분류 코드" 에 해당하며 `UPPER_SNAKE_CASE` 형식을 준수한다. 위반 없음.

### [INFO] `buildConversationConfigFromOutput` 의 `maxTurns` — Principle 1.1 준수
- target 위치: `ai-conversation-helpers.ts` 라인 232-273; 테스트 라인 1554-1565
- 관련 규약: `spec/conventions/node-output.md §1.1` (config ↔ output 직교성)
- 상세: `maxTurns` 를 `output.result` 에서 읽지 않고 config echo (두 번째 인자) 에서만 읽는 결정(decision C-1)이 구현 및 테스트에서 모두 적용되어 있다. Principle 1.1 "config 리터럴 값은 output 에 echo 금지" 를 준수한다.

### [INFO] `output.partial.*` 필드 선택 전파 — Principle 0 / 4.3 준수
- target 위치: `ai-conversation-helpers.ts` `buildConversationConfigFromOutput` 라인 279-285
- 관련 규약: `spec/conventions/node-output.md Principle 4.3`
- 상세: `partial.extracted` / `partial.missingFields` / `partial.collectionRetryCount` 를 `undefined` 여부 검사 후 선택적으로 전파하여, 키 오염(key pollution)을 방지한다. Principle 4.3 의 `information_extractor` multi-turn `output.partial?` 계약을 준수한다.

### [INFO] 문서 구조 규약 — spec 문서(target) 자체는 이번 diff 에 미포함
- target 위치: `spec/5-system/4-execution-engine.md`
- 관련 규약: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
- 상세: 검토 모드가 `--impl-done` 으로 구현 변경에 집중하며, `spec/5-system/4-execution-engine.md` 의 문서 구조는 이번 diff 의 직접 변경 대상이 아니다. 3섹션 구조 준수 여부는 spec 문서 자체가 수정될 때 검토한다.

---

## 요약

세 신규 파일(`ai-conversation-helpers.ts`, `ai-turn-orchestrator.service.ts`, `ai-turn-orchestrator.service.spec.ts`)은 전반적으로 정식 규약을 잘 준수한다. `WaitingInteractionType` 단일 진실 위치 핀(`interaction-type-registry.md §1.1`), `source` 마커 계약(`ws-protocol §4.4.6`), `retryable`/`retryAfterSec` invariant(`node-output.md §3.2.1`), config echo 직교성(Principle 1.1)이 모두 구현·테스트 양면에서 충족된다. 유일한 주의 사항은 `classifyLlmError` 의 "명시 code passthrough" 경로가 `error-codes.ts` 미등록 코드(`LLM_API_ERROR`)를 그대로 `output.error.code` 로 emit 할 수 있으며, 이를 검증하는 테스트 어서션이 누락되어 있다는 점이다 (WARNING 1건). 이는 naming-stability 규율(`error-codes.md §1·§2`)을 벗어날 수 있어 테스트 보강 또는 whitelist 제한이 권장된다.

---

## 위험도

LOW
