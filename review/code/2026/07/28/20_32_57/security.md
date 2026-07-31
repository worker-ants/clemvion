# 보안(Security) Review — retry_last_turn 재진입 원자 claim

대상 diff: `fix(engine): retry_last_turn 재진입의 비원자 가드 — 조건부 UPDATE claim 으로 교체 (#10 동반)` (commit b351731f0)

- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `applyRetryLastTurn` 에 조건부 UPDATE 원자 claim 블록 추가 (실질 변경)
- `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` — 주석만 정정 (기능 변경 없음)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` — 신규 claim 분기 테스트 추가 (테스트 전용, 프로덕션 실행 경로 아님)

## 발견사항

- **[INFO]** TOCTOU 레이스(CWE-362)를 원자적 조건부 UPDATE 로 닫은 정상적인 보안/무결성 개선
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:323-339`
  - 상세: 기존에는 `findOneBy` 로 읽은 `spawnedRow.status` 를 애플리케이션 레벨에서 분기(`!== RUNNING` 이면 discard)하는 read-then-branch 였다 — check(SELECT)와 act(이후 처리) 사이에 창이 있어, BullMQ 중복 배달(stalled 재배달·`CONTINUATION_WORKER_CONCURRENCY` 상향·멀티 인스턴스)에서 두 delivery 가 모두 통과할 수 있었다. 이번 변경은 `UPDATE ... SET input_data = input_data - '_retryState' WHERE id = :id AND status = 'running' AND jsonb_exists(input_data, '_retryState')` 형태의 단일 UPDATE 문으로 `_retryState` 키 제거와 상태 조건 확인을 한 원자 연산으로 묶었다. Postgres 는 단일 UPDATE 문 자체가 원자적이고 동시 UPDATE 는 대상 행 잠금으로 직렬화되므로, 두 번째 delivery 는 첫 번째가 커밋한 뒤 `jsonb_exists` 재평가에서 false 를 받아 `affected=0` 으로 안전하게 discard 된다(라인 333-339). `affected` 미정의 시에도 `?? 0` 으로 fail-closed(중복 실행 허용보다 정상 처리 drop 을 택함)이라 안전한 기본값이다. 이 클래스의 결함은 실제로 락 없는 인스턴스-로컬 `ExecutionContext` 공유로 인한 대화 상태 훼손, 중복 LLM API 과금, downstream 도구(Cafe24/MakeShop/MCP) 중복 실행이라는 실질적 피해로 이어질 수 있었던 것이라 보안 관점에서 유의미한 개선이다.
  - 제안: 없음(수정 요청 아님 — 확인된 개선사항으로 기록).

- **[INFO]** 신규 claim 쿼리의 SQL 인젝션 표면 없음 확인
  - 위치: `retry-turn.service.ts:326` (`.set({ inputData: () => \`input_data - '_retryState'\` })`), `:327` (`.where('id = :id', { id: spawnedNodeExecutionId })`), `:328-330` (`.andWhere('status = :running', { running: NodeExecutionStatus.RUNNING })`), `:331` (`` .andWhere(`jsonb_exists(input_data, '_retryState')`) ``)
  - 상세: raw SQL 조각(`input_data - '_retryState'`, `jsonb_exists(input_data, '_retryState')`)은 변수 삽입이 전혀 없는 고정 문자열 리터럴이며, 가변 값(`spawnedNodeExecutionId`, enum `NodeExecutionStatus.RUNNING`)은 전부 TypeORM 바인드 파라미터(`:id`, `:running`)로 전달된다. 동일 파일에서 기존에 이미 존재하던 `retryLastTurn` 의 `_retryState` 소비 쿼리(`:199-207`, `output_data - '_retryState'` / `jsonb_exists(output_data, '_retryState')`)와 완전히 동일한 안전 패턴이다. 사용자 입력이 SQL 문자열에 직접 연결되는 지점은 없다.
  - 제안: 없음.

- **[INFO]** 크래시-중단 턴 재배달 차단의 트레이드오프는 문서화됐고 실재하는 백스톱으로 완화됨
  - 위치: `retry-turn.service.ts:320-322` (주석), 백스톱: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `recoverStuckExecutions` (`:3040`)
  - 상세: 이번 claim 도입으로 워커 크래시로 중단된 턴의 BullMQ 재배달도 함께 막히는 트레이드오프가 생긴다(가용성 저하 방향). 주석은 이를 "형제 continuation 4종(`claimResumeEntry`)이 이미 같은 성질을 수용" 하고 "`recoverStuckExecutions` 백스톱이 담당" 한다고 서술하는데, grep 으로 `recoverStuckExecutions` 가 실제로 존재하는 부팅 시 stale RUNNING Execution 재회수 로직임을 확인했다 — 주석의 주장이 실체 없는 참조가 아니다. 완전 미회수로 영구 stuck 되는 가용성 결함은 아니다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 진입점(`retryLastTurn`)의 인증/인가는 본 diff 범위 밖이지만 정상 확인됨 — IDOR 우회 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:806-841` (본 diff 대상 파일 아님, 컨텍스트 확인용)
  - 상세: `applyRetryLastTurn` 은 BullMQ 워커(`continuation-execution.processor.ts`)에서만 호출되고, 그 job 은 `retryLastTurn` 호출이 이미 성공한 뒤에만 서버 측에서 enqueue 된다. `retryLastTurn` 의 WS 진입점은 `getCommandAuthContext` 로 인증을 확인하고 `verifyExecutionOwnership(data.executionId, auth.workspaceId)` 로 실행 소유권을 검증하며, 거부 시 Forbidden 이 아니라 NOT_FOUND 로 통일해 executionId 존재 여부를 통한 IDOR 추론을 막는다(주석에도 "attacker 가 executionId 의 존재 여부를 추론할 수 있다" 는 근거가 명시돼 있다). 본 diff 는 이 인가 경로를 변경하지 않았고, `applyRetryLastTurn` 내부 claim 로직도 `spawnedRow.executionId !== executionId` 검증(기존 코드, 라인 275) 이후에만 도달하므로 새로운 우회 경로를 만들지 않는다.
  - 제안: 없음(정보성 확인).

- 하드코딩된 시크릿(API 키/비밀번호/토큰/인증서) 검색 — 3개 대상 파일 전체에서 발견 없음 (`ENGINE_DRIVER` 는 NestJS DI 토큰 이름일 뿐 시크릿 아님).
- 암호화/해시 — 본 diff 는 암호화·해시·평문 전송과 무관.
- 에러 처리 — 신규 로그 문(`applyRetryLastTurn: ... claim 실패(affected=0)`)은 내부 엔티티 ID만 포함하며 스택트레이스·민감 데이터를 노출하지 않는다. `errMessage`/`execution.error` 관련 노출 처리(W16, 취소 시 error 미저장 등)는 본 diff 가 건드리지 않은 기존 코드로, 이미 이전 라운드에서 다뤄졌다.
- 의존성 보안 — 본 diff 는 신규 패키지/버전 변경 없음(TypeORM QueryBuilder API 만 사용).

## 요약

이번 변경은 `applyRetryLastTurn` 재진입 가드를 read-then-branch(check-then-act 창이 있는 TOCTOU) 에서 `status='running' AND jsonb_exists(input_data,'_retryState')` 조건부 UPDATE 기반 원자 claim 으로 교체하는 동시성 결함 수정이며, 신규 SQL 은 전부 파라미터 바인딩/고정 리터럴이라 인젝션 표면이 없고, 인증/인가 경로(WS 게이트웨이의 소유권 검증)는 diff 범위 밖에서 이미 정상 작동 중임을 확인했다. `continuation-execution.processor.ts` 변경은 주석 정정뿐이라 기능적 보안 영향이 없고, spec 파일 변경은 테스트 전용이다. 하드코딩 시크릿, 안전하지 않은 암호화, 에러 메시지를 통한 신규 정보 노출은 발견되지 않았으며, 문서화된 가용성 트레이드오프(크래시-중단 턴 재배달 차단)도 실재하는 백스톱(`recoverStuckExecutions`)으로 완화됨을 확인했다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE
