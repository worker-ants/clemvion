---
worktree: refactor-04-a1-typed-errors-draft-b02e2b (branch claude/refactor-04-a1-typed-errors-draft-b02e2b) — 설계 초안 단계
started: 2026-06-13
owner: developer
status: in-progress
---

# execution-engine client-safe typed error 체계 (refactor 04 후속 A-2)

출처: PR #575 `/ai-review` deferred 항목 + refactor 04 1c. 사용자 결정(2026-06-13): **별도 작업으로 분리** — 본 항목은 등록만, 구현은 본 plan 으로 독립 진행.

## 문제

`websocket.gateway.ts` 의 `buildContinuationErrorAck` (L877) 가 내부 `error.message` 를 클라이언트 ack 에 그대로 전달한다:

```ts
const message = error instanceof Error ? error.message : fallbackMessage;
// → { event, data: { success: false, error: message, errorCode } }
```

`InvalidExecutionStateError` 만 `errorCode` 로 typed 하게 surface 되고(spec §7.5.1), 그 외 execution-engine 의 **plain `Error` throw** 들은 내부 메시지(스택 힌트·내부 식별자·DB/3rd-party 오류 원문 등)가 클라이언트로 누출될 수 있다. continuation 핸들러 4종(L492·566·639·709)이 모두 이 경로를 공유한다.

## 결정 필요 (설계)

execution-engine error 표면 **전반**에 영향을 주는 대형 설계라 별도 작업으로 분리됐다. 착수 시 다음을 확정한다:

1. **error code enum 체계** — `InvalidExecutionStateError.code`(`INVALID_EXECUTION_STATE`)·worker `RESUME_*` 와 직교/통합 관계. 신규 client-safe code 네임스페이스(`EXEC_*`?) 정의.
2. **client-safe 메시지 매핑** — code → 사용자 노출 메시지(i18n? 고정 영문?). 내부 message 는 서버 로그에만 남기고 클라이언트엔 code+안전 메시지만.
3. **typed error 기반 클래스** — execution-engine 의 plain `Error` throw 들을 `ExecutionError`(code 보유) 계열로 전환하는 범위. 어디까지 전환할지(전수 vs 경계만).
4. **ack 변환 지점** — `buildContinuationErrorAck` 가 typed error 면 code+safe message, plain Error 면 generic fallback(내부 message 미전달)로 처리하도록 변경.

## 구현 지점 (예상)

- `codebase/backend/src/modules/execution-engine/**` — error throw 표면, typed error 클래스.
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` `buildContinuationErrorAck` (L877).
- spec: `spec/3-execution/**` (execution-engine error 계약) + websocket protocol spec §7.5.1.

## 선행 의존

- spec 결정(위 1~4)을 project-planner 가 먼저 확정해야 구현 착수 가능 — `consistency-check --spec` 동반.

---

## 결정 옵션 (2026-06-14) — planner 설계 초안

> 사용자 결정(2026-06-14): A-1 은 **"planner 설계 초안 먼저"** — 본 절은 구현 전 결정을 돕는 옵션·장단점·권고안 분석이다. 확정·spec 반영·구현은 후속 트랙. **본 절 작성으로 spec 은 아직 바뀌지 않는다** (spec = 확정된 진실).

### 현황 재조사 (코드 ground truth, 2026-06-14)

기존 가정과 달리 execution-engine 에는 **이미 부분적 typed-error 생태계**가 있다. 신규 설계는 from-scratch 가 아니라 이 위에 정합해야 한다.

| 에러 클래스 | 위치 | code | 클라이언트 표면 | 비고 |
|---|---|---|---|---|
| `InvalidExecutionStateError` | `execution-engine/workflow-errors.ts` L62 | `INVALID_EXECUTION_STATE` (고정) | publisher-측 동기 ack `errorCode` | **이미 이상적 패턴** — 고정 client-safe 메시지(`'Execution is not waiting for input.'`) + 서버 로그 전용 `detail` 분리 |
| `RehydrationError` | `execution-engine.service.ts` L339 | `RESUME_CHECKPOINT_MISSING`·`RESUME_FAILED`·`RESUME_INCOMPATIBLE_STATE` | worker-측 비동기 `execution.cancelled` 이벤트 | publisher ack 와 별개 경로 |
| `RetryLastTurnError` | execution-engine | `ErrorCode` enum 값 (`RETRY_STATE_NOT_FOUND`·`NODE_NOT_RETRYABLE`·`RETRY_TOO_EARLY`) | retry ack nested `error:{code,message}` | 이미 code 보유 |
| `ExecutionTimeLimitError` | execution-engine | `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` | — | 이미 code 보유 |
| `WorkflowNotFoundError`·`SubWorkflowTimeoutError` | execution-engine | **code 없음** | — | message-only |
| plain `new Error(...)` | 전반 (~15곳) | 없음 | **leak 위험** | continuation 경로의 일부가 `buildContinuationErrorAck` 까지 전파 |

- **leak 지점 확정**: `buildContinuationErrorAck`(`websocket.gateway.ts` L877–889)는 `error instanceof Error ? error.message : fallbackMessage` 로 **plain Error 의 내부 message 를 그대로 ack 에 전달**. `errorCode` 는 `InvalidExecutionStateError` 만 surface. 호출부 4곳: form_submitted(L492)·click_button(L566)·submit_message(L639)·end_conversation(L709).
- **기존 코드 prefix 관례**: 중앙 `ErrorCode` enum(`nodes/core/error-codes.ts`)은 `EXECUTION_*`·`RETRY_*`·`NODE_*` 등 **UPPER_SNAKE_CASE + 도메인 prefix** ([`conventions/error-codes.md`](../../spec/conventions/error-codes.md) SoT). **`EXEC_*` 신규 네임스페이스는 기존 `EXECUTION_*` 과 충돌·중복** → 재고 필요.
- **i18n 관례 확정**: backend 는 **안정 code + 고정 영문 메시지**만 emit, frontend 가 **code→i18n key 매핑**(`integration-error-codes.ts`·`loader-error-messages.ts` 선례)으로 표시. backend i18n 레이어는 없다.
- **spec 위치 정정**: 본 계약의 spec 은 `spec/5-system/4-execution-engine.md §7.5.1`(publisher 측 사전 검증 — INVALID_EXECUTION_STATE) + `spec/5-system/6-websocket-protocol.md`(WS ack 에러 코드 표, L305~). `spec/3-execution/**` 아님(위 "구현 지점" 의 표기 정정).

### 결정 1 — error code 네임스페이스

- **옵션 A (권고)**: 신규 네임스페이스를 만들지 않고 **기존 `EXECUTION_*` prefix + 중앙 `ErrorCode` enum** 을 확장. continuation/publisher 신규 코드도 `EXECUTION_*`(예: `EXECUTION_NOT_WAITING`)로. `INVALID_EXECUTION_STATE`(prefix 없는 시스템 레벨 코드, error-codes.md §1 예외)는 안정성 정책상 유지.
  - 장점: error-codes.md 규약·기존 enum 과 일관, rename breaking 회피. 단점: prefix 가 `EXECUTION_` 로 길다.
- **옵션 B**: `EXEC_*` 신규 prefix. 단점: 기존 `EXECUTION_*` 과 이중 표기 → **기각 권고**.
- **옵션 C**: per-class `code` 만 두고 중앙 enum 미등록(현 `InvalidExecutionStateError` 처럼). 장점: 분산 정의 단순. 단점: 전역 코드 카탈로그 누락·중복 위험. **A 와 절충 가능** — class 가 보유하되 값은 enum 참조.
- **권고**: **A** (+ class 는 enum 값을 참조해 SoT 단일화). `RESUME_*`·`RETRY_*` 는 이미 코딩돼 안정성 정책상 **그대로 유지**(rename 안 함).

### 결정 2 — client-safe 메시지 매핑

- **옵션 A (권고)**: 기존 관례 답습 — backend 는 **code + 고정 영문 generic 메시지**만, **내부 detail 은 서버 로그 전용**(현 `InvalidExecutionStateError.detail` 패턴). frontend 가 execution 에러용 **code→i18n key 맵** 신설(`integration-error-codes.ts` 선례 복제).
  - 장점: 기존 i18n 아키텍처와 정합, backend 단순, 누출 차단. 단점: 신규 code 마다 frontend 맵 1줄 추가(저비용).
- **옵션 B**: backend i18n 레이어 신설. 단점: backend i18n 인프라 부재 — 신규 구축 비용 큼, 기존 패턴 역행. **기각 권고**.
- **권고**: **A**. 미매핑 code 는 frontend 가 generic fallback 으로 graceful 처리(이미 닫힌 enum 으로 단정 안 하는 관례).

### 결정 3 — `ExecutionError` 기반 클래스 전환 범위

- **옵션 A (권고) — 경계 전환**: `ExecutionError` 추상 기반(`code` + `clientMessage` + 서버 전용 `serverDetail`) 도입. **continuation/publisher 경로에서 ack 까지 전파되는 throw 만** typed 로 전환. 깊은 내부 plain Error 는 그대로 두고 ack 경계에서 generic fallback 처리.
  - 장점: 누출 차단 목적을 최소 변경으로 달성, blast radius 작음. 단점: 일부 내부 에러는 비-typed 잔존(클라이언트 미도달이라 무해).
- **옵션 B — 전수 전환**: execution-engine 의 ~15+ plain Error 전부 `ExecutionError` 화. 단점: 대형·저가치(다수가 클라이언트 경계 미도달), 회귀 위험. **기각 권고**.
- **정합**: 기존 `InvalidExecutionStateError`·`RehydrationError`·`RetryLastTurnError` 를 `ExecutionError` 기반으로 **점진 흡수**(공통 인터페이스 `{ code, clientMessage, serverDetail? }`)하되 code 값·동작은 보존.
- **권고**: **A**.

### 결정 4 — ack 변환 지점

- **권고 (단일 안)**: `buildContinuationErrorAck` 를 다음으로 변경 —
  - error 가 `ExecutionError`(또는 `code`+`clientMessage` 보유) → ack `{ success:false, error: clientMessage, errorCode: code }`.
  - 그 외 plain Error → ack `{ success:false, error: <고정 generic fallback>, errorCode: 'EXECUTION_INTERNAL_ERROR' }` (**`error.message` 미전달** — 누출 차단). 전체 `error.message`/stack 은 **서버 로그**에 기록.
- 이로써 4개 continuation 핸들러 전부 동일 정책. worker-측 `RESUME_*`(`execution.cancelled` 이벤트)·retry ack 는 별도 경로라 본 변경 범위 밖(동일 원칙 적용 여부는 후속 점검 항목).

### 권고 요약 + 후속

| 결정 | 권고 |
|---|---|
| 1 네임스페이스 | A — 기존 `EXECUTION_*`/중앙 enum 확장 (`EXEC_*` 기각) |
| 2 메시지 | A — backend code+고정영문 / frontend code→i18n 맵 |
| 3 전환 범위 | A — 경계 전환 (boundary), 전수 기각 |
| 4 ack 변환 | typed→code+safe msg, plain→generic fallback+내부 message 미전달 |

- **결정 확정 시 후속**: project-planner 가 `4-execution-engine.md §7.5.1` + `6-websocket-protocol.md` 에 이 계약(신규 `EXECUTION_*` 코드·ack 정책) 반영 → `consistency-check --spec` → developer 가 옵션 A×4 구현(`ExecutionError` 기반 + `buildContinuationErrorAck` 변경 + frontend i18n 맵) + 누출 차단 단위/e2e.
- **보안 메모**: 본 작업의 핵심 가치는 plain Error 내부 message(스택 힌트·DB/3rd-party 원문·내부 식별자)의 클라이언트 누출 차단 — 결정 4 의 "plain Error → 내부 message 미전달" 이 그 보안 게이트.
