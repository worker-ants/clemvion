# 신규 식별자 충돌 Check — exec-park-durable-resume (scope: spec/5-system)

- **검토 모드**: 구현 착수 전 (--impl-prep)
- **Target**: `spec/5-system` (실질 변경 SoT: `4-execution-engine.md` §4.x/§6.1-2/§7.4-5/§Rationale + `1-data-model.md §2.13` + `conventions/conversation-thread.md §4/§7/§8.4`)
- **연동 plan**: `plan/in-progress/exec-park-durable-resume.md` (Phase A 완료 + PR-B1 완료)
- **BLOCK 판정**: **NO** (Critical 0 / Warning 0 / Info 3)

## 결론 요약

본 변경이 도입하는 신규 식별자는 모두 고유하며, 기존 사용처와 다른 의미로 겹치는 충돌이 없다. 마이그레이션 버전·DB 컬럼·에러 코드·내부 심볼·큐 이름을 6개 관점으로 전수 점검한 결과 충돌 없음. 신규 에러 코드는 컨벤션 레지스트리(error-handling §3 / websocket-protocol §4.x / data-model)에 일관 등재돼 있고, 신규 컬럼은 Execution 엔티티 내 기존 컬럼들과 의미·소비처가 명확히 분리된다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌 — 없음
본 plan 은 신규 요구사항 ID(예: `EXEC-*`)를 새로 부여하지 않는다 (구현 모델 갱신 + durable 컬럼 추가 성격). 충돌 표면 없음.

### 2. 엔티티/타입명 충돌 — 없음
- **신규 컬럼 `Execution.conversation_thread` / `Execution.user_variables`** (둘 다 `JSONB?`, V084/V085) 은 `1-data-model.md §2.13 Execution` 표에 등재됨 (L465/L466). 기존 컬럼 `input_data`(L456)·`output_data`(L457)·`error`(L458) 와 **의미·소비처가 분리**된다:
  - `user_variables` = `ExecutionContext.variables` 중 시스템 `__*` 제외 사용자분 (Variable Declaration/Modification 값). `input_data`(실행 입력)·`variables`(런타임 전체)와 혼동되지 않게 "시스템 `__*` 제외" 로 명시 disambiguation.
  - `conversation_thread` = park in-flight thread 스냅샷. 실행 이력 timeline 의 분산 SoT(`NodeExecution.output_data`/`interaction_data`)와 목적 분리가 컬럼 설명에 명문화됨. `agent_memory` 테이블(세션 간 메모리)과도 `1-ai-agent.md §12.13`/`conversation-thread.md §8.4`에서 명시 분리.
- **내부 심볼** `stageDurableResumeSnapshot`·`rehydrateUserVariables`·`rehydrateConversationThread`·`cancelParkedExecution` 은 `execution-engine.service.ts` / `shared/conversation-thread/` 모듈 내부 private 메서드로만 존재 (codebase grep: 정의·사용처 전부 해당 2개 모듈 한정). 타 모듈 동명 심볼 없음.
- (Info I1) `stageConversationThreadSnapshot` → `stageDurableResumeSnapshot` rename(A3) 이 service 에서 완전 적용됨 — 구 이름 잔존 참조 0건. 충돌·dangling 없음.

### 3. API endpoint 충돌 — 없음
본 변경은 신규 REST/endpoint 를 도입하지 않는다 (재개는 기존 `execution-continuation` 큐 경로 재사용, publisher 측 사전검증은 기존 WS `INVALID_EXECUTION_STATE` 재사용). endpoint 표면 충돌 없음.

### 4. 이벤트/메시지명 충돌 — 없음
- **큐 이름** `execution-run`/`execution-continuation`/`background-execution` 은 모두 **기존** 큐로, 각 1개 정의 파일(`queues/*.queue.ts`)에서 단일 선언. 본 변경은 신규 큐를 만들지 않고 기존 continuation 큐로 재개를 일원화. 충돌 없음.
- 신규 WS 이벤트 없음 — §Rationale "WS 신규 이벤트 도입 안 함" 원칙과 정합 (재개 실패는 기존 `execution.cancelled`/`EXECUTION_CANCELLED` 에 `error.code` 동봉).

### 5. 환경변수·설정키 충돌 — 없음
- 신규 ENV var 없음. `EXECUTION_MAX_ACTIVE_RUNNING_MS`·`MCP_MAX_CONCURRENT_CONNECTIONS` 등은 기존 키 재참조.
- `CHECKPOINT_SCHEMA_VERSION` 은 ENV/config 키가 아니라 checkpoint payload 에 동봉되는 **코드 상수(정수)** (`4-execution-engine.md §1.3` L117, `node-output.md` L208). 설정키 네임스페이스와 무관 — 충돌 표면 아님.

### 6. 파일 경로 충돌 — 없음
- 신규 spec 파일 없음 (기존 문서 in-place 갱신).
- **마이그레이션 파일** `V084__execution_conversation_thread.sql`·`V085__execution_user_variables.sql` 은 기존 `V080`–`V083` 다음 시퀀스로 단조 증가, 동일 버전 중복 없음. `V086__agent_memory_scope_updated_index`(별개 작업)와도 버전 충돌 없음. Flyway 명명 컨벤션 준수.

## Info (비차단)

- **I1 (해소 확인)**: A3 의 헬퍼 rename(`stageConversationThreadSnapshot`→`stageDurableResumeSnapshot`)이 service 전반에 완전 반영됨 (구명 잔존 0). 충돌·드리프트 아님.
- **I2 (cross-worktree 시퀀싱, 본 plan 외부)**: plan §진행메모 W4 가 기록한 대로, 병렬 `impl-concurrency-cap-pr2b` worktree 가 향후 마이그레이션 추가 시 **V086 이 이미 agent_memory 인덱스로 점유**돼 있으므로 PR2b 는 V087+ 로 renumber 해야 한다. 현재 main/본 worktree 에는 충돌이 없으나(PR2b 미착수), PR2b 착수 시점의 조율 사항. 본 변경 자체의 충돌은 아님 — 타 worktree 책임으로 plan 에 이미 명기됨.
- **I3 (SPEC-DRIFT 정합)**: `PARK_RELEASED` 는 내부 sentinel(반환값)로만 쓰이고 client 노출 에러 코드가 아니므로 error-codes 레지스트리 §3 에 미등재가 정상 — 코드/에러 어휘 네임스페이스 충돌 아님 (`4-execution-engine.md` L1258 SPEC-DRIFT 노트로 의도 명시).

## 점검 근거 (corpus)
- `spec/1-data-model.md §2.13` (Execution 컬럼 표), `spec/5-system/4-execution-engine.md` (§1.3/§4.x/§6.1-2/§7.4-5/§Rationale), `spec/conventions/conversation-thread.md §4/§7/§8.4`, `spec/conventions/error-codes.md` (§3 레지스트리), `spec/5-system/3-error-handling.md §3`, `spec/5-system/6-websocket-protocol.md §4.x`, `spec/4-nodes/3-ai/1-ai-agent.md §12.x`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/data-flow/3-execution.md`
- 코드 대조: `codebase/backend/migrations/V08{0..6}__*.sql`, `codebase/backend/src/modules/execution-engine/**`, `codebase/backend/src/shared/conversation-thread/**`
