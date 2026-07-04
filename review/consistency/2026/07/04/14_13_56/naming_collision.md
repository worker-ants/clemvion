# 신규 식별자 충돌 검토 — spec-draft-concurrency-cap-pr2b

검토 대상: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md`
신규 식별자: `maxConcurrentExecutions`(settings key), `EXECUTION_QUEUE_WAIT_TIMEOUT`(error code), `queued_at`(Execution column), `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`(env var), migration `V104`.

## 발견사항

- **[INFO]** `maxConcurrentExecutions` vs 기존 `maxConcurrency` (Parallel 노드) 명명 유사
  - target 신규 식별자: `Workspace.settings.maxConcurrentExecutions` / `Workflow.settings.maxConcurrentExecutions`
  - 기존 사용처: `spec/4-nodes/1-logic/0-common.md:133`, `spec/4-nodes/1-logic/10-parallel.md:23,68,86` — Parallel 노드 `config.maxConcurrency` (branch fan-out 동시성 제한, `p-limit(effectiveConcurrency)`)
  - 상세: 두 식별자는 접두어(`max...Concurren*`)가 겹치지만 스코프·레벨이 다르다 — 기존 `maxConcurrency`는 **노드 config** 레벨(단일 Parallel 노드의 branch 동시 실행 슬롯, 0~16), 신규 `maxConcurrentExecutions`는 **Workspace/Workflow settings** 레벨(동시 Execution 행 수 admission cap, 워크스페이스 10·워크플로우 3)이다. 완전히 동일한 문자열은 아니라 CRITICAL 은 아니지만, "concurrency" 계열 설정을 다루는 사람이 두 스코프를 혼동할 여지가 있다(둘 다 "동시성 cap" 이라는 점에서 개념적으로 인접).
  - 제안: target 문서(4-execution-engine.md §8, 1-data-model.md §2.2/§2.4)에 "Parallel 노드의 `config.maxConcurrency`(branch 레벨)와는 별개 — Execution admission 레벨" 한 줄 각주를 추가해 명확화. 식별자 자체는 spec §8 표 용어("동시 Execution 수")와 이미 일치하므로 변경 불필요.

- **[INFO]** `queued_at` — Execution.started_at 인접 필드와 의미 경계 확인
  - target 신규 식별자: `Execution.queued_at` (V104, Timestamp?)
  - 기존 사용처: `spec/1-data-model.md:953` `Execution.started_at` (실행 시작 시각, RUNNING 전이 시점)
  - 상세: 코퍼스 전체(`spec/`, `codebase/backend/migrations/`)에 `queued_at` 문자열이 기존에 전혀 사용되지 않음 — 충돌 없음. target 이 이미 "재사용 가능 컬럼 없음(`started_at`은 `recoverStuckExecutions` stale 판정과 충돌)" 이라고 스스로 경계를 명시해 두었고, 이는 검증 결과와 일치한다.
  - 제안: 없음(현행 유지). 참고로만 기록.

## 항목별 결론

1. **`maxConcurrentExecutions` (settings key)** — `spec/1-data-model.md` §2.2 Workspace.settings(line 94), §2.4 Workflow.settings(line 120) 어떤 기존 알려진 키(`timezone`, `interactionAllowedOrigins`)와도 겹치지 않음. 코드베이스·spec 전역에 사전 사용 이력 없음. **충돌 없음** (위 INFO 항목은 이름 유사도 경고일 뿐 동일 식별자 충돌 아님).
2. **`EXECUTION_QUEUE_WAIT_TIMEOUT` (error code)** — `spec/5-system/3-error-handling.md`(§1.4/§1.5 카탈로그) 및 `spec/conventions/error-codes.md` grep 결과 기존 미사용. 인접 기존 코드 `EXECUTION_TIME_LIMIT_EXCEEDED`(failed, active-running 누적 초과) · `WORKER_HEARTBEAT_TIMEOUT`(failed, stalled 소진) · `RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`(continuation 실패) · `SERVER_INTERRUPTED`(graceful shutdown) 와 이름·의미 모두 구분됨. **충돌 없음**.
3. **`queued_at` (Execution column)** — 위 분석대로 **충돌 없음**.
4. **`EXECUTION_QUEUE_WAIT_TIMEOUT_MS` (env var)** — `codebase/backend/.env.example` 및 spec 전역 grep 결과 기존 미사용. 유사 기존 env var `EXECUTION_MAX_ACTIVE_RUNNING_MS`(`.env.example:202`, 기본 1800000)와 이름 패턴은 유사(`EXECUTION_*_MS`)하나 완전히 다른 문자열이고 각각 별개 타임아웃(큐 대기 5분 vs active-running 누적 30분)을 가리켜 의미 혼동 위험은 낮음. **충돌 없음**.
5. **Migration V104** — `codebase/backend/migrations/` 실제 파일 목록 확인 결과 최신 파일은 `V103__trigger_endpoint_path_uuid_validate.sql`. target 이 지정한 **V104는 다음 순번과 정확히 일치**하며 기존 V001~V103 어떤 파일과도 겹치지 않음. **충돌 없음**.

## 요약

5개 신규 식별자(`maxConcurrentExecutions`, `EXECUTION_QUEUE_WAIT_TIMEOUT`, `queued_at`, `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, `V104`) 모두 기존 settings 키·에러 코드·컬럼·env var·마이그레이션 버전 중 어느 것과도 동일 문자열로 충돌하지 않는다. 코드베이스(`codebase/backend/migrations/`, `.env.example`)와 spec 코퍼스(`spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`)를 직접 대조해 확인했다. 유일한 주목할 점은 `maxConcurrentExecutions`가 기존 Parallel 노드의 `config.maxConcurrency`와 "concurrency cap" 이라는 개념적 인접성 때문에 이름이 비슷해 보일 수 있다는 것인데, 스코프(노드 config vs workspace/workflow settings)가 명확히 달라 실질적 충돌은 아니며 INFO 수준의 명확화 제안만 남긴다.

## 위험도

NONE

---

BLOCK: NO

- 신규 identifier 5종 모두 기존 사용처와 충돌 없음(Critical/Warning 없음).
- INFO: `maxConcurrentExecutions`(settings) vs 기존 `maxConcurrency`(Parallel 노드 config) — 접두어 유사, 스코프 다름. 문서에 한 줄 각주로 명확화 권장(비차단).
- INFO: `queued_at` 신규 컬럼 — 기존 `started_at`과 경계 이미 target 자체 문서화, 별도 조치 불요.

STATUS: SUCCESS
