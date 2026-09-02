# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[WARNING]** `spec/1-data-model.md` §2.13 `Execution.error` 서술이 draft 의 "두 family 공존" 모델과 어긋나는 낡은 이분법 + 채움 메커니즘 누락을 그대로 남긴다
  - target 위치: draft "변경 제안" §, 특히 `EngineErrorCode` 4종 나열 문단과 "**`Execution.error` 는 두 family 가 공존하는 필드다**" 문단 (target 문서 61~73행)
  - 충돌 대상: `spec/1-data-model.md:474`(§2.13 Execution `error` 컬럼 설명), `spec/1-data-model.md:557-563`("Execution.error ↔ NodeExecution.error 관계" 표)
  - 상세:
    1. **이분법 vs 실제 삼분법.** data-model.md:474 는 `error.code` 어휘를 "노드 핸들러가 정의" 대 "엔진 인프라 차원의 코드" 이분법으로 나누고, 후자에 `SERVER_INTERRUPTED` · `WORKER_HEARTBEAT_TIMEOUT` · `EXECUTION_TIME_LIMIT_EXCEEDED` · `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` 6개를 무차별 나열한다. 그러나 실측(`codebase/backend/src/nodes/core/error-codes.ts:8-171`)으로는 이 6개가 **세 갈래**다 — `EngineErrorCode` 소속(`SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`), `ErrorCode` 소속(`EXECUTION_TIME_LIMIT_EXCEEDED`, draft 자신이 인용하는 예시), 그리고 **둘 다 아님** — `error-codes.ts:132-139` 주석이 명시하듯 `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`는 `RehydrationError.code` 의 별도 typed literal union(생성자 positional 인자)이고 `RESUME_FAILED`는 가드 스캔 표면 밖의 맨 메서드 인자다. draft 가 error-codes.md §Overview 에 "둘은 같은 파일의 자매 const" 라는 정확한 모델을 새겨 넣더라도, 동반 검토 대상인 이 컬럼 설명은 여전히 "엔진 인프라 코드 = 한 덩어리"로 읽혀 다음 독자가 `RESUME_*` 셋을 `EngineErrorCode` 로 오분류할 소지가 있다 — draft 자신이 초판을 정정한 것과 동일한 성격의 오독이다(draft 본문이 언급하는 `--spec 21_30_10` cross_spec WARNING #1 과 같은 클래스).
    2. **"복사" 서술이 유일한 채움 경로처럼 읽힌다.** `spec/1-data-model.md:562` "복사 = Execution.error — 워크플로우 실행이 `failed` 상태로 전이될 때, **최초 failed NodeExecution**의 에러 정보를 복사" 는 `Execution.error` 채움 메커니즘을 "NodeExecution 실패 복사" 하나로 설명한다. 그러나 `EngineErrorCode.EXECUTION_QUEUE_WAIT_TIMEOUT` 경로(`execution-engine.service.ts:2871-2891` `markQueueWaitTimeout`)는 `pending` 상태의 Execution 행을 **NodeExecution 이 존재조차 하지 않는 상태**에서 직접 `UPDATE ... SET status='cancelled', error={code, message}` 로 채운다 — "복사" 관계가 아예 성립하지 않는 별도 쓰기 경로다. `:563` "구조" 행은 "`nodeId` 는 노드 없는 엔진 인프라 실패(worker 크래시 등)에서 null" 이라 이 케이스를 암묵적으로 커버하는 듯 보이지만, `:562` 의 "복사" 서술은 이 직접-쓰기 경로를 명시하지 않는다.
  - 제안: draft 는 `spec/1-data-model.md` 를 이미 "동반 검토" 대상(spec_impact 목록)으로 지정했으므로, 이번 diff 또는 후속 planner 턴에서 (a) `:474` 6개 코드를 실제 소속(`EngineErrorCode` 2 / `ErrorCode` 1 / 둘 다 아님 3)으로 재분류하거나 최소 각주를 달고, (b) `:562` "복사" 행에 "단, `EngineErrorCode` 의 admission-gate 취소(`EXECUTION_QUEUE_WAIT_TIMEOUT` 등)는 NodeExecution 없이 Execution 을 직접 갱신" 한 줄을 보강할 것을 권고한다.

- **[WARNING]** `spec/5-system/3-error-handling.md` §1.4 카탈로그 표가 "엔진 수준 에러" 를 단일 집합처럼 나열하지만 그 중 named const 등재는 일부뿐이다
  - target 위치: draft "변경 제안" § — "`EngineErrorCode` — 엔진 전용. 4종(...)이고 `Execution.error`·`NodeExecution.error` 봉투에만 실린다" 문단
  - 충돌 대상: `spec/5-system/3-error-handling.md:106-125` (§1.4 "워크플로우 실행 에러", "엔진 수준 에러 (execution status → `failed`)" 표)
  - 상세: 이 표는 `EXECUTION_TIMEOUT` · `EXECUTION_TIME_LIMIT_EXCEEDED` · `WORKER_HEARTBEAT_TIMEOUT` · `RECURSION_DEPTH_EXCEEDED` · `MAX_ITERATIONS_EXCEEDED` · `CYCLE_DETECTED` · `INVALID_EXPRESSION` · `VARIABLE_NOT_FOUND` · `TYPE_MISMATCH` · `ERROR_PORT_FALLBACK` 10종을 "엔진 수준 에러"라는 한 헤딩 아래 동일 형식으로 나열한다. 그러나 `codebase/backend/src/nodes/core/error-codes.ts` 실측으로는 이 중 named const(`ErrorCode`/`EngineErrorCode`)에 등재된 것은 `EXECUTION_TIME_LIMIT_EXCEEDED`(`ErrorCode`)·`WORKER_HEARTBEAT_TIMEOUT`(`EngineErrorCode`) 2종뿐이고, 나머지 8종(`EXECUTION_TIMEOUT` 포함)은 두 const 어디에도 없는 무등재 raw literal 이다(`ERROR_PORT_FALLBACK` 는 `error-codes.ts:133` 주석이 "에러 클래스의 `readonly code`" 로 별도 앵커가 있다고 명시). draft 가 error-codes.md §Overview 에 "`ErrorCode`/`EngineErrorCode` 두 surface" 프레이밍을 새기면, 이 카탈로그 SoT 를 이어서 읽는 독자가 "엔진 수준 에러는 이 두 surface 로 다 설명된다"고 오판할 위험이 생긴다 — 실제로는 무등재 raw literal 이 다수(8/10)다.
  - 제안: CRITICAL 은 아니다 — error-handling.md §1.4 는 원래 "카탈로그"이지 const 소속을 밝히는 문서가 아니므로 직접 모순은 아니다. 다만 draft 의 §Overview 편집이 "대표 surface(named enum)"를 명시적으로 강조하는 만큼, error-codes.md 신설 문구 근처에 "이 두 surface 가 엔진 수준 에러 코드 전체집합은 아니다 — 다수는 무등재 raw literal 로 남아 있다(§4 내부 전용 분류 코드와는 별개 축)" 한 줄을 덧붙이거나, 최소한 이번 검토 결과를 착수 근거 plan 의 후속 항목으로 남겨 둘 것을 권고한다.

- **[INFO]** `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT` 행은 이미 "엔진 레벨 `error.code`" 라 정확히 표기하고 있어 draft 와 정합 — 별도 조치 불필요, 교차 확인 결과만 기록
  - target 위치: draft 전체
  - 충돌 대상: `spec/conventions/error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행
  - 상세: 해당 행이 "— (HTTP 무관 — 엔진 레벨 `error.code`, execution `failed`)" 로 이미 정확히 계층을 표기하고 있고, `error-codes.ts:154-160` 의 `EngineErrorCode.WORKER_HEARTBEAT_TIMEOUT` JSDoc 도 동일 SoT 를 상호 참조한다. draft 의 병기 내용과 모순 없음.
  - 제안: 없음(확인용 기록).

## 요약

이 draft 는 `spec/conventions/error-codes.md` §Overview 한 문단만 편집하는 좁은 범위지만, 그 편집이 성립시키는 "`ErrorCode`/`EngineErrorCode` 두 surface, 같은 파일의 자매 const, `Execution.error` 는 두 family 공존" 모델은 실측(코드)으로는 정확하다. 문제는 이 모델이 착지할 자리 옆에서, draft 가 명시적으로 "동반 검토" 대상으로 지정한 `spec/1-data-model.md`(§2.13 `Execution.error` 컬럼·"복사" 관계 표)와, 지정하지 않은 `spec/5-system/3-error-handling.md`(§1.4 카탈로그)가 여전히 더 거친 이분법·단일 채움 경로·미분화된 카탈로그를 서술한다는 점이다. 두 지점 모두 draft 의 새 모델과 **직접 모순**은 아니지만(작동 불가 상황은 없음), draft 가 스스로 정정하려는 "필드/카탈로그를 보고 코드 소속을 성급히 일반화하는" 오독 패턴을 그대로 재생산할 잠재력이 있어 WARNING 이 타당하다. 요구사항 ID·API 계약·상태 전이·RBAC·계층 책임 축에서는 이 draft 와 충돌하는 다른 spec 영역을 찾지 못했다(신규 `spec/` 전체 검색 결과 `EngineErrorCode` 를 이미 참조하는 문서 없음 — 명명 충돌 없음).

## 위험도

MEDIUM
