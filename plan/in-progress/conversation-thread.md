---
worktree: conversation-thread-e509c5
started: 2026-05-14
owner: developer
---

# Conversation Thread 정식 도입

## 배경

현재 AI Agent 노드는 두 가지 컨텍스트 격리에 갇혀 있다:

1. **Presentation 노드의 사용자 인터랙션을 모른다** — Form/Carousel/Button 노드의 `output.interaction.{type, data, receivedAt}` 는 `nodeOutputCache` 에 저장되지만 AI Agent 는 직전 노드 output 만 `$input` 으로 받음. 사용자가 매번 표현식 `{{ $node["Form1"].output.interaction.data }}` 를 system prompt 에 적어야 한다.
2. **AI Agent → ... → AI Agent 시 대화가 끊긴다** — `execution-engine.service.ts:stripControlFields()` 가 `_resumeState` 를 제거하므로 두 번째 AI Agent 는 첫 번째의 final response 텍스트만 받고 multi-turn 대화 흐름·user 발화·중간 reasoning 을 모두 잃는다.

**해결**: 워크플로우 실행 동안 발생하는 모든 presentation 인터랙션과 AI 대화 turn 을 단일 시간순 thread 로 누적하고, AI Agent 노드 설정으로 자동 주입한다.

**사용자 결정사항** — Presentation + AI 대화 통합 thread, 노드 설정 자동 주입, messages/system_text 형식 선택, 한 번에 정식 모델 도입.

## 작업 목록

### Phase 1 — Spec 확정 (project-planner) ✅

- [x] `spec/conventions/conversation-thread.md` 신규 작성 (자료구조·누적 컨트랙트·스코프·영속화·opt-out)
- [x] `spec/4-nodes/3-ai/0-common.md` §10 신설 (Conversation Context 공통 규약). 기존 §10 CHANGELOG → §11
- [x] `spec/4-nodes/3-ai/1-ai-agent.md` §1 표 신규 5필드 + `conversationHistory`/`historyCount` DEPRECATED + §6 주입 단계 + §12 Rationale
- [x] `spec/5-system/4-execution-engine.md` §1.3 cross-link / §3.3 Background snapshot / §5.5 ExpressionContext / §6.1 표 + JSON 예시 / §6.2 표
- [x] `spec/conventions/node-output.md` §4.5 thread 자동 추가 cross-link 1줄
- [x] `spec/5-system/5-expression-language.md` §4.1 변수 표 + §4.4 `$thread` 신설
- [x] `spec/5-system/6-websocket-protocol.md` §4.1 WAITING_FOR_INPUT payload + §4.4.5 신설
- [x] `spec/1-data-model.md` §2.14 `interaction_data` enum 정정 (`form_submit` → `form_submitted`) + cross-link
- [x] `consistency-check --spec` 통과 (Critical 0 — 1차 Critical 2건 정정 후 2차 통과, WARNING 9건 중 W1~W5 draft 정정 + spec 반영, W6/W7 동시 plan 메모 추가)
- [x] 동시 plan 순서 의존성 메모 추가: `ai-agent-tool-connection-rewrite.md` / `background-monitoring-api.md`

### Phase 2 — 데이터 모델 + 서비스 (developer)

- [ ] `backend/src/modules/execution-engine/conversation-thread/conversation-thread.types.ts` 신규
- [ ] `backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` 신규
- [ ] `backend/src/modules/execution-engine/conversation-thread/thread-renderer.ts` 신규
- [ ] `backend/src/modules/execution-engine/execution-engine.module.ts` provider 등록
- [ ] `backend/src/nodes/core/node-handler.interface.ts` `ExecutionContext.conversationThread` 추가
- [ ] `backend/src/modules/execution-engine/context/execution-context.service.ts` `createContext` 빈 thread 초기화
- [ ] 단위 테스트: append 4종 / opt-out / cap / serialization

### Phase 3 — Engine hook (Presentation)

- [ ] `execution-engine.service.ts:1670` form resume hook 1줄 추가 (`appendPresentationInteraction`)
- [ ] `execution-engine.service.ts:2540` button resume hook 1줄 추가
- [ ] 기존 form/button e2e 회귀 통과 + 신규 thread append 검증

### Phase 4 — AI Agent hook + 주입 로직

- [ ] `ai-agent.handler.ts:processMultiTurnMessageInner` 5군데 hook (`:965`/`:1032`/`:1073`/`:1099`/`:1111`/`:1154`)
- [ ] `ai-agent.handler.ts:executeSingleTurn` user/assistant turn push
- [ ] `ai-agent.schema.ts` 신규 5필드 추가 + `conversationHistory`/`historyCount` deprecated 표기
- [ ] `injectThreadContext` private 메서드 신설 — messages/system_text 모드 양쪽
- [ ] cap 적용 (MAX_INJECTED_TURNS=100, MAX_TURN_TEXT_CHARS=4000, MAX_INJECTED_CHARS=200K)
- [ ] `meta.contextInjection` 디버그 echo
- [ ] 단위 테스트: scope/mode 4 조합 + 호환성 (`'none'` default)

### Phase 5 — Background 격리

- [ ] `execution-engine.service.ts:scheduleBackgroundBody` 에 `conversationThread` shallow snapshot 복사
- [ ] `BackgroundExecutionJob` 타입 확장
- [ ] 격리 검증 테스트

### Phase 6 — Expression 통합

- [ ] `expression-resolver.service.ts:buildExpressionContext` 에 `$thread.{turns,length,text}` 추가
- [ ] 단위 테스트

### Phase 7 — WS payload

- [ ] `EXECUTION_WAITING_FOR_INPUT` payload 에 thread snapshot 동봉

### Phase 8 — e2e 시나리오

- [ ] `backend/test/e2e/conversation-thread.e2e-spec.ts` 신규
  - Form → AI Agent (single, scope='thread') → 응답에 form 데이터 사용
  - Form → AI Agent multi-turn → AI Agent #2 (scope='lastN') → #2 가 #1 대화 참조
  - Background body AI Agent → 메인 thread 무영향
  - Sub-workflow 안 AI Agent → parent thread 상속
  - Opt-out form interaction → thread 미포함
- [ ] `consistency-check --impl-prep` 통과
- [ ] `/ai-review` 실행

## 핵심 설계 (요약)

### 데이터 모델

```ts
type ConversationTurnSource =
  | 'presentation_user'  // form_submitted, button_click, button_continue
  | 'ai_user'
  | 'ai_assistant'
  | 'ai_tool'            // opt-in only
  | 'system';

interface ConversationTurn {
  seq: number;           // append 순서
  nodeId: string;
  nodeLabel: string;     // snapshot
  nodeType: string;
  timestamp: string;     // ISO 8601
  source: ConversationTurnSource;
  text: string;          // system_text injection + UI 표시
  data?: Record<string, unknown>;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
}

interface ConversationThread {
  id: string;            // v1 = "default"
  nextSeq: number;
  turns: ConversationTurn[];
  totalChars: number;
}
```

### AI Agent 신규 schema 필드

```ts
contextScope: z.enum(['none', 'thread', 'lastN']).default('none')
contextScopeN: z.number().int().positive().default(20)
contextInjectionMode: z.enum(['messages', 'system_text']).default('messages')
includeToolTurns: z.boolean().default(false)
excludeFromConversationThread: z.boolean().default(false)
```

### 스코프 정책

| 컨테이너 | 정책 |
|---|---|
| Sub-workflow (`executeInline`) | parent thread 상속·공유 |
| Background | 격리 — enqueue 시점 snapshot |
| Loop / ForEach / Map / Parallel | parent thread 상속·공유 |

### 영속화

- 실행 중: in-memory `ExecutionContext`
- 실행 후: 신규 DB 컬럼 없음. NodeExecution.outputData 에 분산 저장된 채 reconstruct.

## Spec follow-up (consistency-check 2026-05-14_17-19-21 발견 — 별도 후속)

본 Phase 2 진행에 영향 없는 spec 보강 항목. 다음 phase 진행 중 적절한 시점에 project-planner 호출하거나 본 plan 종료 시 별도 spec-update- 로 분리.

- **W1**: `text_classifier` / `information_extractor` 의 `ai_assistant` turn text 변환 규칙 추가 (`spec/conventions/conversation-thread.md §1.4`). Phase 4 의 Plan 에 두 핸들러 turn push 태스크 추가 (현 Phase 4 는 ai_agent 만 다룸 — v1 의 "모든 AI 노드 push" 정책과 일관성 확인).
- **W2**: `spec/conventions/conversation-thread.md §5.1` system row 인라인 주석 (Anthropic API 비호환 + provider 분기) — 표 외부 각주 보강.
- **W3**: `spec/conventions/node-output.md` Principle 2 LLM 계열 meta 목록에 `meta.contextInjection?` 추가.
- **W4**: `spec/conventions/conversation-thread.md §2.1` 에 Presentation 노드 push 트리거의 현재 구현 상태 (legacy `submitted` 등) 주석. 또는 실행 엔진을 spec `resumed` 로 선제 마이그레이션. Phase 3 시점에 결정.
- **W5**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` step 4 전후 single-turn `ai_user` / `ai_assistant` push step 명시. Phase 4 spec 갱신과 함께.
- **W6**: `spec/conventions/node-output.md` Principle 8.2 "프레젠테이션 뷰" 행을 Principle 4.3 실제 필드(items/rows/totalRows/data/rendered) 로 대체 — 옛 `output.view` 래퍼 잔존 cleanup.
- **W7 (본 phase 적용)**: `DEFAULT_THREAD_ID = 'default'` 상수 **필수** — types.ts 에 export const 로 추출. 코드 어디에서도 magic string `'default'` 직접 사용 금지.
- **W8**: `ai-agent-tool-connection-rewrite.md` 결정 (c) "AI Tool 노드 신설" 채택 시 `ConversationTurnSource.ai_tool` 명칭 재검토 — 후보: `tool_result`, `agent_tool`. (이미 plan 의존성 메모 추가됨, 한 줄 보강만)

## Risk

| 위험 | 방어 |
|---|---|
| 기존 워크플로우 회귀 | `contextScope: 'none'` default |
| 토큰 폭증 | char 기반 cap 3종 + `meta.contextInjection.dropped` 노출 |
| 자체 messages + 주입 중복 | `getThreadExcludingNode` + 매 turn 재빌드 |
| Background race | enqueue snapshot, 단방향 |
| Tool turn noise | `includeToolTurns: false` default |
| Tool result credential leak | sanitizer + cap |
| Server restart 시 thread 손실 | NodeExecution 분산 저장이 SoT |
