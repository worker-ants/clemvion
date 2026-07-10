# Cross-Spec 일관성 검토 — llm-usage-attr-hardening (impl-done)

- **diff 범위**: `git diff origin/main...HEAD` (커밋 `5e6f70b76` + `bc1810eb3`)
- **실제 코드 변경 파일 2개** (`git diff origin/main...HEAD -- codebase/` 로 직접 확인):
  - `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (+11/-2)
  - `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` (+48)
- 나머지 변경 파일(`review/code/**`, `review/consistency/**`)은 코드 리뷰/일관성 산출 문서이며 검토 대상 스펙에 영향 없음.

## 검토 방법

1. `ai-turn-executor.ts` diff: `LlmService` import 에 `type LlmCallContext` 추가, 기존 `const llmContext = {...}` 를 `const llmContext: LlmCallContext = {...}` 로 명시 타입 주석, 주석 4줄 추가. 객체 리터럴의 필드 구성(`workflowId`/`executionId`/`nodeExecutionId`)은 **불변** — 값도 표현식도 변경 없음.
2. `information-extractor.handler.spec.ts` diff: 기존 `describe('collection retry loop')` 블록에 신규 `it('passes the same llmContext attribution to the retried (2nd) chat call', ...)` 테스트 1건만 추가(append-only). production 코드 변경 없음.
3. `codebase/backend/src/modules/llm/llm.service.ts:41-46` 의 `LlmCallContext` 인터페이스(`workflowId?/executionId?/nodeExecutionId?`, 전부 optional)를 확인 — 신규 타입이 아니라 기존 export 인터페이스를 소비 지점에서 명시 표기한 것.
4. `spec/5-system/4-execution-engine.md` §1.3 "불변식 (usage-log attribution)" 콜아웃과 `spec/data-flow/7-llm-usage.md` §1.3 캐터로그·Rationale ("`llm_usage_log` 의 nullable context 컬럼들")을 대조.
5. `plan/in-progress/resume-llm-usage-attribution.md` "최종 /ai-review(02_09_15) INFO — 선택적 후속" 절(INFO#1, INFO#4)과 대조 — 본 diff 가 정확히 이 두 항목을 구현.

## 발견사항

없음. CRITICAL / WARNING / INFO 어느 등급도 해당하는 발견이 없다. 근거는 아래와 같다.

### 데이터 모델 충돌 — 없음

`LlmCallContext` 는 신규 엔티티/필드가 아니라 `codebase/backend/src/modules/llm/llm.service.ts:41` 에 이미 존재하는 export 인터페이스다. 소비 지점(`ai-turn-executor.ts:2602`)에 타입 주석을 붙였을 뿐 필드 구성·값 생성 로직 변경이 없다. `spec/data-flow/7-llm-usage.md` §2.1 `llm_usage_log` 스키마(`workflow_id?/execution_id?/node_execution_id?`)와 완전히 일치하며 이번 diff 로 인해 새로 생기거나 바뀌는 컬럼이 없다.

### API 계약 충돌 — 없음

컴파일 타임 타입 주석은 emit 되는 JS 에 아무 흔적을 남기지 않는다(TypeScript 표준 동작 — 인터페이스/타입 주석은 구조적 검사에만 쓰이고 컴파일 결과물에서 제거됨). `LlmService.chat`/`traceChat` 시그니처, 3번째 인자(`context?: LlmCallContext`) 어느 것도 변경되지 않았다(`llm.service.ts:157`, `:202` 그대로). 공개 API·엔드포인트·request/response shape 무변경.

### 요구사항 ID 충돌 — 없음

diff 어디에도 신규 요구사항 ID(`R-`, `WH-MG-`, `V-` 등 패턴)나 신규 spec 섹션 번호가 도입되지 않는다. 테스트 주석이 참조하는 `[Spec 7-llm-usage §1.3]` 은 기존 섹션이며, `plan/in-progress/resume-llm-usage-attribution.md` 에 이미 등록된 INFO#1/INFO#4 후속 작업 항목을 구현한 것이다(신규 plan 항목 아님).

### 상태 전이 충돌 — 없음

`waiting_for_input → resumed → ended` 상태 머신(`spec/5-system/4-execution-engine.md` §1.3)이나 `_resumeState`/`_resumeCheckpoint`/`_retryState` 보존 규약에 영향 주는 변경이 없다. resume 턴이 `state.workflowId`/`state.nodeExecutionId` 를 `llmContext` 로 전달하는 기존 로직(값·순서·조건 분기)은 그대로다.

### 권한·RBAC 모델 충돌 — 없음

인가·역할·워크스페이스 스코프 관련 코드·스펙 영향 없음. `llmContext` 는 서버 내부 생성 식별자만 담는다.

### 계층 책임 충돌 — 없음

`AiTurnExecutor` ↔ `LlmService` 경계, `InformationExtractorHandler` ↔ 테스트 파일 경계 모두 기존 구조 그대로다. 신규 모듈·의존성·순환 참조 없음(`review/code/2026/07/10/23_20_30/SUMMARY.md` 의 architecture/dependency reviewer 제외 사유와 동일 결론).

### spec 와의 정합성 (요청 사항 2·3·4 종합 판단)

- **spec 를 앞서가는가**: 아니다. `spec/5-system/4-execution-engine.md` §1.3 불변식 콜아웃이 이미 "`CREDENTIAL_CONTEXT_FIELDS`/`resumeStateSchema` 리팩터 시 반드시 보존" 하라고 명시한 회귀 방지 요구를, 이번 diff 가 (a) TS 컴파일 타임 필드-오탈자 차단(명시 타입 주석)과 (b) 회귀 테스트 추가로 **정확히 이행**한다. spec 가 이미 서술한 것보다 앞서 나가는 미문서화 신동작이 없다.
- **spec 에 뒤처지는가**: 아니다. §1.3 캐터로그 표의 "AI Agent 노드 … 첫 턴은 `context.*`, resume 턴은 재구성 `state.*`" 서술과 `information-extractor.handler.ts` 의 `traceChat` 서술 그대로 코드가 동작하며 diff 는 이 기존 동작을 변경하지 않는다.
- **stale 해지는 spec 문서 유무**: 없다. 런타임 동작이 0-변경이므로 어떤 spec 문서도 이 diff 때문에 stale 해지지 않는다. (참고: 저장소에는 `plan/in-progress/resume-llm-usage-attribution.md` 에 등록된 별도의 미완료 spec 정정 항목들 — `spec/data-flow/6-knowledge-base.md:348`, `spec/data-flow/13-agent-memory.md:231`, `spec/data-flow/7-statistics.md` §3 등 — 이 존재하지만, 이들은 본 diff 이전부터 이미 open 이던 별개 후속 작업이며 본 diff 가 유발하거나 악화시키지 않는다.)
- **신규 요구사항 ID / 신규 엔티티 / 신규 API 도입 여부**: 전부 아니다(위 각 항목 참조).

## 요약

이번 diff 는 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 의 기존 `llmContext` 객체 리터럴에 이미 export 되어 있던 `LlmCallContext` 타입을 명시 주석으로 붙이고, `information-extractor.handler.spec.ts` 에 회귀 방지 테스트 1건을 추가한 순수 컴파일 타임/테스트 하드닝으로, 런타임 동작·공개 API·데이터 모델·상태 전이·RBAC·계층 경계 어느 것도 변경하지 않는다. `spec/5-system/4-execution-engine.md` §1.3 의 "불변식 (usage-log attribution)" 콜아웃이 요구하는 회귀 보호를 그대로 이행하는 내용이라 기존 spec 과 완전히 정합하며, 신규 요구사항 ID·엔티티·API 도입도 없다. Cross-spec 관점에서 어떤 영역과도 충돌하지 않는다.

## 위험도

NONE

STATUS: DONE
