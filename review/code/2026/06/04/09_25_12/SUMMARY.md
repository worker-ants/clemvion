# Code Review 통합 보고서

> PR1 — exec-intake-queue: `execute()` fire-and-forget in-process 호출을 BullMQ `execution-run` 큐 기반 work-stealing 으로 전환

## 전체 위험도

**MEDIUM** — 동시성 TOCTOU 경쟁 조건 1건(concurrency 리뷰어 단독 MEDIUM 판정). 나머지 reviewer 중 9개 LOW, 1개 NONE. 개별 Critical 발견 없음. SPEC-DRIFT 3건(spec 갱신 필요, 코드 revert 불필요).

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CONCURRENCY | `runExecutionFromQueue` — status 재검증(`findOneBy`)과 `registerExecutionRouting` 호출 사이 TOCTOU 간격. cancel API / recoverStuckExecutions 가 row 상태를 변경하면 stale routing context 가 Map 에 잔류 가능. PR2 동시성 cap 구현 시 실질 문제로 발전 가능성 높음 | `execution-engine.service.ts` `runExecutionFromQueue()` | status 재검증을 DB conditional UPDATE(`WHERE status='pending' RETURNING *`)로 원자화하거나, 최소한 재검증 후 불일치 시 로깅으로 운영 가시성 확보. PR2 전 처리 권장 |
| 2 | CONCURRENCY | `maxStalledCount: 0` 으로 worker crash 시 RUNNING row 가 최장 30분(`recoverStuckExecutions` 주기) 방치. PR2 동시성 cap 구현 시 orphan RUNNING 슬롯이 처리량 집계에 계속 포함되어 실제 처리량 저하 가능 | `execution-run.queue.ts` `EXECUTION_RUN_MAX_STALLED_COUNT=0` | 설계 의도(PR3/PR4 범위) 유지하되, PR2 동시성 cap 구현 시 orphan RUNNING row 를 active count 에서 제외하는 보정 로직 반드시 포함 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] spec §9.3 BullMQ 큐 목록 표에 `execution-run` 행 미등재. 코드 구현은 옳고 spec-draft 에 이미 명시됨. spec 본문 갱신 필요 | `spec/5-system/4-execution-engine.md §9.3` (line 981–986) | 코드 유지. spec §9.3 표에 `execution-run` 행 추가(jobId=executionId·attempts=1·역할 설명). §9.3 NOTE 표현도 정정. project-planner 위임 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] spec §11 ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY` 미등재. 코드와 `.env.example` 은 spec §11 을 SoT 로 인용하나 spec 본문에 행 없음 | `spec/5-system/4-execution-engine.md §11` (line 1077–1081) | 코드 유지. spec §11 ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY | 1 | ...` 행 추가. project-planner 위임 |
| 5 | SPEC-DRIFT | [SPEC-DRIFT] spec §4 배너가 여전히 "§4.1~4.3 미구현(Planned)"이고 §4.1–4.3 본문이 per-node task queue(구 모델)를 기술. 코드는 execution-level intake 큐로 이미 구현 완료하여 per-node 모델 폐기됨 | `spec/5-system/4-execution-engine.md §4` (line 348–390) | 코드 유지. §4 배너를 "PR1 구현됨"으로 갱신, §4.1–4.3 본문을 spec-draft-exec-intake-queue.md §1 내용으로 교체. project-planner 위임 |
| 6 | ARCHITECTURE | `runExecutionFromQueue` 가 `public` 메서드로 노출 — worker 전용 진입점이나 모듈 외부 접근 가능. TypeScript `private` 불가(NestJS DI) | `execution-engine.service.ts` `runExecutionFromQueue()` | `/** @internal — only called by ExecutionRunProcessor */` JSDoc 주석 추가로 소비자 명시 |
| 7 | ARCHITECTURE | `execute()` 와 `runExecutionFromQueue()` 사이 `input` 데이터 소유권 불명확 — row `inputData` 와 job payload `input` 이 diverge 하는 경우 동작 미정의 | `execution-engine.service.ts` enqueue 블록 + `runExecutionFromQueue` | PR3 멱등 rehydration 도입 시 `runExecution(execution, execution.inputData)` 로 일원화 검토. 현재는 JSDoc 에 트레이드오프 명시 |
| 8 | PERFORMANCE | `runExecutionFromQueue` 매 job 마다 `findOneBy` DB 재조회(추가 SELECT). concurrency 증가 시 동시 SELECT 누적 | `execution-engine.service.ts` `runExecutionFromQueue()` 첫 블록 | PR2 동시성 cap 구현 시 `SELECT FOR UPDATE SKIP LOCKED` 또는 job data 에 status snapshot 포함 패턴 검토 |
| 9 | PERFORMANCE | `execute()` 에서 `executionRunQueue.add()` await — Redis 왕복 레이턴시가 HTTP 응답 경로에 추가됨(로컬 0.5–2ms, cross-AZ 1–10ms) | `execution-engine.service.ts` `execute()` | 현재 코드 변경 불필요. 관리형 Redis 환경에서 queue.add latency p99 모니터링 알람 추가 권장 |
| 10 | TESTING | `chatChannel.conversationKey` 빈 문자열 경계값 테스트 제거 — `runExecutionFromQueue` 리팩터링 과정에서 대응 테스트 없이 삭제됨. `extractChatChannelFromInput` `conversationKey` 경계값 커버리지 갭 | `execution-engine.service.spec.ts` (기존 `trg-bad2` 케이스 삭제) | `runExecutionFromQueue — routing context 재등록` describe 에 `conversationKey=''` 케이스 복원 |
| 11 | TESTING | `ExecutionRunProcessor.onFailed` — job 핸들 있는 경우의 로그 포맷, `job.opts?.attempts` undefined 시 fallback 경로 미검증 | `execution-run.processor.spec.ts` (55라인 전체) | job 객체 있는 경우의 `onFailed` 테스트 추가 — executionId·시도 횟수 포함 경고 로그 메시지 검증 |
| 12 | TESTING | `resolveExecutionRunWorkerConcurrency` — 공백 전용 문자열(`'   '`) 입력, 극단값(`Number.MAX_SAFE_INTEGER`) 미테스트 | `execution-run.queue.spec.ts` | `bad` 배열에 공백 전용 케이스 추가, 극단값 동작 문서화 테스트 추가 |
| 13 | DOCUMENTATION | `.env.example` 신규 `EXECUTION_RUN_WORKER_CONCURRENCY` 주석이 한국어로 작성 — 기존 영어 관행(특히 `CONTINUATION_WORKER_CONCURRENCY`)과 불일치. "PR1 —" 내부 레이블 노출 | `codebase/backend/.env.example` line 213–217 | 영어로 재작성 + "PR1 —" 접두어 제거. `CONTINUATION_WORKER_CONCURRENCY` 패턴 참고 |
| 14 | MAINTAINABILITY | `execute()` 내 `triggerType = 'webhook'` 이 schedule 실행도 덮어씀 — 의도된 임시 처리이나 schedule 실행이 webhook 우선순위를 받는다는 사실을 놓칠 위험 | `execution-engine.service.ts` `execute()` `const triggerType = options?.executedBy ? 'manual' : 'webhook'` | 코드 바로 옆에 `// TODO(PR2): trigger type threading 으로 schedule 세분화` 주석 추가 명시 |
| 15 | SIDE_EFFECT | `execute()` 메서드 동작 계약 변경(실행 타이밍 지연) 미문서화 — 공개 인터페이스 동일하나 반환 직후 실행이 임의 시점/인스턴스에서 시작됨이 JSDoc 에 반영 안 됨 | `execution-engine.service.ts` `execute()` JSDoc | `execute()` JSDoc 에 "반환 직후 실행은 큐에서 비동기 시작됨, row 는 PENDING 상태" 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `.env.example` — `S3_ACCESS_KEY=minioadmin`, `S3_SECRET_KEY=minioadmin` 이 placeholder 패턴(`change-me-*`)을 따르지 않음. `ENCRYPTION_KEY` 예시값도 동일 | `codebase/backend/.env.example` line 88–89, 154–155, 184 | `change-me-minio-access-key` 형태로 변경. 이번 PR1 신규 도입 이슈는 아님 |
| 2 | SECURITY | job payload `input: unknown` 이 Redis 에 직렬화됨 — 상위 레이어 크기 제한 의존. 내부 경로(Sub-Workflow 등)도 동일 검증 적용 여부 미확인 | `execution-run.queue.ts` `ExecutionRunJob.input`, `execution-run.processor.ts` | 상위 레이어 보호가 모든 진입점 커버하는지 문서화, 또는 worker 진입점에 zod 스키마 검증 추가 |
| 3 | SECURITY | `maxStalledCount: 0` + `attempts: 1` — worker crash 시 PENDING 상태 영구 고착 가능. `recoverStuckExecutions` 가 RUNNING 만 수거 | `execution-run.queue.ts` | PR1 범위 내 허용된 trade-off. PENDING row 수거를 PR2/PR3 에서 검토 |
| 4 | PERFORMANCE | `input` 데이터 DB(`inputData`)와 Redis job payload 이중 저장 — 정상 완료 시 `removeOnComplete: true` 로 즉시 제거되나 large input 대기 중 Redis 누적 | `execution-engine.service.ts` enqueue, `execution-run.queue.ts` `ExecutionRunJob` | PR3 rehydration 시 job payload 에서 `input` 제거 검토 |
| 5 | PERFORMANCE | `removeOnFail: false` — 실패 job 이 Redis 무기한 보존. 대규모 실패 시 `failed` sorted set 급증 가능 | `execution-run.queue.ts` `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` | `removeOnFail: { count: 1000 }` 으로 교체. PR4 DLQ/관측성 정리 시 함께 검토 |
| 6 | ARCHITECTURE | `ExecutionRunProcessor → ExecutionEngineService` `forwardRef` 순환 의존 — 기존 `BackgroundExecutionProcessor` 패턴 답습, PR3 이후 누적 위험 | `execution-run.processor.ts` line 53–58 | PR3 이후 별도 서브모듈 분리 또는 `IExecutionRunHandler` 인터페이스 추상화 검토 |
| 7 | ARCHITECTURE | `execute()` `triggerType` 추론이 이분법(`executedBy` 유무 → manual/webhook) — spec §4.3 3-tier 미완성. plan 에 후속으로 명시 추적 중 | `execution-engine.service.ts` diff | PR2 에서 `ExecuteOptions.triggerType` 필드 추가 시 교체 |
| 8 | CONCURRENCY | `execute()` 에서 `executionRunQueue.add()` 실패 시 PENDING row orphan — `recoverStuckExecutions` 가 RUNNING 만 수거하므로 영구 PENDING 잔류 가능 | `execution-engine.service.ts` `execute()` | `queue.add` 실패 시 row 를 FAILED 로 마킹하거나, `recoverStuckExecutions` 에 오래된 PENDING 수거 로직 추가. PR2 동시성 cap 집계와 함께 검토 |
| 9 | MAINTAINABILITY | `buildExecutionRunJobId` 가 현재 pass-through(입력 그대로 반환) — PR3/PR4 확장 위한 인터페이스 경계. 호출자 필수 경유 의도 JSDoc 보강 필요 | `execution-run.queue.ts` line 36–38 | JSDoc 에 "향후 `<executionId>:run:<seq>` 형식 변경 예정. 호출자는 반드시 이 함수 경유" 명시 |
| 10 | MAINTAINABILITY | 테스트 `void ... .catch(() => undefined)` 패턴 — 브릿지 에러 완전 무음 처리. 실패 경로 검증 누락 가능 | `execution-engine.service.spec.ts` mock `add` 구현 | `.catch(err => { if (err) capturedError = err; })` 캡처 패턴으로 교체하거나 무음 이유 주석 보강 |
| 11 | MAINTAINABILITY | `asRecorder` 헬퍼가 describe 블록 내부에 정의 — 재사용 범위 제한 | `execution-engine.service.spec.ts` `describe('execute() — ...')` 내부 | 최상위 describe 로 승격 또는 인자 받는 유틸 함수로 추출 |
| 12 | MAINTAINABILITY | BullMQ 큐 등록 순서 — `EXECUTION_RUN_QUEUE` 가 `CONTINUATION_EXECUTION_QUEUE` 뒤에 등록됨(실행 흐름과 역순) | `execution-engine.module.ts` imports 배열 | `EXECUTION_RUN_QUEUE` 를 `BACKGROUND_EXECUTION_QUEUE` 직후, `CONTINUATION_EXECUTION_QUEUE` 직전으로 이동(기능 영향 없음) |
| 13 | TESTING | `execute()` enqueue 실패 시 PENDING orphan row 처리 경로 미검증 | `execution-engine.service.spec.ts` | `executionRunQueue.add` reject 시 `execute()` 동작 및 row 상태 검증 테스트 추가(또는 `recoverStuckExecutions` 의존 주석 명시) |
| 14 | TESTING | `execution-run.queue.spec.ts` `buildExecutionRunJobId` — 빈 문자열 입력 미검증. BullMQ dedup 관점 edge case | `execution-run.queue.spec.ts` `buildExecutionRunJobId` describe | 빈 문자열 입력 동작 명시 테스트 추가 또는 생산 코드 assertion 추가 |
| 15 | DOCUMENTATION | `spec/data-flow/0-overview.md §4` 와 `spec/5-system/16-system-status-api.md §1` 에 `execution-run` 미등록 — 코드 JSDoc 참조 spec 섹션 미완성. plan 후속 추적 중 | plan/in-progress/exec-intake-queue-impl.md 후속 목록 | 메서드 JSDoc 에 해당 spec 섹션 업데이트 예정 TODO 주석 추가 고려 |
| 16 | REQUIREMENT | spec draft §4.2 job 메시지 형식에 `triggerType` 필드 명시되나 `ExecutionRunJob` 인터페이스에 미포함 — plan 에 "후속" 의도된 미구현 명시 | `execution-run.queue.ts` `ExecutionRunJob` 인터페이스 | 코드 유지. spec draft §4.2 를 spec 본문 반영 시 PR1 실제 구현(triggerType 없음)에 맞게 조정 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | MEDIUM | TOCTOU 경쟁 조건(runExecutionFromQueue status 재검증↔routing 등록 간격), orphan RUNNING 슬롯 집계, PENDING orphan row |
| security | LOW | INFO 4건: .env.example placeholder 불일치, input 크기 검증 상위 의존, PENDING 고착, unknown 역직렬화 신뢰 경계 |
| performance | LOW | WARNING 2건: 매 job DB 재조회, Redis 왕복 HTTP 레이턴시 추가 |
| architecture | LOW | WARNING 2건: runExecutionFromQueue public 노출, input 소유권 불명확. INFO 5건: 순환 의존, 이분법 triggerType 등 |
| requirement | LOW | SPEC-DRIFT WARNING 3건: §9.3/§11/§4.1–4.3 spec 미갱신. 모두 코드 옳고 spec 갱신 필요 |
| side_effect | LOW | WARNING 3건: execute() 행동 계약 변경 미문서화, 모듈 로드 concurrency 고정, runExecutionFromQueue public 노출 |
| maintainability | LOW | WARNING 2건: triggerType 'webhook' 의미 오독, 테스트 브릿지 silent error swallowing |
| testing | LOW | WARNING 3건: conversationKey='' 케이스 삭제, onFailed 커버리지 불완전, concurrency 파서 경계값 미테스트 |
| documentation | LOW | WARNING 2건: .env.example 주석 한국어 불일치 + PR1 내부 레이블 노출, spec 섹션 동기화 미완 |
| scope | NONE | 범위 외 변경 없음. 모든 변경이 PR1 의도와 정확히 일치 |

---

## 발견 없는 에이전트

- **scope** — 범위 이탈 없음(NONE). 변경 파일 집합이 PR1 plan 명시 목록과 정확히 일치.

---

## 권장 조치사항

1. **(즉시 / PR2 전 필수)** `runExecutionFromQueue` TOCTOU 해소 — status 재검증을 DB conditional UPDATE 로 원자화하거나, 불일치 시 routing Map cleanup + 로깅 추가 (WARNING #1)
2. **(즉시 권장)** `execute()` JSDoc 에 "실행은 큐에서 비동기 시작, 반환 시 row 는 PENDING" 명시 + `runExecutionFromQueue` 에 `@internal` JSDoc 추가 (WARNING #6, #15)
3. **(단기 / 테스트 커버리지)** `conversationKey=''` 경계값 테스트 복원, `onFailed` job-present 분기 테스트 추가, 공백 전용 concurrency 파서 케이스 추가 (WARNING #10, #11, #12)
4. **(단기 / 문서)** `.env.example` `EXECUTION_RUN_WORKER_CONCURRENCY` 주석 영어로 재작성, "PR1 —" 접두어 제거 (WARNING #13)
5. **(PR2 설계 시 반드시 고려)** orphan RUNNING 슬롯을 동시성 cap active count 에서 제외하는 보정 로직 포함 (WARNING #2)
6. **(PR2/PR3)** `execute()` enqueue 실패 시 PENDING orphan row 처리 — row FAILED 마킹 또는 `recoverStuckExecutions` PENDING 수거 확장 (INFO #8)
7. **(spec 갱신 — project-planner 위임)** SPEC-DRIFT 3건: spec §9.3 `execution-run` 큐 행 추가, §11 ENV 표 `EXECUTION_RUN_WORKER_CONCURRENCY` 행 추가, §4.1–4.3 배너·본문 갱신 (WARNING #3, #4, #5)
8. **(PR4 / 운영)** `removeOnFail: false` → `{ count: 1000 }` 교체로 Redis failed set 누적 제한 (INFO #5)
9. **(낮은 우선순위)** `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` 에 `as const` 추가, 모듈 내 큐 등록 순서 정렬(`EXECUTION_RUN_QUEUE` 를 CONTINUATION 앞으로 이동)

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행함 (`routing_status=done`).

- **실행** (10명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`
- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외** (4명):

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 라우터 판단으로 제외 |
| database | 라우터 판단으로 제외 |
| api_contract | 라우터 판단으로 제외 |
| user_guide_sync | 라우터 판단으로 제외 |