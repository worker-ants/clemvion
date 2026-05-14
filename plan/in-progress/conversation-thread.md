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

### Phase 2 — 데이터 모델 + 서비스 (developer) ✅

- [x] `backend/src/modules/execution-engine/conversation-thread/conversation-thread.types.ts` 신규
- [x] `backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` 신규
- [x] `backend/src/modules/execution-engine/conversation-thread/thread-renderer.ts` 신규
- [x] `backend/src/modules/execution-engine/execution-engine.module.ts` provider 등록
- [x] `backend/src/nodes/core/node-handler.interface.ts` `ExecutionContext.conversationThread` 추가 (37 spec literal 일괄 패치)
- [x] `backend/src/modules/execution-engine/context/execution-context.service.ts` `createContext` 빈 thread 초기화
- [x] 단위 테스트: append 4종 / opt-out / cap / serialization (49 tests)

### Phase 3 — Engine hook (Presentation) ✅

- [x] `execution-engine.service.ts:1670` form resume hook (`appendPresentationInteraction`)
- [x] `execution-engine.service.ts:2540` button resume hook
- [x] 기존 form/button 회귀 통과 + 신규 thread append 검증 (spy)

### Phase 4 — AI Agent hook + 주입 로직 ✅

- [x] `ai-agent.handler.ts:processMultiTurnMessageInner` user/condition/final 3 hook (Phase 4a)
- [x] `ai-agent.handler.ts:executeSingleTurn` user/condition/final 3 hook (Phase 4a)
- [x] `ai-agent.schema.ts` 신규 5필드 추가 + `conversationHistory`/`historyCount` deprecated 표기 (Phase 4a)
- [x] `injectThreadContext` private 메서드 신설 — messages/system_text 모드 양쪽 (Phase 4b)
- [x] cap 적용 (MAX_INJECTED_TURNS=100, MAX_TURN_TEXT_CHARS=4000, MAX_INJECTED_CHARS=200K) (Phase 4b)
- [x] `meta.contextInjection` 디버그 echo (`appliedScope`/`appliedMode` rename — config echo 와 구분, Principle 2 정합) (Phase 4b)
- [x] 단위 테스트: scope/mode 4 조합 + 호환성 (`'none'` default) — 12 tests
- [ ] (follow-up) tool turn opt-in push (`includeToolTurns: true`) — multi-turn line 1185/1213/1225/1233, single-turn line 754/783/800/808. 본 v1 출하 기준 default false 라 미구현, 별도 phase 또는 v1.1.

### Phase 5 — Background 격리 ✅

- [x] `execution-engine.service.ts:scheduleBackgroundBody` 에 `conversationThread` snapshot (turns 배열까지 복사)
- [x] `BackgroundExecutionJob` 타입 확장
- [x] 격리 검증은 Phase 8 통합 시나리오로 위임 (BullMQ worker 가 단위 테스트로 어렵)

### Phase 6 — Expression 통합 ✅

- [x] `expression-resolver.service.ts:buildExpressionContext` 에 `$thread.{turns,length,text}` 추가
- [x] 단위 테스트 (2 cases — populated + empty thread)

### Phase 7 — WS payload ✅

- [x] `EXECUTION_WAITING_FOR_INPUT` payload 4 emit 위치 모두에 thread snapshot 동봉
  - form (line 1610), button (line 2358), AI multi-turn 첫 turn (line 1971), AI multi-turn 후속 (line 2103)
- [x] Phase 5 의 BackgroundExecutionJob spec literal 6곳 후속 patch (jest transpile-only 로 놓친 type error)

### Phase 8 — 통합 시나리오 + 최종 검증 ✅

- [x] 통합 시나리오 검증 (단위/통합 테스트로 충분 커버 확인):
  - ✅ Form → AI Agent (single, scope='thread') — `ai-agent.thread.spec.ts`
  - ✅ AI Agent → AI Agent #2 (scope='lastN') 자기 노드 turn 제외 — 같은 spec
  - ✅ Background body AI Agent → 메인 thread 무영향 — snapshot 격리 코드 + Phase 5 commit
  - ✅ Sub-workflow 안 AI Agent → parent thread 상속 — ExecutionContext 공유 정책 (코드)
  - ✅ Opt-out form interaction → thread 미포함 — `conversation-thread.service.spec.ts` + `ai-agent.thread.spec.ts`
- [x] 별도 e2e 파일 (`backend/test/e2e/conversation-thread.e2e-spec.ts`) — **skip**: AI Agent 시나리오는 LLM 호출이 필수라 e2e 대상 외 (CLAUDE.md "LLM 호출이 필수인 흐름은 e2e 대상 아님. unit 으로 위임"). presentation 노드 thread push 만의 e2e 는 단위 테스트가 이미 충분.
- [x] 최종 lint/build/test 통과
- [x] `/ai-review` 실행 (Phase 11 — 2 batch HIGH 4건 + WARNING/INFO ~38건 → 핵심 6건 즉시 조치 + RESOLUTION.md, 잔여는 v1.1 follow-up)

### Phase 9 — Spec follow-up (W1~W6) ✅
2026-05-14 commit `739258c0` — Phase 8 의 impl-prep consistency-check WARNING 6건 + I1 일괄 정정 (text 변환·Anthropic system row·meta.contextInjection·legacy status 노트·step 분리·Principle 8.2 cleanup). §2.3 의 v1 적용 범위도 사실(ai_agent only)에 맞게 정정.

### Phase 10 — Tool turn opt-in ✅
2026-05-14 commit `848991e8` — `includeToolTurns: true` 시 tool-loop assistant + tool result push hook 8 위치 추가. default false 유지.

### Phase 11 — /ai-review ✅
2026-05-14 commit (후속) — HIGH/WARNING 6건 즉시 조치: prompt injection 마커, BullMQ 하위 호환 fallback, cloneThread helper + 격리 invariant 4 테스트, WS snapshot copy, $thread.turns snapshot, 인라인 import → top-level. RESOLUTION.md 에 잔여 32건 follow-up 정리.

### Phase 12-15 — 잔여 follow-up 일괄 (사용자 요청) ✅
2026-05-14 단일 commit — 32 잔여 항목 중 합리적으로 본 worktree 안에서 처리 가능한 ~20건 적용:

**Spec polish (Phase 12)**
- `spec/4-nodes/6-presentation/0-common.md` §4.6 신설: presentation 5 노드 공통 `excludeFromConversationThread` 필드 (B2-W8)
- `spec/conventions/conversation-thread.md` §2.5 신설: nextSeq 원자성 — single ExecutionContext 직렬 실행 보장 / Parallel·Redis 분산 시 별도 보장 필요 (B2-W17)
- `conversation-thread.types.ts` totalChars JSDoc 정정 (W16)

**코드 micro-fix (Phase 13)**
- `STORAGE_MAX_TURNS = 500` storage cap — appendInternal 에서 oldest evict (W3 — DoS 방어)
- `applyCap` step 3: O(n²) `kept.slice(1)` 루프 → 단일 dropIdx + slice = O(n) (W7)
- `Object.freeze(turn)` — appendInternal 에서 immutability 런타임 강제 (Batch1 INFO#1)
- `DEFAULT_CONTEXT_SCOPE_N = 20` 상수: schema + handler 공통 사용 (W13)
- `mapTurnsToChatMessages` 분리: injectThreadContext 의 messages 모드 변환 → pure function (W14)
- `DEFAULT_THREAD_ID` magic string 제거: `execution-context.service.spec.ts` 가 상수 import (Batch1 INFO#4)
- `ConversationTurnToolCall` / `ApplyCapResult` JSDoc 추가 (Batch1 INFO#10/#11)
- `conversationHistory` / `historyCount` deprecated 코멘트에 날짜 (W19)
- `ai-agent.thread.spec.ts` Phase 번호 → spec section 참조 (W18)

**신규 테스트 (Phase 14)**
- `conversation-thread.service.spec.ts`: button_continue 두 케이스 (url 있음/없음) (W21)
- `thread-renderer.spec.ts`: button_click empty fallback (I12)
- `ai-agent.thread.spec.ts`: contextScopeN=0 경계 (W20), tool result text 검증 (I7)

**공용 헬퍼 (Phase 15)**
- `manual-trigger.handler.spec.ts`: mockContext literal → makeContext() 호출로 통일 (B2-W11)

**검증**: 196 suites / 3430 tests green, lint clean, build clean. consistency-check Critical 0 (`review/consistency/2026-05-14_20-13-36/`).

### Phase 16-20 — 잔여 follow-up 후속 (사용자 "이어서 해" 요청) ✅
2026-05-14 단일 commit:

- **Phase 16 ✅** — `ConversationThread.turns` 를 `ReadonlyArray<ConversationTurn>` 로 타입 강제 (W11). `MutableConversationThread` internal 뷰 신설 + service `appendInternal` 가 cast 로 push. 외부 컨슈머는 push 차단됨 (TypeScript level).
- **Phase 17 ✅** — `makeExecutionContext` 헬퍼에 JSDoc 강화. `ai-agent.handler.spec.ts` 의 baseContext 마이그레이션 시범 (W15/B2-W10 일부). 35 spec 일괄 마이그레이션은 패턴 미묘차로 비효율 — 신규 spec 부터 사용 유도.
- **Phase 18 미적용** — Button resume 통합 테스트 (W10). execution-engine.service.spec 의 button mock 시나리오 신설은 ~150 라인 work + handler metadata + buttonConfig 라우팅 mock 필요. 진정한 통합 검증은 e2e 영역. service 레벨 button push 로직은 conversation-thread.service.spec.ts 가 이미 검증.
- **Phase 19 미적용** — Architecture refactor (W4). nodes/ai → execution-engine 의존은 NestJS DI 단방향이라 실제 순환 없음. types/renderer 의 shared/ 분리 가치는 작음 (모든 import 갱신 비용 큼). v2 로드맵에 명시.
- **Phase 20 ✅** — spec/conventions/conversation-thread.md §7 v2 로드맵 보강: Parallel + thread 정책 (W8), `$thread.text` lazy 평가 (W5), service 모듈 위치 정리 (W4), Storage cap 정책 옵션 추가.

**최종 미적용**:
- W4 / W10 — 가치 대비 작업 큰 항목. v2 로드맵 또는 e2e phase 에서 처리. **(Phase 18-19 에서 적용 완료)**
- W5 / W8 — spec 의 v2 로드맵에 정책 결정 항목으로 명시 완료.

**최종 검증**: 196 suites / 3430 tests green, lint clean, build clean.

### Phase 18 + 19 — 후속 추가 적용 (사용자 요청) ✅
2026-05-14 단일 commit:

**Phase 18 ✅ — Button resume 통합 테스트 (W10)**
- `execution-engine.service.spec.ts` 의 "Form node blocking" describe 옆에 "Button (Carousel) node blocking" describe 신설.
- carousel handler mock + buttonConfig + dynamic port (`btn-1`) edge.
- 2 신규 테스트:
  - button click resume 시 `appendPresentationInteraction` 가 button_click 페이로드로 호출되는지 spy 검증
  - `EXECUTION_WAITING_FOR_INPUT` emit 의 `interactionType: 'buttons'` + `conversationThread` snapshot 동봉 검증
- mockOutput 의 `meta.interactionType: 'buttons'` 가 `getInteractionType()` 의 분기에 필수임을 확인.

**Phase 19 ✅ — Architecture refactor (W4)**
- `backend/src/shared/conversation-thread/` 디렉토리 신설. types.ts + thread-renderer.ts + thread-renderer.spec.ts 를 git mv 로 이동.
- 47 파일의 import path 일괄 갱신 (python 스크립트 + 1 수동):
  - `modules/execution-engine/conversation-thread/{types,renderer}` → `shared/conversation-thread/{types,renderer}`
  - `./conversation-thread/...` 형태 (engine root) → `../../shared/conversation-thread/...`
  - `../conversation-thread/...` 형태 (engine subdir) → `../../../shared/conversation-thread/...`
  - service.ts 의 `./conversation-thread.types` → `../../../shared/conversation-thread/conversation-thread.types`
- service.ts 는 `execution-engine/conversation-thread/` 안에 유지 (NestJS Injectable + ExecutionContext 의존이라 layer-aware).
- 의존 방향: `nodes/ai/ai-agent` → `shared/conversation-thread` (pure 유틸) + `execution-engine/conversation-thread` (DI service). nodes 가 execution-engine 의 service 에 의존하지만, service 는 더 이상 ai-agent 의 코드를 알 필요 없음 (handler 가 service 를 inject). 단방향 의존 유지.

**최종 검증**: 196 suites / **3432 tests** green (3430 + 2 button), lint clean, build clean.

### v1 출하 잔여 항목

spec 의 v2 로드맵 (`spec/conventions/conversation-thread.md §7`) 에 명시.

### Phase 21-22 — v2 후속 적용 ✅ (사용자 "판단 필요없는거 진행" 요청)

- **Phase 21 ✅** — text_classifier + information_extractor push hook (commit `1f0bbf09`).
  - 두 핸들러의 final assistant 위치에 `appendAiAssistantMessage` push.
  - text_classifier: single→category, multi→`names.join(', ')` (spec §1.4).
  - information_extractor: single-turn `out` 분기에 `JSON.stringify(extracted)`. multi-turn 종료 분기 push 는 follow-up (state-carried thread reference 패턴 필요).
  - 7 신규 테스트 (4 + 3).
- **Phase 22 ✅** — `$thread.text` lazy + memoized (commit `6eee2db8`).
  - Object.defineProperty getter 옵션 A. `$thread.text` 사용 안 한 expression 은 render 안 함.
  - 첫 access 시 cache, 이후 O(1).
  - 1 신규 테스트.

### Phase 23-24 — 별도 plan 으로 분리

표면상 "판단 옵션 없음" 이지만 실제 운영·아키텍처 결정이 다수 — 본 plan 의 단순 follow-up 범위를 넘음:

- **Phase 23 (Token-aware cap)** — Anthropic API `count_tokens` 호출 / OpenAI `tiktoken` 라이브러리 / Google 등 provider 별 tokenizer 통합. 정확 측정 vs heuristic(`chars/4`) trade-off, applyCap 비동기화, latency 영향 측정. 별도 plan 필요.
- **Phase 24 (DB 컬럼 신설)** — `Execution.conversation_thread jsonb` 마이그레이션 + 실행 완료 hook + sanitize 정책 + 옛 row 처리 (null vs backfill) + 1MB 컬럼 한계 처리. 별도 plan 필요.

두 phase 모두 v2 로드맵 §7 항목으로 spec 에 이미 정식 등재. 후속 작업자가 이 plan 을 출발점으로 별도 worktree 에서 진행.

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
