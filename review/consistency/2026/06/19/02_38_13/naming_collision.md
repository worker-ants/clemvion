# 신규 식별자 충돌 검토 — naming_collision

검토 모드: `--impl-prep`
대상 문서: `spec/5-system/4-execution-engine.md`

---

## 발견사항

### 신규 도입 식별자 없음 (INFO)

target 문서 payload 의 "구현 대상 영역" 섹션이 `(없음)` 으로 명시되어 있다. 즉 `spec/5-system/4-execution-engine.md` 는 이번 impl-prep 검토에서 **새 식별자를 도입하지 않는다** — 기존 spec 의 구현 착수 전 사전 점검이다.

본 검토는 해당 spec 이 이미 정의하고 있는 식별자들이 기존 코퍼스(다른 spec, 코드, 컨벤션)와 충돌하는지 교차 확인한다.

---

### [INFO] `EXECUTION_TIMEOUT` 동명 이중 레이어 — 기존 등록 artifact

- **식별자**: `EXECUTION_TIMEOUT`
- **기존 사용처 1**: `spec/5-system/4-execution-engine.md §7.5.2` 및 `spec/5-system/3-error-handling.md §1.4` — EIA `execution.failed.error.code` 로 발행되는 엔진 레벨 코드 (Code 노드 스크립트 실행 타임아웃을 `failed` 로 격상 시)
- **기존 사용처 2**: `spec/conventions/error-codes.md §4` — Code 노드 핸들러 **내부** 분류 문자열 (클라이언트 미노출, `CODE_TIMEOUT` 으로 정규화 후 발행)
- **상세**: 동명 코드가 두 레이어(내부 핸들러 분류 vs 엔진 레벨 EIA 발행)에 걸쳐 있어 혼동 가능성이 있으나, 이는 `spec/conventions/error-codes.md §4` 의 "레이어 주의" 주석에 **이미 명시·등록**된 known artifact 다. 신규 충돌이 아니다.
- **제안**: 현행 유지. 이미 컨벤션 SoT 에 등록되어 있으므로 추가 조치 불필요.

---

### [INFO] `EXECUTION_INTERNAL_ERROR` / `EXECUTION_MESSAGE_TOO_LONG` — 이미 구현 완료, 충돌 없음

- **식별자**: `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`
- **spec 정의 위치**: `spec/5-system/4-execution-engine.md §7.5.2`; `spec/5-system/6-websocket-protocol.md §4.2`
- **코드 구현 위치**: `codebase/backend/src/nodes/core/error-codes.ts` (ErrorCode enum 값), `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (`MessageTooLongError extends ExecutionError`)
- **프론트엔드 위치**: `codebase/frontend/src/lib/websocket/execution-error-codes.ts` (i18n 매핑 완료)
- **상세**: 두 코드 모두 spec·backend·frontend 가 이미 정합 상태다. 다른 의미로 동명 사용된 선례가 없다. 충돌 없음.

---

### [INFO] `EXECUTION_TIME_LIMIT_EXCEEDED` vs `EXECUTION_TIMEOUT` — 명명 유사성, 충돌 아님

- **식별자**: `EXECUTION_TIME_LIMIT_EXCEEDED`
- **spec 정의 위치**: `spec/5-system/4-execution-engine.md §8`; `spec/5-system/3-error-handling.md §1.4`
- **의미**: 단일 Execution 의 **누적 active-running 시간** 초과 (wall-clock 아님, `waiting_for_input` 대기 제외)
- **유사 식별자**: `EXECUTION_TIMEOUT` (Code 노드 스크립트 wall-clock timeout, 위 INFO 항목)
- **상세**: 두 코드는 이름이 유사하나 의미가 완전히 다르며(`EXECUTION_TIME_LIMIT_EXCEEDED` = 엔진 레벨 누적 active-running 초과, `EXECUTION_TIMEOUT` = Code 노드 script timeout) 각각의 발행 주체·경로도 별개다. `spec/5-system/3-error-handling.md §1.4` 가 두 코드를 같은 표에 나란히 기술해 구분을 명시하고 있다. 혼동 위험을 인식하고 있으나 spec 이 이미 구분을 명시하고 있으므로 추가 조치 불필요.

---

### [INFO] `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` — 기존 정의, 충돌 없음

- **식별자 집합**: `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`
- **spec 정의 위치**: `spec/5-system/4-execution-engine.md §7.5`; `spec/1-data-model.md §2.13` (Execution.error.code 열거)
- **코드 위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
- **상세**: 세 코드 모두 spec·코드·data-model 이 정합 상태이며 다른 도메인과 이름이 겹치지 않는다.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 이번 impl-prep 에서 **새 식별자를 도입하지 않는다**. 해당 spec 이 기존에 정의한 식별자(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `RESUME_*` 3종, `ExecutionError`/`MessageTooLongError` 타입)는 모두 backend `error-codes.ts` 및 `workflow-errors.ts`, frontend `execution-error-codes.ts`, websocket-protocol spec, error-handling spec 과 정합 상태이며 다른 의미로 사용 중인 선례가 없다. `EXECUTION_TIMEOUT` 동명 이중 레이어 이슈는 `spec/conventions/error-codes.md §4` 에 known artifact 로 기등록되어 있다. 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
