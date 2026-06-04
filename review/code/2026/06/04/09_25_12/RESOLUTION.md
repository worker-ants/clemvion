# RESOLUTION — 09_25_12

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 (TOCTOU) | PR2 보류 | status 재검증→routing 등록 간 TOCTOU. debug 로그 존재. conditional UPDATE 원자화는 PR2 동시성 cap 구현과 함께. runExecutionFromQueue JSDoc 에 명시 (commit f2248a88) |
| #2 | 코드 (CONCURRENCY) | PR2 보류 | maxStalledCount:0 orphan RUNNING 슬롯. PR2 동시성 cap active count 보정 설계 시 반드시 포함. plan/in-progress/exec-intake-queue-impl.md 후속 기록 |
| #3 | SPEC-DRIFT | spec draft 위임 | spec §9.3 `execution-run` 행 "(target — §4)/구현 시 결정" → PR1 구현 완료 갱신. `plan/in-progress/spec-update-exec-intake-queue-pr1.md` |
| #4 | SPEC-DRIFT | spec draft 위임 | spec §11 `EXECUTION_RUN_WORKER_CONCURRENCY` 기본값 "(구현 시 결정)" → `1` + PR1 구현 완료. 동일 draft |
| #5 | SPEC-DRIFT | spec draft 위임 | spec §4 배너 "미구현 (Planned)" → "PR1 구현 완료" + §7.1/§8 Planned 유지. 동일 draft |
| #6 | 코드 (ARCHITECTURE) | f2248a88 | runExecutionFromQueue `@internal` JSDoc 추가 — ExecutionRunProcessor 전용 진입점 명시 |
| #7 | 코드 (ARCHITECTURE) | f2248a88 | input 소유권 트레이드오프 JSDoc — row.inputData vs job payload 관계, PR3 일원화 예정 명시 |
| #8 | 코드 (PERFORMANCE) | PR2 보류 | findOneBy DB 재조회 최적화. PR2 SELECT FOR UPDATE SKIP LOCKED 또는 job data status snapshot 검토 |
| #9 | 코드 (PERFORMANCE) | PR2 보류 | queue.add Redis 왕복 latency HTTP 경로 추가. 현 코드 변경 불필요. p99 모니터링 권장 |
| #10 | 테스트 (TESTING) | f2248a88 | conversationKey='' 경계값 테스트 복원 (trg-bad2 케이스) |
| #11 | 테스트 (TESTING) | f2248a88 | onFailed job 핸들 있는 경우 DEAD-LETTER 로그 검증 + opts.attempts undefined fallback 테스트 |
| #12 | 테스트 (TESTING) | f2248a88 | resolveExecutionRunWorkerConcurrency 공백 전용 문자열 + Number.MAX_SAFE_INTEGER 극단값 테스트 |
| #13 | 문서 (DOCUMENTATION) | f2248a88 | .env.example EXECUTION_RUN_WORKER_CONCURRENCY 주석 영어 재작성, "PR1 —" 레이블 제거 |
| #14 | 유지보수 (MAINTAINABILITY) | f2248a88 | triggerType = 'webhook' 임시 처리에 TODO(PR2) 주석 추가 — schedule 세분화 예정 명시 |
| #15 | 부수효과 (SIDE_EFFECT) | f2248a88 | execute() JSDoc: 큐 비동기 시작 타이밍 계약 + 반환 시 row PENDING 상태 명시 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (168/168)

## 보류·후속 항목

### PR2 보류 (코드 변경 미수행 — 민감 변경 아니지만 범위 초과)
- #1 TOCTOU: status 재검증→registerExecutionRouting 간격. PR2 conditional UPDATE 원자화 예정. runExecutionFromQueue JSDoc 에 명시됨.
- #2 orphan RUNNING 슬롯: PR2 동시성 cap active count 집계 시 반드시 보정 로직 포함.
- #8 findOneBy DB 재조회: PR2 SELECT FOR UPDATE SKIP LOCKED 검토.
- #9 queue.add Redis 왕복: 운영 모니터링 권장. 코드 변경 불필요.

### spec draft 위임 (ESCALATE=spec)
- SPEC-DRIFT #3: spec §9.3 execution-run 큐 행 갱신
- SPEC-DRIFT #4: spec §11 ENV 표 EXECUTION_RUN_WORKER_CONCURRENCY 기본값 갱신
- SPEC-DRIFT #5: spec §4 배너 "PR1 구현 완료" flip
- Draft 경로: `plan/in-progress/spec-update-exec-intake-queue-pr1.md`

### INFO 항목 (자동 수정 대상 아님 — PR2-4 이관)
- INFO #1: .env.example placeholder 패턴 (이번 PR1 신규 이슈 아님)
- INFO #2: job payload input Redis 직렬화 크기 검증 상위 의존
- INFO #3: PENDING orphan (recoverStuckExecutions RUNNING 만 수거) — PR2/PR3
- INFO #4: input 이중 저장 (DB + Redis) — PR3 rehydration 시 제거 검토
- INFO #5: removeOnFail:false → {count:1000} — PR4 DLQ 정리 시 함께
- INFO #6: forwardRef 순환 의존 — PR3 이후 별도 서브모듈 분리 검토
- INFO #7: triggerType 이분법 — PR2 ExecuteOptions.triggerType 필드 추가 시 교체
- INFO #8: queue.add 실패 시 PENDING orphan — PR2/PR3 recoverStuckExecutions PENDING 수거 확장
- INFO #9: buildExecutionRunJobId pass-through JSDoc 보강 — 후속
- INFO #10: 테스트 void .catch() 무음 — 후속 캡처 패턴 검토
- INFO #11: asRecorder 헬퍼 describe 내부 정의 — 후속 승격 검토
- INFO #12: 큐 등록 순서 — 기능 영향 없음, 후속 정렬
- INFO #13: enqueue 실패 PENDING orphan 테스트 미검증 — 후속
- INFO #14: buildExecutionRunJobId 빈 문자열 테스트 — 후속
- INFO #15: spec/data-flow/0-overview.md §4 / 16-system-status-api.md §1 execution-run 미등록 — 후속
- INFO #16: ExecutionRunJob 에 triggerType 미포함 — PR2 spec 반영 시 조정
