# 신규 식별자 충돌 검토 — `spec/5-system/` 구현 착수 전 (--impl-prep)

검토 대상: `plan/in-progress/exec-intake-queue-impl.md` 가 참조하는 `spec/5-system/4-execution-engine.md` 재정의 (spec PR #458 머지) 와, 이를 소비하는 worktree 내 spec 변경(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`).

---

## 발견사항

### [WARNING] `EXECUTION_TIMEOUT` 의미 범위 — 기존 사용처와 불일치 잔존

- **target 신규 식별자**: 워크트리 `spec/5-system/3-error-handling.md` 행 59–60 에서 `EXECUTION_TIMEOUT` 을 "Code 노드 스크립트 실행 타임아웃 한정" 으로 의미를 축소하고, 엔진 레벨 누적 타임아웃은 신규 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 분리.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` 행 937: `최대 실행 시간 초과 → EXECUTION_TIMEOUT 에러 → Execution.status = failed` — 엔진 레벨 타임아웃에 `EXECUTION_TIMEOUT` 을 명시.
  - `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 행 532: `"code": "EXECUTION_TIMEOUT" | "MAX_ITERATIONS_EXCEEDED" | ...` — 엔진 수준 에러 코드로 `EXECUTION_TIMEOUT` 을 예시.
  - `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md`(main) 행 59: `EXECUTION_TIMEOUT` = "워크플로우 또는 노드 실행 타임아웃" — 범위 미분리.
  - 사용자 문서 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` 행 156, `codebase/frontend/src/content/docs/06-integrations-and-config/{discord,telegram,slack}.mdx` — 사용자 노출 문서에 `EXECUTION_TIMEOUT` 을 "전체 워크플로우 실행 시간 초과" 유형으로 노출.
  - `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 행 38: `EXECUTION_TIMEOUT` 을 분류기 어휘로 포함.
- **상세**: worktree 내 `spec/5-system/3-error-handling.md` 는 이미 의미를 분리 갱신했으나, `spec/5-system/14-external-interaction-api.md` (§5.2 예시) 는 worktree 에서도 미갱신 상태(`EXECUTION_TIMEOUT` 을 엔진 수준으로 표기). 사용자 문서·채널 분류기는 아직 main 기준이라 실제 구현 이후 혼선 가능.
- **제안**: `spec/5-system/14-external-interaction-api.md` §5.2 예시의 `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 교체를 PR2 범위에 포함. 사용자 문서(`run-results.mdx`, 각 채널 docs) 및 `execution-failure-classifier.ts` 에서 `EXECUTION_TIMEOUT` 의 의미 범위 재확인/코멘트 보강 — 엔진 레벨 타임아웃이 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 전환된 후 사용자 문서도 동기화 필요.

---

### [WARNING] `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 분리 시 외부 API 계약 변경

- **target 신규 식별자**: `EXECUTION_TIME_LIMIT_EXCEEDED` (신규 엔진 레벨 에러 코드).
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 행 532: EIA SSE `execution.failed` 이벤트의 `code` 예시에 `EXECUTION_TIMEOUT` 을 열거 — EIA는 외부 소비자(SDK·BYO-UI 클라이언트)에 노출되는 공개 계약.
  - `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 행 38: 채널 응답 분류기가 `EXECUTION_TIMEOUT` 에 매핑된 응답 유형을 정의. 새 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 분류기에 없으므로 미분류 fallback 처리.
- **상세**: EIA spec 예시와 채널 분류기가 아직 `EXECUTION_TIMEOUT` 기준이라, PR2 구현 후 실제로 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 발행될 때 외부 소비자·채널 분류기가 unknown 코드로 취급할 수 있음. 이는 의미 충돌(같은 이름 다른 의미)이 아니라 새 이름 미등록 문제이지만, 혼동 방지를 위해 WARNING 으로 분류.
- **제안**: PR2(동시성 cap + 타임아웃 구현) 범위에 다음을 포함:
  1. `spec/5-system/14-external-interaction-api.md` §5.2 `code` 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가.
  2. `execution-failure-classifier.ts` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 분류 어휘로 등록(기존 `EXECUTION_TIMEOUT` 매핑 행 옆에 추가 — `executionFailedTimeout` 유형).

---

### [INFO] `exec:run:seq:<executionId>` — `exec:cont:seq:` 와 namespace 분리 확인됨, 충돌 없음

- **target 신규 식별자**: `exec:run:seq:<executionId>` (Redis INCR key, spec §9.2 target 행).
- **기존 사용처**: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` 행 79: `exec:cont:seq:<executionId>` (prefix `exec:cont:seq:`).
- **상세**: 두 prefix 가 `run` vs `cont` 로 명확히 분리되어 있음. spec §9.2 가 "continuation seq 와 namespace 분리(`run` vs `cont`)" 를 명시하고 있으므로 의도적 설계. 충돌 없음.
- **제안**: 구현 시 prefix 상수를 `'exec:run:seq:'` 로 명명해 기존 `SEQ_KEY_PREFIX = 'exec:cont:seq:'` 패턴과 대칭 유지 권장.

---

### [INFO] `EXECUTION_RUN_WORKER_CONCURRENCY` — 신규 ENV 이름, 기존과 명명 패턴 일관

- **target 신규 식별자**: `EXECUTION_RUN_WORKER_CONCURRENCY` (spec §11 target 행).
- **기존 사용처**: `CONTINUATION_WORKER_CONCURRENCY` (`codebase/backend/.env.example` 행 163, `spec/5-system/4-execution-engine.md` §11). `BACKGROUND_EXECUTION_QUEUE_DEFAULT_OPTS` (codebase 상수).
- **상세**: `<DOMAIN>_WORKER_CONCURRENCY` 패턴 준수. 기존 `CONTINUATION_WORKER_CONCURRENCY` 와 naming scheme 일치. 충돌 없음.
- **제안**: `.env.example` 에 `EXECUTION_RUN_WORKER_CONCURRENCY=` 항목(PR1 구현 시) 추가 시 기존 `CONTINUATION_WORKER_CONCURRENCY=1` 항목 근처에 배치해 관련성을 명시.

---

### [INFO] `execution-run` BullMQ 큐 이름 — 기존 큐와 충돌 없음

- **target 신규 식별자**: BullMQ 큐 `execution-run` (spec §4/§9.3 target 행).
- **기존 사용처**: `execution-continuation`, `background-execution` (codebase 실존, spec §9.3). `execution-run` 은 codebase 어디에도 없음 (grep 확인).
- **상세**: 케밥-케이스 큐 네이밍 패턴 일관. `execution-` prefix 가 continuantion/run 두 큐에 공유되어 논리적 그룹핑됨. 충돌 없음.
- **제안**: 없음.

---

### [INFO] `WORKER_HEARTBEAT_TIMEOUT` 에러 코드 의미 재정의 — 기존 코드와 동일 이름 유지, 의미 교체

- **target 신규 식별자**: `WORKER_HEARTBEAT_TIMEOUT` 의미를 "30분 stale" → "BullMQ stalled 재배달 attempts 소진(terminal worker failure)" 으로 재정의 (worktree `spec/1-data-model.md` 행 454, `spec/5-system/4-execution-engine.md` 행 753).
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/1-data-model.md`(main) 행 454: `WORKER_HEARTBEAT_TIMEOUT` = "30분 이상 heartbeat 없는 RUNNING Execution".
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 행 2080: `code: 'WORKER_HEARTBEAT_TIMEOUT'` — 현 구현이 30분 stale 판정 시 발행.
- **상세**: 동일 에러 코드 이름이 유지되지만 의미가 확장·재정의된다(stale 절대 시간 → BullMQ stalled). spec §Rationale 및 worktree spec 에 "이름 유지 + 의미 재정의" 라는 결정이 명시되어 있어 `error-codes.md §2` rename 금지 원칙을 우회한 의도적 선택임. 구현 전환 기간 동안 codebase 는 여전히 `WORKER_HEARTBEAT_TIMEOUT` 을 절대 30분 기준으로 발행하므로, PR4(stalled-job 일원화) 완료 전까지 spec 과 구현 간 의미 불일치가 존재. 이는 이미 spec 에 "현 실제 동작" 주석으로 명시된 알려진 갭.
- **제안**: 없음 (의도적 단계 전환, spec 에 명시됨). PR4 완료 시 codebase 의 `WORKER_HEARTBEAT_TIMEOUT` 발행 코드 교체를 확인.

---

## 요약

`spec/5-system/4-execution-engine.md` 재정의(spec PR #458)가 도입하는 신규 식별자(`execution-run` 큐, `exec:run:seq:` Redis prefix, `EXECUTION_RUN_WORKER_CONCURRENCY` ENV, `EXECUTION_TIME_LIMIT_EXCEEDED` 에러 코드)는 기존 코드베이스 및 main spec 과 직접 충돌하지 않는다. 다만 `EXECUTION_TIMEOUT` 의 의미 축소 결정이 `spec/5-system/14-external-interaction-api.md` §5.2 예시 및 `execution-failure-classifier.ts` 에 아직 미전파되어 있어, PR2 구현 이후 외부 소비자가 신규 에러 코드를 unknown 으로 받을 가능성이 있다. 이 두 건은 CRITICAL 충돌이 아닌 WARNING 수준의 후속 동기화 요구사항이다.

---

## 위험도

LOW
