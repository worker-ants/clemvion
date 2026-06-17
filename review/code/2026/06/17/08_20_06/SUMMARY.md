# Code Review 통합 보고서

리뷰 대상: `AiTurnOrchestrator + EngineDriver` 추출 (strangler-fig C-1 step2)
커밋: `2d363e4b07f7d80710f12dfa8c35b3817b991b07`

---

## 전체 위험도

**MEDIUM** — 핵심 AI 멀티턴 생명주기 메서드(`handleAiMessageTurn`, `emitAiWaitingForInput`)의 직접 단위 테스트가 부재하며, ES module 레벨 순환 import 와 다중 책임 메서드(~250줄)가 남아 있다. 기능 보존 자체는 확인됐으나 복잡한 분기의 회귀 방지 커버리지를 보강해야 한다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스팅 | `handleAiMessageTurn` 직접 단위 테스트 부재 — contextService null graceful exit, nodeExec null warn+skip, save throw recover, source:'form_submitted' JSON.stringify 등 4개 분기 미커버 | `ai-turn-orchestrator.service.ts` L1597–1882 | `handleAiMessageTurn` 직접 단위 테스트 4케이스 추가 (contextService absent → FAILED, nodeExec null, save throw, form_submitted 직렬화) |
| 2 | 테스팅 | `emitAiWaitingForInput` 단위 테스트 전무 — ai_form_render 분기, checkpoint 조건부 영속, nodeExec=null graceful pass-through 미검증 | `ai-turn-orchestrator.service.ts` L1425–1557 | 최소 3케이스 직접 단위 테스트 추가 (ai_form_render+pendingFormToolCall 동봉, checkpoint 미대상 노드 타입, nodeExec null) |
| 3 | 아키텍처 | ES module 레벨 순환 import — `execution-engine.service.ts` ↔ `ai-turn-orchestrator.service.ts` 쌍방 참조. NestJS DI `forwardRef`로는 해소됐으나 공유 helper 함수를 cross-import하는 ES module 순환은 런타임 undefined evaluation window 위험 | `execution-engine.service.ts` L130, `ai-turn-orchestrator.service.ts` L48 | 공유 helper(`buildConversationConfigFromOutput`, `RehydrationError` 등 8개)를 별도 파일(예: `ai-conversation-helpers.ts`)로 분리해 순환 제거 |
| 4 | 아키텍처 | `ExecutionEngineService` 여전히 8,411줄 god-class — 이번 PR이 진행 중인 단계임을 감안해도 `GraphTraversal`, `RetryReentry`, `NodeDispatch` 책임이 여전히 단일 클래스에 집중 | `execution-engine.service.ts` 전체 | 향후 step에서 `GraphTraversal`, `RetryReentry`, `NodeDispatch` 추가 추출을 plan에 명시 |
| 5 | 아키텍처 | `EngineDriver` 인터페이스에 orchestrator가 실제 사용하지 않는 메서드 2개 포함(ISP 위반 경계) — `resolveHasDefaultLlmConfigCached`, `clearLlmDefaultConfigCache` | `engine-driver.interface.ts` L86-92 | 두 캐시 메서드를 별도 `LlmCacheDriver` 인터페이스로 분리하거나 엔진 내부에서만 관리 |
| 6 | 유지보수성 | `handleAiMessageTurn` ~250줄 다중 책임 메서드 — 핸들러 검증, live signal emit, LLM 호출, 오류 처리, cache 갱신, DB persist, AI_MESSAGE emit, WAITING_FOR_INPUT emit 8개 관심사 직렬 처리 | `ai-turn-orchestrator.service.ts` L1597–1882 | `persistTurnSnapshot`, `emitTurnResponse` 등 private helper로 분해 |
| 7 | 유지보수성 | `emitAiWaitingForInput` 내 IIFE 패턴 — 객체 리터럴 내 `(() => { ... })()` 가독성 저해 | `ai-turn-orchestrator.service.ts` L1856–1860 | 인라인 직전 지역 변수로 추출: `const conversationThreadSnapshot = cloneThread(...)` |
| 8 | 테스팅 | engine spec W10/W11 블록에서 logger spy 대상 변경(`service.logger` → `aiTurnOrchestrator.logger`) 후 `warnSpy.mockRestore()` 누락 가능성 — 후속 테스트 logger mock 오염 위험 | `execution-engine.service.spec.ts` W10/W11 블록 | `afterEach`에 `jest.restoreAllMocks()` 추가로 방어적 해결 |
| 9 | 동시성 | `handleAiMessageTurn` LLM await 구간 비동기 경쟁 — LLM 호출 중 외부 cancel/FAILED 경로가 ExecutionContext 삭제 시 WAITING_FOR_INPUT 상태 DB 잔류 window 이론적 존재. 현재 `ended:true, finalStatus:'FAILED'` 방어 코드는 적절 | `ai-turn-orchestrator.service.ts` L1682–1694 | 근본 window 축소를 위해 ExecutionContext 삭제 경로와 LLM await 구간의 겹침을 장기적으로 재검토 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/3-ai/1-ai-agent.md §10` 각주가 `ExecutionEngineService.classifyLlmError`를 참조하나 실제로는 `AiTurnOrchestrator`(private static)로 이동 — spec 서술 낡음. 코드 이동은 합리적 리팩터링 | `spec/4-nodes/3-ai/1-ai-agent.md` line 1098 | spec 갱신: "구현: `AiTurnOrchestrator.classifyLlmError`(static)" (project-planner 권한) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md §1.1` 이 `waitForAiConversation`, `processAiResumeTurn` 등을 `ExecutionEngineService` 소유로 암묵적 서술 — 실제로는 `AiTurnOrchestrator` 이동 | `spec/5-system/4-execution-engine.md` line 83, §7.5 | spec 갱신: 해당 메서드들이 `AiTurnOrchestrator`에 위치함 명시 (project-planner 권한) |
| 3 | 아키텍처 | `WaitingInteractionType` 미이동 — orchestrator가 엔진 서비스 파일을 타입 import 목적으로 의존, 경계 불명확. 의도된 결정이나 helper 분리 시 함께 이동 권장 | `execution-engine.service.ts` L173, `ai-turn-orchestrator.service.ts` L47 | 공유 helper 분리(WARNING #3) 시 함께 이동 |
| 4 | 아키텍처 | `EngineDriver.applyPortSelection` 추상화 누출 — 엔진 내부 라우팅 convention을 orchestrator가 알아야 하는 구조 | `engine-driver.interface.ts` L78 | 장기적으로 별도 어댑터로 격리 |
| 5 | 아키텍처 | 테스트 파일에서 private 메서드를 `as unknown as` 캐스팅으로 직접 테스트 — 리팩터링 시 컴파일 오류 없이 조용히 실패 위험 | `ai-turn-orchestrator.service.spec.ts` 전반 | `extractAiTurnErrorPayload`는 별도 유틸 파일로 분리해 캐스팅 없이 직접 import 테스트 |
| 6 | 아키텍처 | `handleAiMessageTurn`이 `contextKey`(string)를 받아 내부에서 context 재조회 — `processAiResumeTurn`은 `context` 직접 수신, 파라미터 설계 불일치 | `ai-turn-orchestrator.service.ts` L513, L771–774 | `handleAiMessageTurn`도 `ExecutionContext` 직접 수신 통일 또는 설계 이유 인터페이스 주석 명시 |
| 7 | 부작용 | `ENGINE_DRIVER` 토큰이 `exports`에 미포함 — 외부 모듈이 `AiTurnOrchestrator` 직접 주입 시 DI 에러 | `execution-engine.module.ts` exports 배열 | 외부 소비 비의도임을 명시적 문서화하거나 필요 시 exports 추가 결정 |
| 8 | 부작용 | `waitForAiConversation`의 `resumeState` 객체 in-place mutation — verbatim 이동이므로 신규 부작용 아님, 그러나 별도 클래스 격리로 존재가 불투명해짐 | `ai-turn-orchestrator.service.ts` L147–149 | 향후 `rawConfig` seed를 명시적 파라미터나 불변 방식으로 전환 검토 |
| 9 | 부작용 | `forwardRef` 순환 DI 적용 여부 불명확 — 커밋 메시지 언급 vs 실제 코드 확인 필요. e2e 통과로 실제 문제 가능성 낮음 | `execution-engine.module.ts` L82–88 | `ExecutionEngineService` 생성자에서 `@Inject(forwardRef(() => AiTurnOrchestrator))` 사용 여부 확인 및 문서화 |
| 10 | 부작용 | 테스트 내 직접 프로퍼티 대입 모킹에서 복원 보장 불명확 | `execution-engine.service.spec.ts` | `jest.spyOn`으로 전환하거나 `afterEach`에 복원 등록 |
| 11 | 유지보수성 | `AiTurnOrchestrator` 자체 1,332줄 — 추출 후에도 "작은 god-class" 경향 | `ai-turn-orchestrator.service.ts` 전체 | 후속 C-1 step에서 `emitAiWaitingForInput`, `handleAiMessageTurn` 추가 분해 |
| 12 | 유지보수성 | `as unknown as` 타입 별칭(ReparkSubject, ExtractFn) describe 블록별 중복 선언 | `ai-turn-orchestrator.service.spec.ts` L151–157, L389–393 | 파일 상단 통합 선언 또는 해당 메서드 public 노출로 제거 |
| 13 | 유지보수성 | `void _stripped;` 패턴 주석 없어 의도 불명확 (2곳) | `ai-turn-orchestrator.service.ts` L1748, L979 | `// intentional no-op: suppress unused-var lint` 주석 추가 |
| 14 | 유지보수성 | `finalizeAiNode` 내 에러 메시지 추출 로직 두 곳 중복 | `ai-turn-orchestrator.service.ts` L1210–1218, L1241–1250 | `extractErrorMessage(nodeExec)` private helper로 추출 |
| 15 | 유지보수성 | `ENGINE_DRIVER` DI 토큰 문자열 리터럴 — 충돌 가능성 (기존 패턴 확인 필요) | `engine-driver.interface.ts` L2031 | `Symbol('ENGINE_DRIVER')` 전환 검토 |
| 16 | 유지보수성 | `forwardRef` 주석 vs 실제 코드 불일치 — 첫 접근 개발자 혼란 | `execution-engine.module.ts` | 코드·주석 정합성 맞춤 |
| 17 | 테스팅 | `malformed payload` 테스트가 `{ noType: true }` 만 커버 — 비객체 케이스 미포함 | `ai-turn-orchestrator.service.spec.ts` L373–381 | 비객체 타입 케이스 추가 |
| 18 | 테스팅 | `handleAiResumeTurn` 정상 경로 테스트에서 `setOutputSpy.mockRestore()` 누락 가능성 | `execution-engine.service.spec.ts` | `mockRestore()` 명시 또는 `afterEach`에서 `jest.restoreAllMocks()` |
| 19 | 테스팅 | `buildConversationConfigFromOutput`의 `presentations` 필드 전파 단위 테스트 없음 | `ai-turn-orchestrator.service.spec.ts` | 향후 AI Agent 표현 도구 출력 path 검증 시 보강 |
| 20 | 범위 | `execution-engine.service.ts` diff가 prompt size limit으로 잘려 전체 범위 직접 확인 불가 | `execution-engine.service.ts` | (정보성 기록) |
| 21 | 문서화 | `waitForAiConversation` public 메서드 JSDoc 누락 — park 의미, PARK_RELEASED 반환, rawConfig 주입 부작용 미기술 | `ai-turn-orchestrator.service.ts` | JSDoc 추가 |
| 22 | 문서화 | `resolveHasDefaultLlmConfigCached` 파라미터/반환 시맨틱 미문서화 | `engine-driver.interface.ts` | 파라미터 설명 + `true` = 기본 LLM config 존재 의미 JSDoc 추가 |
| 23 | 문서화 | `execution-engine.module.ts` `useExisting` 순환 DI 회피 원리 미설명 | `execution-engine.module.ts` | 주석 한 줄: `useExisting`은 동일 인스턴스 재사용으로 circular 회피 불필요 |
| 24 | 문서화 | `execution-engine.service.spec.ts` 상단에 AI 멀티턴 lifecycle 테스트 이관 안내 주석 없음 | `execution-engine.service.spec.ts` 상단 | 이관 대상 안내 주석 1줄 추가 |
| 25 | 동시성 | `Object.freeze` 얕은 복사 — 중첩 객체 미freeze, 동일 `node.config` 참조 공유 시 cross-execution 오염 가능성 (Node.js 단일 스레드라 즉각 위험 낮음) | `ai-turn-orchestrator.service.ts` L1234–1235 | deep freeze 또는 `structuredClone` 사용 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | 재시도 필요 | output_file 미존재 (security.md 없음) |
| architecture | MEDIUM | ES module 순환 import(WARNING), god-class 8,411줄 잔존(WARNING), ISP 경미 위반(WARNING) |
| requirement | LOW | SPEC-DRIFT 2건(classifyLlmError·waitForAiConversation 소유자 서술 낡음), 코드 결함 없음 |
| scope | LOW | 추출 범위 정확, execution-engine.service.ts diff 잘림으로 완전 확인 불가 |
| side_effect | LOW | forwardRef 적용 여부 확인 권장, resumeState in-place mutation은 verbatim 이동 |
| maintainability | LOW | handleAiMessageTurn ~250줄 다중 책임(WARNING), IIFE 패턴(WARNING), 추출 후 1,332줄 |
| testing | MEDIUM | handleAiMessageTurn·emitAiWaitingForInput 직접 단위 테스트 전무(WARNING x2), warnSpy.mockRestore 누락 가능(WARNING) |
| documentation | LOW | JSDoc 누락 3건(모두 INFO), 전반적 문서화 품질 양호 |
| concurrency | LOW | LLM await 비동기 경쟁 방어 코드 적절, shallow freeze 이론적 위험(INFO) |

---

## 발견 없는 에이전트

없음 (모든 실행 에이전트에서 발견사항 존재).

---

## 권장 조치사항

1. **[테스팅·즉시]** `handleAiMessageTurn` 직접 단위 테스트 추가 — contextService null → FAILED, nodeExec null warn+skip, save throw recover, form_submitted 직렬화 4케이스 (WARNING #1)
2. **[테스팅·즉시]** `emitAiWaitingForInput` 직접 단위 테스트 추가 — ai_form_render 분기, checkpoint 조건부, nodeExec null 3케이스 (WARNING #2)
3. **[아키텍처·단기]** 공유 helper 8개를 별도 파일(`ai-conversation-helpers.ts`)로 분리해 ES module 순환 import 제거 + `WaitingInteractionType` 이동 (WARNING #3)
4. **[spec·단기]** SPEC-DRIFT 2건 — project-planner에게 `spec/4-nodes/3-ai/1-ai-agent.md §10` 및 `spec/5-system/4-execution-engine.md §1.1` 갱신 위임 (INFO SPEC-DRIFT #1, #2)
5. **[테스팅·단기]** W10/W11 warnSpy `mockRestore` 확인 + `jest.restoreAllMocks()` afterEach 방어 적용 (WARNING #8)
6. **[유지보수성·단기]** `handleAiMessageTurn`에서 `persistTurnSnapshot`, `emitTurnResponse` private helper 분해 (WARNING #6)
7. **[유지보수성·단기]** `emitAiWaitingForInput` 내 IIFE → 지역 변수로 추출 (WARNING #7)
8. **[아키텍처·중기]** `EngineDriver` 인터페이스에서 미사용 캐시 메서드 2개 분리 (`LlmCacheDriver`) (WARNING #5)
9. **[아키텍처·중기]** 향후 C-1 step에서 `GraphTraversal`, `RetryReentry`, `NodeDispatch` 추가 추출을 plan에 명시 (WARNING #4)
10. **[부작용·단기]** `forwardRef` 순환 DI 실제 적용 여부 확인 후 코드·주석 정합성 맞춤 (INFO #9)

---

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency` (9명)
  - **강제 포함 (router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명)
  - **제외** (5명):

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | performance | router 선별 제외 |
  | dependency | router 선별 제외 |
  | database | router 선별 제외 |
  | api_contract | router 선별 제외 |
  | user_guide_sync | router 선별 제외 |

- **재시도 필요**: `security` (1건) — output_file `/review/code/2026/06/17/08_20_06/security.md` 미존재