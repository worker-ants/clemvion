# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 사용자 입력이 이스케이프 없이 LLM 프롬프트에 삽입되는 프롬프트 인젝션 취약점이 즉각 조치를 요구하며, WebSocket 전체 thread 노출·BullMQ 하위 호환성 파손이 배포 차단 위험으로 추가 확인됨

---

## Critical 발견사항
없음

---

## HIGH 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | form 필드명·값, buttonLabel, url이 이스케이프 없이 LLM system prompt / messages 배열에 직접 삽입 → 프롬프트 인젝션 가능 | `thread-renderer.ts:33-41` renderInteractionText, `ai-agent.handler.ts` injectThreadContext | LLM 주입 전 `<<<user_input>>>...<</user_input>>>` 고정 템플릿으로 instruction/data 영역 분리; 최소한 provider별 제어 토큰(`[INST]`, `<\|system\|>` 등) strip 필요 |
| 2 | Testing | background 실행 turns shallow clone 격리 속성을 검증하는 테스트 없음 — background 노드가 push한 turn이 메인 thread에 누수되지 않는다는 보장 미확인 | `execution-engine.service.ts:3746-3796`, `execution-engine.service.spec.ts` | "background does not pollute parent thread" 통합 테스트 추가: 메인 context에 turn 1개 seeding 후 background 실행 → 메인 thread turn 수 불변 assert |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Side Effect / Architecture | WebSocket 대기 페이로드에 전체 ConversationThread raw 참조 전달 — AI tool call args·PII 포함 가능한 민감 데이터 노출 + 크기 무제한 + live mutable reference *(다수 에이전트 공통 지적)* | `execution-engine.service.ts` form/button/AI waiting emit 3곳 | emit 직전 `{ ...ct, turns: [...ct.turns] }` snapshot 적용; `ai_tool` source turn 제거 또는 별도 `GET /executions/:id/thread` REST 엔드포인트로 분리하고 WebSocket에는 `threadLength`·`threadTotalChars`만 포함 |
| 2 | Side Effect | BullMQ 기존 잡에 `conversationThread` 필드 없음 — 배포 후 background processor에서 `undefined.turns` 런타임 오류 발생 가능 | `execution-engine.service.ts` background job restore 경로, `background-execution.queue.ts` | 프로세서에서 `job.conversationThread ?? createEmptyConversationThread()` 방어 처리 또는 배포 전 큐 비우기 |
| 3 | Security | `appendInternal`에 turns 수·totalChars 상한 미검사 — 자동화 반복 submit으로 메모리 무제한 증가 가능 (`MAX_INJECTED_*`는 LLM 주입 상수, 저장소 상한 아님) | `conversation-thread.service.ts:154-169` | `STORAGE_MAX_TURNS`(예: 500) 초과 시 oldest turn evict 또는 append skip |
| 4 | Dependency / Architecture | `nodes/ai/ai-agent`가 `execution-engine/conversation-thread/thread-renderer`를 런타임 import — 역방향 레이어 의존 + 논리적 순환(nodes → execution-engine → nodes) | `ai-agent.handler.ts` import 선언 | `thread-renderer.ts` + `conversation-thread.types.ts`를 `src/shared/conversation-thread/`로 추출해 단방향 의존 정리 |
| 5 | Performance / Side Effect | `buildExpressionContext` 호출마다 `renderThreadAsSystemText()` 즉시 실행 — `$thread.text` 미사용 노드도 전체 thread 렌더링 비용 부담 (최대 ~400KB × 표현식 수) *(코드 주석도 인지 중)* | `expression-resolver.service.ts` buildThreadView | `Object.defineProperty` lazy getter로 전환; 불가 시 `$thread.text`를 별도 key로 분리해 명시적 요청 시만 렌더링 |
| 6 | Side Effect | `$thread.turns`가 live 배열 참조 — 표현식 평가 후 append 시 이미 반환된 컨텍스트 객체가 변형됨 | `expression-resolver.service.ts` buildThreadView `turns: thread.turns` | `turns: [...thread.turns]` snapshot 반환 |
| 7 | Performance | `applyCap()` step 3의 `while` 루프 내 `kept = kept.slice(1)` 반복 — O(n²) 패턴 *(현재 상수 범위에서는 허용 가능하나 antipattern)* | `thread-renderer.ts` applyCap | `findIndex`로 경계 인덱스 선계산 후 단일 `slice`로 O(n) 처리 |
| 8 | Concurrency | 병렬 브랜치가 동일 `conversationThread` 참조 공유 시 `seq` 시간 순서 불변식 파괴 가능 | `execution-engine.service.ts` + `ParallelExecutor` + `conversation-thread.service.ts` appendInternal | 자식 컨텍스트 생성 시 conversationThread shallow clone(background 격리와 동일 패턴) 또는 merge point 재통합 정책을 spec에 명시 |
| 9 | Architecture / API Contract | multi-turn 후속 waiting tick에서만 `conversationThread`가 `undefined` 반환 가능 — form/button 경로와 nullable 불일치 | `execution-engine.service.ts:2120` | `?? createEmptyConversationThread()` fallback 또는 non-null assertion(`!`) + 불변식 주석 명시 |
| 10 | Testing | 버튼 resume(`button_click`, `button_continue`) 경로의 `appendPresentationInteraction` 호출이 통합 수준에서 미검증 | `execution-engine.service.spec.ts`, `execution-engine.service.ts` handleButtonResume | form resume 테스트 패턴 복제하여 button resume spy 검증 테스트 추가 |
| 11 | Testing | `getThread()` 불변성 테스트가 실제 배열 돌파(`turns.push()` 직접 호출) 가능성 검증 안 함 — `Readonly<T>`는 얕은 컴파일타임 힌트에 불과 | `conversation-thread.service.spec.ts:261-278` | `turns`를 `readonly ConversationTurn[]`으로 선언하거나, 방어적 복사 반환 구현 후 assert |
| 12 | Dependency | 3곳의 인라인 `import()` 타입 표현식 — IDE rename·dead-code 분석 누락 위험; 동일 파일 다른 타입들은 모두 top-level import 사용 | `background-execution.queue.ts`, `node-component.interface.ts`, `node-handler.interface.ts` | `import type { ConversationThread } from '...'` top-level 선언으로 통일 |
| 13 | Maintainability | `contextScopeN` 기본값 `20`이 스키마(`z.number().default(20)`)와 핸들러(`?? 20`) 두 곳에 중복 정의 | `ai-agent.schema.ts`, `ai-agent.handler.ts` injectThreadContext | `DEFAULT_CONTEXT_SCOPE_N = 20` 상수 추출 또는 핸들러의 `?? 20` fallback 제거 |
| 14 | Maintainability | `injectThreadContext` 단일 메서드에 scope 결정·슬라이싱·cap·messages 변환·system_text 변환 모두 집중 (~130줄) | `ai-agent.handler.ts:350-480` | `mapTurnsToChatMessages(turns)` 순수함수로 분리; 테스트 가능성과 가독성 동시 개선 |
| 15 | Maintainability | `makeContext` 팩토리가 spec 파일마다 중복 정의 — 이번 변경에서 이미 30+ 파일 수정 반복 발생, 향후 필드 추가 시 재발 | `ai-agent.thread.spec.ts`, `conversation-thread.service.spec.ts` 등 다수 | 신규 spec 파일부터 공용 `makeExecutionContext` 헬퍼 사용으로 점진적 통일 |
| 16 | Requirement | `ConversationThread.totalChars` JSDoc이 "applyCap 빠른 경로용"이라고 명시하지만 `applyCap`은 `ConversationTurn[]`만 받아 `sumChars`로 매번 재계산 — 주석·구현 불일치 | `conversation-thread.types.ts` totalChars JSDoc, `thread-renderer.ts` applyCap | 주석을 "누적 char 캐시 — WebSocket payload 외부 소비용"으로 수정하거나 `applyCap`에 totalChars 힌트 파라미터 추가 |
| 17 | Scope | `integration.entity.ts`의 `@Column` 포맷팅 전용 변경 — ConversationThread 기능과 무관 | `backend/src/modules/integrations/entities/integration.entity.ts` | 별도 포맷팅 커밋으로 분리하거나 PR에서 제거 |
| 18 | Documentation | Phase 번호 주석(`Phase 3 hook`, `Phase 4a`)이 plan complete 후 dead reference화 | `ai-agent.thread.spec.ts` 상단, `execution-engine.service.spec.ts:1553` | spec 섹션 참조(`spec/conventions/conversation-thread.md §2.2`) 형식으로 교체 |
| 19 | Documentation | `conversationHistory`·`maxHistoryCount`의 `deprecated: true` 마킹에 날짜·버전 태그 없음 | `ai-agent.schema.ts` conversationHistory, maxHistoryCount | `// Deprecated: 2026-05-14 (conversation-thread v1)` 형식으로 날짜 기록 |
| 20 | Testing | `contextScopeN = 0` 또는 음수 시 `Math.max(1, 0) = 1`로 최소 1턴 주입되는 동작 미검증 | `ai-agent.handler.ts` injectThreadContext, `ai-agent.thread.spec.ts` | `contextScope='lastN', contextScopeN: 0` 경계값 테스트로 min=1 동작 문서화 |
| 21 | Testing | `button_continue` interaction type이 service spec에 없음 (renderer spec에만 존재) | `conversation-thread.service.spec.ts` appendPresentationInteraction describe | url 있음/없음 두 케이스로 service 레벨 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Security | `ConversationTurn` 불변성이 타입이 아닌 관례에만 의존 — `Object.freeze` 등 런타임 강제 없음, background 격리 계약의 기반 | `conversation-thread.types.ts`, `execution-engine.service.ts:3746` | `appendInternal` 마지막에 `Object.freeze(turn)` 추가 또는 `ReadonlyArray<Readonly<ConversationTurn>>` 선언 |
| 2 | Architecture | `AiAgentHandler`의 `conversationThreadService?` optional — 엔진 wiring 누락 시 컴파일러가 감지하지 못하고 silent no-op | `ai-agent.handler.ts:293`, `ai-agent.component.ts:43` | component 팩토리 레벨에서 미주입 시 throw 추가 또는 향후 v2에서 required로 승격 |
| 3 | Requirement | `buildThreadView`의 `if (!thread) return undefined` 가드가 conversationThread required 필드 도입으로 dead code화 | `expression-resolver.service.ts` buildThreadView | 가드 제거 또는 conversationThread를 optional 유지로 일관성 확보 |
| 4 | Requirement / Testing | `DEFAULT_THREAD_ID = 'default'`를 `execution-context.service.spec.ts`에서 magic string으로 직접 사용 — 타입 파일 주석의 컨벤션 위반 | `execution-context.service.spec.ts:13-20` | `import { DEFAULT_THREAD_ID }` 후 상수 참조로 교체 |
| 5 | Security | `DEFAULT_THREAD_ID = 'default'`가 노드 출력 포트 예약어와 동일 — 미래 직렬화 경로에서 namespace 혼용 위험 | `conversation-thread.types.ts:16` | `'thread:default'` 등 prefix 포함 값으로 변경해 타입 수준 namespace 분리 |
| 6 | Testing | `$thread.turns[0].text` 등 실제 표현식 평가 E2E 테스트 없음 — `buildExpressionContext` 뷰 생성만 검증됨 | `expression-resolver.service.spec.ts:390-464` | `resolveExpression("{{$thread.length}}")` 등 1-2개 표현식 평가 테스트 추가 |
| 7 | Testing | `includeToolTurns=true` 테스트에서 tool result turn의 `text` 내용 미검증 — empty provider error path 의도 불명확 | `ai-agent.thread.spec.ts:388-436` | `turns[2].text` 내용 assert 추가 또는 empty provider error path임을 주석 명시 |
| 8 | Performance | `lastN()` — `turns.length <= n` 분기에서 불필요한 전체 배열 복사 | `conversation-thread.service.ts` lastN | hot path라면 `as readonly ConversationTurn[]` 캐스트로 복사 제거 고려 |
| 9 | Documentation | v2 로드맵 언급이 3곳에 있으나 plan/spec 추적 참조 없음 — 버전 기준 판단 불가 | `conversation-thread.types.ts:17`, `ai-agent.handler.ts` buildAiNodeRefFromContext JSDoc, `ai-agent.schema.ts` | `spec/conventions/conversation-thread.md §Roadmap` 섹션 연결 또는 plan 문서에 기록 |
| 10 | Documentation | `ConversationTurnToolCall` 인터페이스 JSDoc 없음 — 동일 파일 다른 타입들은 필드별 상세 문서 보유 | `conversation-thread.types.ts:28-32` | 한 줄 JSDoc 추가 |
| 11 | Documentation | `ApplyCapResult` 공개 인터페이스 JSDoc 없음 — `applyCap`은 상세 JSDoc 보유 | `thread-renderer.ts:85-89` | 한 줄 JSDoc 추가 |
| 12 | Requirement | `button_click` 데이터에서 `buttonLabel`·`buttonId` 모두 없을 때 `'clicked: '`(빈 suffix) 반환 — 테스트 미커버 | `thread-renderer.ts` case 'button_click' | 빈 fallback 테스트 추가 또는 `'clicked: (unknown button)'` 명시적 fallback으로 변경 |
| 13 | Dependency | `conversationHistory` deprecated 제거 일정이 코드 주석에만 존재 — 추적 누락 위험 | `ai-agent.schema.ts` | plan/ 문서 또는 해당 spec Rationale 섹션에도 제거 일정 기록 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **HIGH** | 프롬프트 인젝션(사용자 입력 무필터 LLM 주입), WebSocket 민감 데이터 노출, 메모리 DoS 잠재 위험 |
| Performance | **MEDIUM** | `$thread.text` 모든 표현식 평가 시 eager 렌더링, `applyCap` O(n²) 루프 |
| Testing | **MEDIUM** | 백그라운드 격리 보장 미검증, 버튼 resume 통합 테스트 누락, 불변성 보호 검증 미흡 |
| Architecture | **MEDIUM** | `nodes/core` ↔ `execution-engine` 논리적 순환 의존, WebSocket mutable reference 전달, nullable 경로 불일치 |
| Side Effect | **MEDIUM** | BullMQ 기존 잡 역직렬화 실패(배포 차단 위험), live reference WebSocket 전달, expression context turns 참조 오염 |
| Concurrency | **LOW** | 병렬 브랜치 seq 순서 비결정성, context 정리 후 TOCTOU 간격 |
| Dependency | **LOW** | 역방향 레이어 의존(nodes → execution-engine), 인라인 import() 타입 3곳 |
| Maintainability | **LOW** | contextScopeN 이중 기본값, injectThreadContext 과중, 테스트 헬퍼 분산 |
| API Contract | **LOW** | multi-turn 경로 nullable 불일치, WebSocket 페이로드 크기 SLA 미정의 |
| Requirement | **LOW** | totalChars 주석·구현 불일치, WebSocket cap 미적용, button resume 통합 테스트 누락 |
| Documentation | **LOW** | Phase 번호 dead reference, v2 로드맵 추적 누락, deprecated 날짜 태그 없음 |
| Scope | **LOW** | integration.entity.ts 무관 포맷팅 변경 1건 |
| Database | **NONE** | 데이터베이스 관련 변경 없음 |

---

## 발견 없는 에이전트
- **Database** — ConversationThread는 인메모리 전용 구조이며 ORM/스키마 변경 없음

---

## 권장 조치사항

1. **[즉시 — 배포 전 차단]** 프롬프트 인젝션 방어 추가 — `renderInteractionText`에서 form 필드명·값, buttonLabel, url을 LLM에 주입 전 고정 템플릿(`<<<user_input>>>`)으로 래핑하거나 제어 토큰 strip

2. **[즉시 — 배포 전 차단]** BullMQ 하위 호환성 수정 — background job restore 경로에 `job.conversationThread ?? createEmptyConversationThread()` fallback 추가

3. **[높음]** WebSocket emit 시 전체 thread 대신 shallow snapshot 전달 + ai_tool source turn 제거 또는 별도 REST 엔드포인트 분리 — 보안·성능 동시 해결

4. **[높음]** `thread-renderer.ts` + `conversation-thread.types.ts`를 `src/shared/conversation-thread/`로 추출 — 역방향 레이어 의존 및 논리적 순환 의존성 해소

5. **[높음]** `appendInternal`에 STORAGE_MAX_TURNS 상한 추가 — LLM cap과 별개의 저장소 보호

6. **[중간]** background 격리 통합 테스트 추가 ("background does not pollute parent thread")

7. **[중간]** 버튼 resume(`button_click`, `button_continue`) 통합 테스트 추가 — form resume 패턴 복제

8. **[중간]** `buildThreadView`의 `$thread.text` lazy getter 전환 — 모든 expression 평가 시 eager 렌더링 제거

9. **[중간]** 인라인 `import()` 타입 3곳을 top-level `import type`으로 통일

10. **[낮음]** `ConversationTurn` 불변성을 타입 시스템으로 강제 (`ReadonlyArray<Readonly<ConversationTurn>>`) 및 `Object.freeze(turn)` 런타임 보호 추가