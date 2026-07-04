# 정식 규약 준수 검토 — spec-draft-concurrency-cap-pr2b

- 검토 대상: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md`
- 검토 모드: spec draft 검토 (--spec)
- 대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/migrations.md`, `spec/1-data-model.md`(settings 키 선례), `spec/5-system/3-error-handling.md`(카탈로그 SoT), `spec/5-system/4-execution-engine.md`(§8 현행 본문)

## 발견사항

- **[WARNING]** `EXECUTION_QUEUE_WAIT_TIMEOUT` 신규 등재 위치로 `error-codes.md §3` 을 지목 — 실제로는 §3(Historical-artifact 예외 레지스트리) 성격과 불일치
  - target 위치: draft "### 3-error-handling.md §1.4 + conventions/error-codes.md §3" 절, `## planner 결정` 2번
  - 위반 규약: `spec/conventions/error-codes.md` — 문서 자체가 §3 을 "원칙(§1)을 따르지 않는 **기존** 코드를 명시적으로 등록"하는 예외 등록부로 명시("신규 코드는 예외를 선례로 삼지 않는다"). 반대로 §Overview 는 "카탈로그·분류·트리거"의 SoT 는 `5-system/3-error-handling.md §1`이라고 명시하며, `error-codes.md` 자체는 "명명 규율만 정의"한다.
  - 상세: `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 `UPPER_SNAKE_CASE` 이고 의미 기반(§1 원칙 완전 준수) 이므로 "부정확한 이름의 유지 예외"가 아니다. 이를 §3 예외 레지스트리에 넣으면 §3 의 존재 이유(원칙 위반 기존 코드의 격리 등록)를 훼손하고, 향후 다른 정상 코드도 §3 에 잘못 등재되는 선례를 만들 위험이 있다.
  - 제안: draft 변경안에서 `error-codes.md §3` 언급을 제거하거나(신규 정상 코드는 `error-codes.md` 자체에 카탈로그 행을 추가할 필요가 원래 없음 — SoT 는 `3-error-handling.md`), 굳이 `error-codes.md` 를 언급해야 한다면 §3 이 아니라 "§1 원칙에 부합하는 신규 코드"라는 취지로 문구를 수정.

- **[WARNING]** `EXECUTION_QUEUE_WAIT_TIMEOUT` 을 `3-error-handling.md §1.4` (failed 전용 표) 에 추가 — 결과 상태가 `cancelled` 라 표 스코프와 불일치
  - target 위치: draft "### 3-error-handling.md §1.4 + conventions/error-codes.md §3" 절
  - 위반 규약: `spec/5-system/3-error-handling.md` §1.4 의 소제목은 **"엔진 수준 에러 (execution status → `failed`)"** 로 명시적으로 스코프 한정. 동일 문서 §1.5(`RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE` 등 — 모두 "Execution `cancelled` 로 종결"이라 명기)가 cancelled 결과 코드의 실제 등재 위치로 쓰이고 있다.
  - 상세: draft 본문도 스스로 "`EXECUTION_TIME_LIMIT_EXCEEDED`(failed)와 구분(대기 초과=cancelled)" 이라고 명시하면서, 정작 배치는 failed 전용 §1.4 로 지정했다. 다만 §1.5 는 "WS commands 에러 코드 (도메인 spec 참조)" 로 표제가 한정돼 있어 admission-gate 트리거(WS 커맨드 아님)인 본 코드가 §1.5 에도 완전히 맞아떨어지진 않는다 — 즉 기존 카탈로그 구조 자체에 "엔진 레벨 cancelled" 전용 표 슬롯이 없는 gap 이 있다(CRITICAL 로 보지 않는 이유).
  - 제안: (a) §1.4 표제를 "실행 종결 에러(failed/cancelled 포함)" 로 확장하고 결과 컬럼을 추가하거나, (b) §1.4 바로 다음에 "cancelled 결과 엔진 에러" 소절을 신설해 `EXECUTION_QUEUE_WAIT_TIMEOUT` 을 그쪽에 등재. 어느 쪽이든 developer PR 착수 전에 정확한 절 번호를 draft 에 확정해야 실제 구현 spec 개정이 갈팡질팡하지 않는다.

## 규약 준수 확인 (위반 없음 — 참고용 근거)

- **`EXECUTION_QUEUE_WAIT_TIMEOUT` 코드명**: `UPPER_SNAKE_CASE` + `<도메인>_<CONDITION>` 의미기반 패턴으로 `error-codes.md §1` 원칙 완전 준수. `EXECUTION_TIME_LIMIT_EXCEEDED`/`WORKER_HEARTBEAT_TIMEOUT` 등 기존 엔진 레벨 코드와 이름 스타일 일치.
- **`EXECUTION_QUEUE_WAIT_TIMEOUT_MS` env 변수명**: 기존 `EXECUTION_MAX_ACTIVE_RUNNING_MS`·`STUCK_RECOVERY_STALE_MS`·`CONTINUATION_DLQ_MONITOR_INTERVAL_MS` 등 `<DOMAIN>_..._MS` UPPER_SNAKE 관례와 완전 일치.
- **`maxConcurrentExecutions` settings 키**: camelCase, `spec/1-data-model.md §2.2` 의 기존 `timezone`·`interactionAllowedOrigins` 카멜케이스 키 관례와 일치. `PATCH .../settings` 부분 머지 방식도 draft 가 스스로 기존 관례 계승을 명시.
- **`queued_at` 컬럼명**: `snake_case`, `spec/1-data-model.md` 의 `started_at`/`created_at` 등 기존 Execution 컬럼 명명과 일치.
- **`V104` 마이그레이션 번호**: 현재 worktree 기준 최신 실파일은 `V103__trigger_endpoint_path_uuid_validate.sql` — `V104` 는 `spec/conventions/migrations.md §2` "신규 V번호는 항상 현재 main 의 max(V) + 1" 규칙과 정합(단, 실제 developer PR 착수 시점에 `git fetch origin main` 재확인은 §5 절차상 필수 — draft 단계에서는 문제 없음).
- **`pending → cancelled` 상태 전이**: `codebase/backend/src/modules/execution-engine/state/state-machine.ts`(`ALLOWED_TRANSITIONS`) 및 `state-machine.spec.ts` 의 `it('should allow pending -> cancelled')` 로 이미 허용되어 있음을 확인 — draft §"side-effect 점검" 의 확인 요청 사항이 실제로 통과됨.
- **문서 구조 규약**: draft 자체는 `plan/in-progress/*.md` 로 frontmatter(`worktree`/`started`/`owner`/`spec_impact`)를 갖추고 있어 `plan-lifecycle.md` 스키마에 부합. `spec_impact` 가 YAML 리스트 형식인 점도 정합(§Gate C 리스트 요구 준수).

## 요약

`spec-draft-concurrency-cap-pr2b.md` 는 settings 키(`maxConcurrentExecutions`, camelCase), `queued_at` 컬럼(snake_case), `V104` 마이그레이션 번호, `EXECUTION_QUEUE_WAIT_TIMEOUT` 코드명(UPPER_SNAKE, 의미기반) 자체는 모두 기존 정식 규약과 정합한다. 다만 draft 가 신규 에러 코드의 **등재 위치**로 지목한 `error-codes.md §3`(Historical-artifact 예외 레지스트리, 기존 위반 코드 전용)과 `3-error-handling.md §1.4`(failed 전용 표)는 둘 다 코드의 실제 성격(정상 명명 + cancelled 결과)과 스코프가 어긋난다. 이는 명명 자체의 오류가 아니라 카탈로그 문서 내 배치 지점의 부정확성이므로 WARNING 등급으로 분류했고, developer PR 착수 전 spec 본문 개정 시 정정이 필요하다.

## 위험도

MEDIUM

BLOCK: NO
- [WARNING] `EXECUTION_QUEUE_WAIT_TIMEOUT` 을 `error-codes.md §3`(기존 위반 코드 예외 등록부)에 등재하겠다는 draft 서술 — 정상 명명 코드이므로 §3 성격과 불일치, 문구 수정 필요
- [WARNING] `EXECUTION_QUEUE_WAIT_TIMEOUT` 을 `3-error-handling.md §1.4`(failed 전용 표)에 추가하겠다는 draft 서술 — 코드의 실제 결과는 `cancelled` 라 표 스코프와 불일치, §1.4 확장 또는 별도 소절 신설 필요

STATUS: SUCCESS
