# 신규 식별자 충돌 검토 결과

## 발견사항

### 1. INFO: `ValidationDetail` 인터페이스 — 같은 이름이 기존 파일에 이미 정의됨 (파일 범위 다름)

- **target 신규 식별자**: `export interface ValidationDetail` — `codebase/backend/src/modules/execution-engine/workflow-errors.ts` 에 새로 추가
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/common/pipes/validation.pipe.ts` 라인 10 에 `interface ValidationDetail { field: string; message: string; code: 'INVALID_FIELD'; }` 가 이미 정의되어 있음 (non-exported, 파일 내부용)
- **상세**: 두 인터페이스는 shape 이 동일(`field/message/code`)하며 모듈 경계가 달라 런타임 충돌은 없다. 그러나 같은 이름의 같은 shape 인터페이스가 두 곳에 분산되어 있어 향후 변경 시 한쪽만 수정하는 drift 위험이 존재한다. `validation.pipe.ts` 의 기존 정의는 `export` 되지 않아 외부 참조가 없으므로 충돌보다는 중복 선언 문제에 해당한다.
- **제안**: `validation.pipe.ts` 내 `interface ValidationDetail` 을 `workflow-errors.ts` 에서 export 되는 `ValidationDetail` 로 교체(import)해 단일 SoT 를 유지하거나, 독립 `common/` 파일로 추출 후 두 파일 모두 import 하는 방안을 검토한다. 현 단계에서 immediate block 은 아니다.

---

### 2. INFO: `W-1` / `W-2` / `W-3` / `W-6` / `W-12` 테스트 라벨 — 같은 파일 또는 인접 파일에서 동일 번호가 다른 맥락으로 사용됨

- **target 신규 식별자**: `describe('assertFormSubmissionValid / coerceFormValue (W-1)')`, `it('W-2 — FormValidationError → 400 BadRequestException')`, `it('W-12 — FormValidationError → ack ...')` — `execution-engine.service.spec.ts`, `executions.controller.spec.ts`, `websocket.gateway.spec.ts` 에 신규 추가
- **기존 사용처**:
  - `W-1`: `execution-engine.service.spec.ts` 라인 14804 에 `"throw 경로: handler 에러 발생해도 unregisterInFlight 는 finally 에서 호출 (W-1 회귀 가드)"` 로 이미 사용됨 (registerInFlight/unregisterInFlight 페어링 주제)
  - `W-2`: `execution-engine.module.ts` 라인 107 에 `// W-2 fix (SUMMARY#W-2): 비숫자 입력 시 NaN 이 graceMs 로 전파` 로 사용됨 (SHUTDOWN_GRACE_MS 주제)
  - `W-3`: `execution-engine.service.spec.ts` 라인 15858 의 `describe('W-3 — emitTerminalExecutionMetrics')` 로 이미 사용됨
  - `W-6`: `execution-engine.service.ts` 라인 817 에 `// (W-6)` 으로 sub-workflow workspace 격리 주제로 사용됨
  - `W-12`: `execution-engine.module.spec.ts` 라인 17 의 `describe('...SHUTDOWN_GRACE_MS factory (W-12)')` 로 이미 사용됨 (SIGTERM_GRACE_MS 주제); `hooks.service.spec.ts` 에도 사용됨
- **상세**: 이들 W-번호는 각 PR/review 세션 고유 번호로 취급되며, 서로 다른 review 세션에서 독립적으로 부여됐을 가능성이 높다. 동일 파일(execution-engine.service.spec.ts) 내에서 `W-1` 이 두 가지 다른 이슈를 가리키게 된다. 테스트 runner 에는 영향이 없으나 코드 내 추적 라벨로서 혼동이 발생한다.
- **제안**: 본 PR 의 W- 번호는 review 세션 내부 임시 식별자로, 코드에 박히는 장기 식별자가 아니라면 경고 수준은 낮다. 그러나 같은 파일에서 같은 번호가 다른 이슈를 가리키는 상황이 실제 발생했으므로, 필요 시 `FV-1` / `FV-2` 등 prefix 로 구분하는 방안을 검토한다.

---

### 3. INFO: `VALIDATION_ERROR` / `INVALID_FIELD` — `ErrorCode` enum 신규 추가이나 이미 string literal 로 광범위하게 사용 중

- **target 신규 식별자**: `ErrorCode.VALIDATION_ERROR = 'VALIDATION_ERROR'`, `ErrorCode.INVALID_FIELD = 'INVALID_FIELD'` — `codebase/backend/src/nodes/core/error-codes.ts` 에 신규 추가
- **기존 사용처**:
  - `VALIDATION_ERROR`: `/Volumes/project/private/clemvion/codebase/backend/src/common/pipes/validation.pipe.ts`, `common/filters/http-exception.filter.ts`, `auth.service.ts`, `triggers.service.ts`, `folders.service.ts`, `edges.service.ts`, `agent-memory.controller.ts` 등 다수 파일에서 string literal `'VALIDATION_ERROR'` 로 이미 직접 사용 중. `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/14-external-interaction-api.md` 등 spec 에서 표준 400 코드로 정의됨.
  - `INVALID_FIELD`: `/Volumes/project/private/clemvion/codebase/backend/src/common/pipes/validation.pipe.ts` 에 `code: 'INVALID_FIELD'` string literal 로 이미 사용 중.
- **상세**: 충돌이 아니라 string literal → enum 상수화다. 두 값(`'VALIDATION_ERROR'`, `'INVALID_FIELD'`)은 기존 string literal 사용처와 의미·값이 동일하므로 의미 충돌 없음. 다만 enum 이 추가된 후에도 기존 코드 대부분이 string literal 을 계속 사용하게 되어 enum 과 literal 이 혼재한다.
- **제안**: 추가된 enum 상수를 기존 string literal 사용처로 점진적으로 교체해 단일 SoT 를 강화할 것을 권장한다. 현재 단계에서 block 은 아니다.

---

### 4. INFO: `VALIDATION_FAILED` 잔류 — spec 및 source 일부에서 `VALIDATION_FAILED` 가 정정되지 않음

- **target 신규 식별자**: `interaction.controller.ts` 의 `@ApiBadRequestResponse` 설명을 `'VALIDATION_FAILED (form field)'` 에서 `'VALIDATION_ERROR (form field — details[])'` 로 변경; `idempotency.interceptor.ts` 주석 내 `VALIDATION_FAILED` 를 `VALIDATION_ERROR` 로 수정
- **기존 사용처**: `spec/conventions/chat-channel-adapter.md` 라인 428·449 에 `"400 VALIDATION_FAILED + fieldErrors"` 잔류; `spec/4-nodes/7-trigger/providers/slack.md` 에 `"EIA 400 VALIDATION_FAILED"` 잔류. `spec/4-nodes/1-logic/9-foreach.md` 의 `VALIDATION_FAILED` 는 별개 맥락(ForEach iteration error code) 이라 무관.
- **상세**: target diff 가 `interaction.controller.ts` 와 `idempotency.interceptor.ts` 의 주석은 수정했으나 chat-channel-adapter 컨벤션 spec 과 slack provider spec 의 `VALIDATION_FAILED` 는 갱신되지 않았다. Chat Channel 어댑터 구현자가 spec 을 참조할 때 실제 구현(`VALIDATION_ERROR`)과 혼동을 유발할 수 있다. 런타임 동작에는 영향 없음.
- **제안**: `spec/conventions/chat-channel-adapter.md` 및 `spec/4-nodes/7-trigger/providers/slack.md` 의 해당 `VALIDATION_FAILED` 를 `VALIDATION_ERROR` 로 정정하는 spec 업데이트를 별도 PR 또는 동일 PR 에 포함한다.

---

### 5. INFO: `FormValidationError` 클래스명 — 기존 네임스페이스에 없는 신규 이름, 충돌 없음

- **target 신규 식별자**: `export class FormValidationError extends ExecutionError` — `workflow-errors.ts` 신규 추가
- **기존 사용처**: `codebase/backend/src/` 전체 검색 결과 `FormValidationError` 라는 이름은 기존에 존재하지 않음. `ExecutionError` 계층(`InvalidExecutionStateError`, `MessageTooLongError`, `RetryLastTurnError` 등)에도 동명 클래스 없음.
- **상세**: 충돌 없음. 신규 이름이 기존 클래스 계층과 명확히 구분된다.
- **제안**: 해당 없음.

---

### 6. INFO: `validateFormSubmission` / `extractFormFields` — cross-module import 패턴은 기존에도 있으나 이미 사용 중인 함수명 재사용

- **target 신규 식별자**: `execution-engine.service.ts` 에서 `import { extractFormFields, validateFormSubmission } from '../chat-channel/shared/form-mode'` 신규 추가
- **기존 사용처**: `chat-channel.dispatcher.ts`, `discord-message.renderer.ts`, `slack-message.renderer.ts` (chat-channel 모듈 내부), `hooks.service.ts` (외부 모듈에서 이미 동일 import 경로 사용 중)
- **상세**: 함수명 자체는 동일하지만 import 경로도 동일하므로 충돌이 아니라 재사용이다. `hooks.service.ts` 가 이미 같은 경로를 cross-module import 하고 있어 패턴 자체는 새롭지 않다. 아키텍처 관심사(함수가 chat-channel 전용 경로에 위치하면서 다수 외부 모듈이 사용)이며 식별자 충돌은 아니다.
- **제안**: 중기적으로 `chat-channel/shared/form-mode.ts` 를 `common/` 또는 `nodes/presentation/form/` 공유 위치로 이동하는 리팩터를 검토한다.

---

## 요약

target diff 가 도입하는 신규 식별자(`FormValidationError`, `ValidationDetail`, `coerceFormSubmission`, `coerceFormValue`, `assertFormSubmissionValid`, `ErrorCode.VALIDATION_ERROR`, `ErrorCode.INVALID_FIELD`) 중 **의미가 다른 기존 식별자와 직접 충돌하는 케이스는 없다**. 주요 관심사는 세 가지다: (1) `ValidationDetail` 인터페이스가 `/Volumes/project/private/clemvion/codebase/backend/src/common/pipes/validation.pipe.ts` 에 동일 shape 으로 이미 비export 선언되어 있어 중복 선언 상태가 발생하며 향후 drift 위험이 존재한다. (2) `chat-channel-adapter.md`·`slack.md` spec 에서 `VALIDATION_FAILED` 문자열이 정리되지 않아 실제 구현(`VALIDATION_ERROR`)과 spec 불일치가 잔류한다. (3) `W-` 번호 라벨이 기존 세션에서 부여된 것과 동일 번호를 재사용해 동일 파일 내 추적성 혼동이 발생한다. 런타임 동작이나 API 계약에 영향을 주는 CRITICAL/WARNING 수준의 충돌은 발견되지 않았다.

## 위험도

LOW
