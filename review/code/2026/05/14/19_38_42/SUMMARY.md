# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Prompt Injection 경로(sanitization 미정의), ExecutionContext 인터페이스 파괴적 변경의 비테스트 코드 영향 미검증, ConversationThread 핵심 기능 테스트 완전 부재가 복합적으로 존재.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `ExecutionContext` 인터페이스에 `conversationThread` required 필드 추가 — 테스트 외 모든 컨텍스트 생성 지점(핸들러·팩토리 등)에서 컴파일 오류 또는 런타임 `undefined` 위험 | `backend/src` 전체 | `grep -r "ExecutionContext" backend/src --include="*.ts" \| grep -v spec` 로 생성 지점 전수 확인; `conversationThread?` optional 선언 또는 모든 생성 지점에 `createEmptyConversationThread()` 일괄 주입 |
| 2 | Testing | ConversationThread 핵심 기능 — `appendPresentationTurn()`, `appendAiUserTurn()`, cap 한계, `system_text`/`messages` 렌더링, `contextScope` 필터, `createEmptyConversationThread()` 초기 상태 — 단위 테스트 완전 부재 | 신규 `spec/conventions/conversation-thread.md`, `spec/5-system/4-execution-engine.md` 등 | `conversation-thread.service.spec.ts`, `thread-renderer.spec.ts` 신설하여 누적·주입 경로 전체 커버 |
| 3 | Testing | Background 격리 불변량(ND-BG-05) 검증 테스트 부재 — shallow copy 구현 시 `turns` 배열 참조 공유가 발생해도 탐지 불가 | `spec/5-system/4-execution-engine.md` §3.3 | `bgThread.turns.push(mockTurn)` 후 `mainThread.turns` 길이가 0임을 단언하는 격리 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `contextInjectionMode='system_text'` 에서 form 사용자 입력이 sanitization 없이 LLM system prompt 끝에 첨부 — Prompt Injection 경로 오픈 (spec은 "권장"으로만 기술) | `spec/conventions/conversation-thread.md` §5.2 | `sanitizeLlmProvidedString` 적용을 구현 필수 규약으로 격상; `spec/conventions/security-sanitization.md` 신설하여 처리 범위 명문화 |
| 2 | Security | WebSocket `execution.waiting_for_input` payload에 `conversationThread` 전체 turns 동봉 — WS 인증이 느슨하면 타인의 대화 내역 노출 가능 | `spec/5-system/6-websocket-protocol.md` §4.4.5 | `conversationThread` 포함 전 execution 소유권 검증 게이트 명시; WS authorization 범위를 spec에 명기 |
| 3 | Security / Concurrency | Background shallow copy(`{ ...thread, turns: [...thread.turns] }`)는 `ConversationTurn` 내부 중첩 객체(`data` 필드 등) 참조를 공유 — background 핸들러의 turn 내부 mutate가 main thread 오염 유발 | `spec/5-system/4-execution-engine.md` §3.3 | `ConversationTurn`을 `Readonly<T>` 강제 또는 `structuredClone` 사용 명시; 최소한 "turn 내부 mutate 금지(immutable turn 불변량)" 계약을 spec에 추가 |
| 4 | Database / API Contract | `interaction_data.interactionType` 값 `"form_submit"` → `"form_submitted"` 변경 — 기존 DB row 불일치 및 마이그레이션 전략 미정 | `spec/1-data-model.md` §2.14 | 구현 착수 전 `SELECT DISTINCT interaction_data->>'interactionType' FROM node_execution` 실행; 기존 row 존재 시 one-off UPDATE 스크립트 필수; spec에 "spec-only 정정" 또는 "DB 마이그레이션 필요" 명시 |
| 5 | Side Effect / Testing | `buttons.spec.ts` 3개 파일이 모듈 레벨 단일 `context` 객체 공유 — `conversationThread.turns`가 mutable이면 테스트 간 상태 오염 | `chart/buttons.spec.ts`, `table/buttons.spec.ts`, `template/buttons.spec.ts` | `beforeEach`에서 `conversationThread: createEmptyConversationThread()` 재생성 패턴으로 변경 |
| 6 | Testing | `text_classifier` / `information_extractor` — spec은 "v1 push 적용"으로 선언했으나 Phase 4 plan에 해당 핸들러 구현 태스크 누락 | `spec/4-nodes/3-ai/0-common.md` §10 | `grep -r "appendAi\|conversationThread" backend/src/nodes/ai/text-classifier/ backend/src/nodes/ai/information-extractor/` 확인 후 미구현이면 spec을 "v2 추가 예정(v1 미적용)"으로 수정 |
| 7 | Requirement | `execution-engine.md §5.5` ExpressionContext 구성 표에 `$thread` 행 미추가 (consistency-check 2회 지적에도 미해소) | `spec/5-system/4-execution-engine.md` §5.5 | `\| $thread \| context.conversationThread \| ConversationThread readonly view \|` 행 추가 |
| 8 | Requirement | presentation 노드 spec(`form`, `carousel`, `table`, `chart`, `template`)에 `excludeFromConversationThread` config 필드 미반영 | `spec/4-nodes/6-presentation/` 하위 | 각 노드 spec config 목록에 `excludeFromConversationThread: Boolean (default false)` 추가 |
| 9 | Dependency / Maintainability / Testing / Documentation | 신규 `createEmptyConversationThread` import에 `.js` 확장자 누락 — 기존 import 패턴과 불일치, ESM 전환 시 런타임 오류 | 파일 1–8 전체 신규 import 라인 | `conversation-thread.types.js` 로 확장자 통일 |
| 10 | Maintainability | 8개 테스트 파일에 동일 `conversationThread` 보일러플레이트 개별 삽입 — 인터페이스 필드 추가마다 파일 전체 수정 반복 | 파일 1–8 | `createBaseExecutionContext(overrides?)` 공유 헬퍼를 `test/helpers/execution-context.ts`에 추출 |
| 11 | Maintainability / Testing | `manual-trigger.handler.spec.ts` 내 `makeContext()` 함수와 독립 `ctx` 객체 — 이중 정의로 이번에도 양쪽 모두 수정 필요했음 | `manual-trigger.handler.spec.ts` | `ctx`를 `makeContext()` 호출로 통일 |
| 12 | Architecture | 프레젠테이션 계층 테스트가 `execution-engine` 모듈 내부 구현체(`conversation-thread.types`)를 직접 import — 계층 간 결합 | 파일 1–8 | `createTestContext()` 헬퍼를 `node-handler.interface` 근처에 두고 모든 핸들러 테스트가 이를 통해 context 획득 |
| 13 | Performance | WS `execution.waiting_for_input` payload에 `turns` 전체 동봉 — 대화 길이에 비례해 O(N) 페이로드 증가 | `spec/5-system/6-websocket-protocol.md` §4.4.5 | `lastN: 10` turns 제한 또는 클라이언트 lazy-fetch(REST/SSE pull) 패턴 검토 |
| 14 | Performance | `ConversationThreadService.append*` 호출마다 `ExecutionContext` 전체 Redis 재직렬화 — 대화 길이 O(N) 비용 누적 | `spec/5-system/4-execution-engine.md` §6.2 | `conversationThread`를 별도 Redis 키(`thread:{executionId}`)로 분리해 context 전체 재직렬화 방지 |
| 15 | Documentation | `execution-engine.md §6.1` 신규 `$thread` 행이 기존 2열 표에 3열 형식으로 추가 — 마크다운 렌더링 오작동 | `spec/5-system/4-execution-engine.md` §6.1 | `context.conversationThread`를 설명 열에 통합하거나 표 헤더를 3열로 통일 |
| 16 | Scope | `0-common.md` §10 → §11 renumber 후 다른 spec에서 `#10` 앵커로 링크하던 경우 조용히 깨짐 | `spec/4-nodes/3-ai/0-common.md` | `grep -r "0-common.md#10" spec/` 실행하여 깨진 링크 확인 |
| 17 | Concurrency | `ConversationThreadService.append*`의 `nextSeq` 원자성 미명시 — 병렬 브랜치에서 동시 호출 시 경쟁 조건 가능 | `spec/5-system/4-execution-engine.md` §6.1 | "Redis INCR 원자적 증가 또는 단일 스레드 보장 하에 호출" 계약 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `sanitizeLlmProvidedString` 공식 규약 미등재 — spec 참조만 존재, 함수 동작 명세 없음 | `spec/conventions/` | `security-sanitization.md` 신설 또는 conversation-thread spec 인라인 명세 |
| 2 | Security | `DEFAULT_THREAD_ID = 'default'` — WS payload 예시 노출, `node-output.md` 포트 예약어와 동일 값 | `spec/conventions/conversation-thread.md` §1.3 | 구현 시 상수 추출 mandatory; v2 전환 시 `"primary"` 변경 검토 |
| 3 | Architecture | `ConversationThread` 분산 SoT 재구성 — 여러 `NodeExecution` JSONB row를 순서대로 조립해야 하는 복잡한 쿼리 | `spec/5-system/4-execution-engine.md` §6.2 | `ConversationThreadService.reconstruct(executionId)` 단일 메서드로 캡슐화 |
| 4 | Performance | `$thread.text` 표현식 평가가 O(N) 순회 + 문자열 조합 — 동일 컨텍스트에서 반복 참조 시 재계산 | `spec/5-system/5-expression-language.md` §4.4 | lazy computed property 또는 turns 변경 시 무효화되는 memoize 패턴 적용 |
| 5 | Database | `conversationThread` 신규 DB 컬럼 미신설 — Redis + 기존 JSONB 재사용은 zero-downtime으로 안전하나, v2 이후 크로스노드 thread 조회 시 N+1 쿼리 위험 | `spec/5-system/4-execution-engine.md` §6.2 | v2 UI spec 설계 시 thread 재구성 쿼리 패턴 사전 분석 후 인덱스 전략 결정 |
| 6 | Dependency | presentation/trigger 테스트 → `execution-engine` 모듈 내부 교차 의존 신설 — 모듈 이동 시 8개 파일 일괄 수정 필요 | 파일 1–8 | 공통 테스트 헬퍼로 의존 경로 단일화 (WARNING #12와 동일 해결책) |
| 7 | Testing | 핸들러 테스트가 `conversationThread`를 passthrough로만 추가 — 핸들러가 직접 mutate하지 않는다는 불변성 검증 없음 | 파일 1–8 | 핸들러 execute 후 `context.conversationThread` 불변성 단언 추가 |
| 8 | Testing | `$thread` 표현식 평가 테스트 없음 — 빈 thread, 누적 thread, 범위 초과 케이스 | `spec/5-system/5-expression-language.md` §4.4 | expression-language 단위 테스트에 `$thread` 케이스 추가 |
| 9 | Testing | WS `execution.waiting_for_input` payload `conversationThread` 필드 E2E 검증 없음 | `spec/5-system/6-websocket-protocol.md` §4.4.5 | form → ai_agent E2E 시나리오에 `conversationThread` snapshot 포함 여부 검증 추가 |
| 10 | Requirement | `ai_user` push 순서 모순(step 2.5에 배치되나 설명은 "LLM 호출 전") 해소 여부 미확인 (`1-ai-agent.md` diff 미제공) | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 | `ai_user` push가 LLM 호출 이전, `ai_assistant` push가 응답 수신 이후로 분리 기술되었는지 확인 |
| 11 | Scope | `form_submit` → `form_submitted` 코드 레벨 확인 미포함 | `spec/1-data-model.md` | `grep -r '"form_submit"' backend/src` 실행; 코드가 이미 `form_submitted` 생성 중이면 spec-only 정정으로 충분 |
| 12 | Documentation | 리뷰 파일 다수가 에이전트 내부 처리 독백 텍스트로 시작 — 공식 산출물 재독성 저하 | `review/consistency/2026-05-14_*/` 일부 파일 | 섹션 헤더로 시작하도록 생성 로직 수정 |
| 13 | Documentation | 20개 이상 리뷰 파일 trailing newline 누락 | `review/consistency/` 하위 전체 신규 파일 | 산출물 생성 로직에 trailing newline 자동 추가 |
| 14 | Documentation | em dash 포함 anchor 링크 안정성 미검증 | `spec/5-system/*.md`, `spec/conventions/node-output.md` 등 | spec 배포 환경에서 anchor 렌더링 결과 검증 또는 헤딩 ASCII-friendly 단순화 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Side Effect | **HIGH** | ExecutionContext 인터페이스 파괴적 변경의 비테스트 코드 영향 미검증 |
| Security | **MEDIUM** | Prompt Injection 경로(system_text + form 입력 무방비 첨부), WS 대화 내역 노출 |
| Testing | **MEDIUM** | ConversationThread 핵심 기능 및 Background 격리 불변량 테스트 완전 부재 |
| Requirement | **MEDIUM** | §5.5 ExpressionContext 표 $thread 누락, presentation 노드 spec 미반영 |
| Architecture | **LOW** | 프레젠테이션 계층 테스트의 execution-engine 직접 의존, shallow copy 완전성 |
| API Contract | **LOW** | form_submit → form_submitted 잠재적 breaking change, WS 버저닝 미명시 |
| Performance | **LOW** | WS 페이로드 선형 증가, Redis 전체 컨텍스트 재직렬화 누적 |
| Maintainability | **LOW** | 공유 테스트 픽스처 추상화 부재, import 확장자 불일치 |
| Database | **LOW** | form_submit → form_submitted DB 마이그레이션 전략 미명시 |
| Dependency | **LOW** | .js 확장자 누락, 신규 크로스모듈 의존 |
| Concurrency | **LOW** | Background shallow copy 중첩 객체 참조 공유, nextSeq 원자성 미명시 |
| Scope | **LOW** | 범위 외 버그픽스 포함(사전 승인), anchor renumber 링크 미검증 |
| Documentation | **LOW** | $thread 행 표 형식 불일치(렌더링 오작동), 리뷰 파일 품질 |

## 발견 없는 에이전트
없음 — 13개 에이전트 전원 발견사항 있음.

---

## 권장 조치사항

1. **[즉시 — 구현 착수 전 차단]** `ExecutionContext` 인터페이스 비테스트 생성 지점 전수 점검 및 `conversationThread` 초기화 보완
2. **[즉시 — 구현 착수 전 차단]** Prompt Injection 방어: `sanitizeLlmProvidedString` 적용을 `spec/conventions/security-sanitization.md`에 필수 구현 규약으로 공식화
3. **[즉시]** `ConversationThreadService` 핵심 단위 테스트 신설 (누적·주입·cap·렌더링·Background 격리 검증)
4. **[즉시]** `interaction_data.interactionType` `"form_submit"` 실제 저장 값 확인 및 DB 마이그레이션 전략 spec 명기
5. **[구현 착수 전]** `execution-engine.md §5.5` ExpressionContext 표에 `$thread` 행 추가
6. **[구현 착수 전]** `presentation` 노드 spec에 `excludeFromConversationThread` 필드 추가
7. **[구현 착수 전]** `text_classifier`/`information_extractor` push hook 구현 여부 확인 후 spec 표기 정정
8. **[구현 착수 전]** WS authorization 범위 및 `conversationThread` 소유권 검증 규약 spec 명기
9. **[구현 시]** import `.js` 확장자 통일, `buttons.spec.ts` 3개 파일 `beforeEach` 재생성 패턴 적용
10. **[구현 시]** `ConversationThread`를 별도 Redis 키로 분리하여 append 시 전체 컨텍스트 재직렬화 방지; `$thread.text` 표현식 memoize 적용
11. **[중기]** 공유 `createBaseExecutionContext()` 테스트 헬퍼 추출로 인터페이스 변경 시 단일 수정 지점 확보
12. **[중기]** `execution-engine.md §6.1` $thread 행 표 형식 수정, `0-common.md` anchor 링크 검증