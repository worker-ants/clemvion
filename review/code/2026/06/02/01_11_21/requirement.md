# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] `cancel` 핸들러의 TODO — 기존 미완성 항목
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/continuation-worker-concurrency-env/codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` 93번째 줄
- 상세: `applyCancellation` 이 `void` fire-and-forget 으로 호출되고 있으며, `// TODO: async 전환 시 void 제거 후 await 복원 필요.` 주석이 존재한다. 본 변경(concurrency 설정화)이 도입한 TODO 는 아니고, 기존 코드에서 유지된 것이다. 그러나 concurrency 가 1 이상으로 상향될 경우 여러 continuation job 이 병렬로 처리되는 상황에서 `cancel` job 의 fire-and-forget 완료 여부가 추적되지 않는다는 잠재 위험이 있다.
- 제안: concurrency 상향을 허용하는 이번 변경에서 이 TODO 를 처리하거나, 적어도 concurrency > 1 일 때의 위험도를 plan 에 명시할 것을 고려한다. (spec 은 침묵 — spec 결함 의심이 아닌 구현 위험)

### [INFO] spec §7.4 "메시지 타입" 행에 `retry_last_turn` 미등재 (pre-existing)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/continuation-worker-concurrency-env/spec/5-system/4-execution-engine.md` 780번째 줄
- 상세: 스펙 §7.4 Continuation Bus 테이블의 "메시지 타입" 행에 `continue / cancel / button_click / ai_message / ai_end_conversation` 5종만 나열되어 있으나, `ContinuationJob.type` 에는 `retry_last_turn` 이 추가로 존재하고 프로세서의 switch 문도 이를 처리한다. 본 변경이 도입한 불일치가 아니며 기존 차이이지만, Worker 동시성 행 추가 시 메시지 타입 행도 함께 갱신할 기회였다.
- 제안: `project-planner` 위임 — §7.4 "메시지 타입" 행에 `retry_last_turn` 추가.

### [INFO] 테스트 파일명 불일치 — 계획과 실제
- 위치: `plan/in-progress/continuation-resume-optional-followups.md` (plan) vs 실제 파일 경로
- 상세: plan 에서 테스트를 `continuation-execution.queue.spec.ts` 에 작성한다고 명시하고 있고, 실제로 `/Volumes/project/private/clemvion/.claude/worktrees/continuation-worker-concurrency-env/codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.spec.ts` 가 존재하며 내용도 계획과 일치한다. 불일치 없음.

### [INFO] spec §11 섹션 번호 오기 — 10.3 이 §11 안에 위치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/continuation-worker-concurrency-env/spec/5-system/4-execution-engine.md` 1065번째 줄
- 상세: `CONTINUATION_WORKER_CONCURRENCY` 행이 추가된 §11 Graceful Shutdown 의 config 표(1059-1063번째 줄) 아래에 `### 10.3 호출 순서` 서브섹션(1065번째 줄)이 이어진다. 이것은 번호 체계가 뒤섞인 pre-existing spec 오류이며, 본 변경이 도입한 것이 아니다. config 표의 위치는 spec §11 문맥(Graceful Shutdown 환경 변수 표)과 정합하고, 새 행의 삽입 위치는 적절하다.
- 제안: `project-planner` 위임 — `### 10.3 호출 순서` 번호를 `### 11.3` 등으로 수정하거나 §10 내부 서브섹션인지 확인.

## 기능 완전성 평가

### 기능 구현 점검

1. **환경변수 도입**: `CONTINUATION_WORKER_CONCURRENCY` 가 `.env.example` 에 문서화되고 기본값 1, fallback 규칙(비양수·비정수·비숫자 → 1)이 명시됨. 완전.

2. **파서 함수 구현**: `resolveContinuationWorkerConcurrency()` 가 `continuation-execution.queue.ts` 에 순수 함수로 구현됨. 정규식 `/^\d+$/` 선검증 후 `Number.isInteger && > 0` 이중 검증. `continuation-dlq-monitor.config.ts` 의 `parsePositiveInt` 와 패턴 일치. 완전.

3. **@Processor 데코레이터 주입**: `ContinuationExecutionProcessor` 의 `@Processor` 데코레이터에 `{ concurrency: resolveContinuationWorkerConcurrency() }` 가 주입됨. DI 이전 모듈 로드 시점에 `process.env` 에서 직접 읽는 방식으로 NestJS DI 제약을 올바르게 우회함.

4. **spec 등록**: §7.4 "Worker 동시성" 행 + §11 `CONTINUATION_WORKER_CONCURRENCY` 행 모두 추가됨. spec 명세와 구현이 정합.

5. **테스트 범위**: `양수 정수` / `미설정` / `빈 문자열·공백` / `비숫자·0·음수·소수·공학표기·16진수` / `trim` 케이스 전부 커버됨.

### 엣지 케이스 처리

- `undefined` (미설정): `raw === undefined` 분기에서 기본값 반환. 정상.
- 빈 문자열 `""`: `.trim()` 후 `/^\d+$/` 불일치 → 기본값. 정상.
- 공백만 `"   "`: `.trim()` → `""` → 정규식 불일치 → 기본값. 정상.
- `"1e10"` (공학표기): 정규식 `/^\d+$/` 불일치(문자 `e` 포함) → 기본값. 정상.
- `"0x10"` (16진수): `x` 포함으로 정규식 불일치 → 기본값. 정상.
- `"0"`: 정규식 통과 → `Number(0) = 0` → `parsed > 0` 조건 실패 → 기본값. 정상.
- `"-1"`: `-` 포함으로 정규식 `/^\d+$/` 불일치 → 기본값. 정상.
- `"2.5"`: `.` 포함으로 정규식 불일치 → 기본값. 정상.
- 대형 값 (예: `"999"`) : 정규식 통과 → `Number.isInteger(999) && 999 > 0` → 그대로 반환. BullMQ 가 내부적으로 concurrency 상한을 부여하는지는 BullMQ 문서 의존이나, 이는 운영 가이드 범주이며 spec 도 침묵.

### 반환값

`resolveContinuationWorkerConcurrency` 의 모든 경로에서 `number` 를 반환함. undefined/null 경로 없음.

### 에러 시나리오

파서 함수 자체는 throw 하지 않으며 모든 잘못된 입력을 기본값으로 degraded-safely 처리한다. 설계 의도와 일치.

### 비즈니스 로직

spec §7.4 "Worker 동시성" 설명("기본 1 — 인스턴스당 직렬. 대량 동시 resume 의 setup latency 가 관측되면 상향")과 코드 기본값(`DEFAULT_CONTINUATION_WORKER_CONCURRENCY = 1`) 및 `.env.example` 주석이 일치한다.

## 요약

이번 변경은 `CONTINUATION_WORKER_CONCURRENCY` 환경변수를 통해 continuation worker 의 BullMQ concurrency 를 외부에서 설정 가능하도록 하는 단일 목적 기능이다. 파서 함수(`resolveContinuationWorkerConcurrency`)의 엣지 케이스 처리(정규식 선검증 + isInteger + > 0)는 기존 `continuation-dlq-monitor.config.ts` 의 `parsePositiveInt` 패턴과 일관되며, 단위 테스트가 모든 명시된 케이스를 커버한다. spec §7.4 "Worker 동시성" 행과 §11 `CONTINUATION_WORKER_CONCURRENCY` 행이 함께 추가되어 spec 과 구현의 line-level 정합성이 확보됐다. 기존 `cancel` 핸들러의 `void` fire-and-forget TODO 는 concurrency 상향 허용 시 잠재 위험이 있으나 critical 이상의 결함은 아니며 pre-existing 이다. spec §7.4 "메시지 타입" 행의 `retry_last_turn` 미등재도 pre-existing 불일치로 본 변경과 무관하다. 요구사항 관점에서 의도한 기능을 완전히 충족하며 심각한 결함 없음.

## 위험도

LOW
