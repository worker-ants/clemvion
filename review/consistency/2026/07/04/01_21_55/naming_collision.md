# 신규 식별자 충돌 검토 — impl-done (spec/5-system/4-execution-engine.md, PR3 크래시/재시작 re-drive)

## 점검 범위

- diff-base: `origin/main`
- 코드 변경: `execution-engine.service.ts`(+`recoverStuckExecutions` 재작성, `reclaimStuckRunningExecution`/`redriveStuckExecution`/`driveStuckRedrive`/`failOrphanRunningNodeExecutions`/`runStuckRecoveryScan` 신규), `execution-engine.service.spec.ts`, `graph-dispatch.types.ts`(`skipExecutedNodes` 신규 필드), `executions.controller.ts`(`POST _test/recover-stuck-executions` 신규 endpoint + `E2E_TEST_HOOKS` 신규 env), `execution-crash-redrive.e2e-spec.ts`(신규 e2e).
- target spec: `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.5, 연계 `spec/data-flow/3-execution.md`, `spec/conventions/error-codes.md`, `spec/1-data-model.md`.

## 발견사항

없음 — 신규 식별자 충돌을 나타내는 CRITICAL/WARNING 없음.

검토한 신규 식별자와 결과:

- **메서드명** `reclaimStuckRunningExecution` / `redriveStuckExecution` / `driveStuckRedrive` / `failOrphanRunningNodeExecutions` / `runStuckRecoveryScan` — `execution-engine.service.ts` 전체(grep) 및 타 모듈에서 동명 재사용 없음. 기존 `recoverStuckExecutions`(유지) 와도 의미·이름이 겹치지 않게 분리됨.
- **API endpoint** `POST /executions/_test/recover-stuck-executions` — 코드베이스 전체에서 `_test/` prefix 라우트가 이번에 처음 도입됐고 기존 route 와 리터럴 충돌 없음. `@ApiExcludeEndpoint()` 로 OpenAPI/swagger 생성물에서 제외되므로 프런트 클라이언트 생성 코드와의 충돌 가능성도 없음(swagger 산출물 grep 0건). 기존 `:id/...` 패턴의 POST 라우트들과 리터럴 경로가 달라 NestJS 라우트 매칭 순서 충돌 없음.
- **환경변수** `E2E_TEST_HOOKS` — spec/코드 전역에서 신규 도입, 기존 env var 이름과 겹치지 않음(grep 확인). 기존 e2e-only 게이팅 패턴(`NODE_ENV==='test'` 단독 체크)과 달리 이중 게이트를 추가한 것으로, 명명도 `E2E_` prefix 컨벤션에 부합.
- **DTO/타입 필드** `skipExecutedNodes?: boolean` (`NodeDispatchLoopParams`) — 기존 필드와 이름 겹침 없음, JSDoc 으로 case A/B 별 사용 여부까지 명시.
- **에러 코드** `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` / `WORKER_HEARTBEAT_TIMEOUT` / `EXECUTION_TIME_LIMIT_EXCEEDED` — 이번 PR 은 전부 **기존에 이미 정의된 코드를 재사용**(신규 부여 아님). `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md`, `spec/1-data-model.md`, `spec/5-system/6-websocket-protocol.md`, `spec/data-flow/3-execution.md` 전체에서 의미가 일관되게 갱신되어 있고(예: `WORKER_HEARTBEAT_TIMEOUT` 은 "PR3 기간 미발동, PR4 재정의 예약" 으로 명시), 코드(`RehydrationError`, `markExecutionCancelled` 호출부)와도 정합.
- **용어** `case A` / `case B`(§7.5) — `spec/4-nodes/3-ai/1-ai-agent.md` 등 AI 노드 spec 에서 별도 의미로 쓰이는 "case A/B" 는 없음(grep 결과 0건). 참고로 인접한 `exec-park D6` 레이블은 AI 노드 spec 의 동명 `D6`(output 경로 단일화)와 충돌 여지가 있어 spec 본문(§7.5) 이 이미 "**레이블 주의**: … 무관" 경고를 명시해 사전 차단하고 있음 — 이번 PR 이 새로 만든 충돌이 아니라 기존에 이미 방어된 항목.
- **상수** `STUCK_RECOVERY_STALE_MS` — 기존 상수 재사용(이번 PR 신규 아님), 스펙·코드 전역 일관.
- **plan 문서** `plan/in-progress/spec-draft-crash-running-redrive.md` 가 이번 PR 의 spec 변경을 사전에 정확히 스코핑했고, 구현된 식별자(`reclaimStuckRunningExecution` 등 함수명은 구현 세부라 plan 문서엔 없음)와 스펙 서술(§7.1~§7.5 Δ) 이 실제 반영 내용과 문구까지 일치.

## 요약

이번 PR(§7.1/§7.2/§7.3/§7.5 크래시·재시작 RUNNING 세그먼트 제어된 re-drive, PR3)이 도입하는 신규 식별자 — 서비스 메서드 5종, `_test/` 전용 API endpoint 1종, 환경변수 `E2E_TEST_HOOKS`, DTO 필드 `skipExecutedNodes`, 용어 `case A/case B` — 를 코드베이스·spec 전역과 대조한 결과 기존 사용처와의 명명 충돌은 발견되지 않았다. 재사용된 에러 코드(`RESUME_CHECKPOINT_MISSING` 등)도 여러 spec 문서에서 의미가 일관되게 갱신돼 있고, 잠재적으로 혼동 여지가 있던 `exec-park D6` 레이블은 이미 spec 본문이 명시적으로 다른 D6 와 구분해 놓아 재발 위험이 없다. `_test/` endpoint 는 `@ApiExcludeEndpoint()` 로 공개 API 표면에서 제외돼 프런트 클라이언트 생성 충돌 가능성도 없다.

## 위험도

NONE
