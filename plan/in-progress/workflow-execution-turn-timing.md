---
worktree: workflow-turn-timing-69fee2
started: 2026-06-03
owner: developer
status: in-progress
pr: 445
---

# 워크플로우 실행 디버깅 UI — 요소별 발생 시각(절대) + 소요시간 노출

## 배경 / 요구

사용자 요구: 워크플로우 실행 내역에서 **각 요소의 발생 시각(createdAt 성격, 절대 시각)**과
**AI 에이전트가 매 턴 응답을 작성하는 데 걸린 소요시간(duration)**을 보고 싶다.

반영 surface 2곳:
- 에디터 페이지(`/workflows/:workflowID`) 하단 디버깅 UI (타임라인 + 상세)
- 실행 내역 페이지(`/workflows/:workflowID/executions/:executionID`)

노드 단위가 아니라 **멀티턴 AI 노드 내부의 모든 요소** — 유저 발화 / LLM 응답(tool-call만 있는
응답 포함) / tool 실행 / presentation·system — 각각에 시각·소요시간을 노출한다. 표기는 **절대 시각**
(`formatDate(.., "time"|"datetime")`).

## 데이터 실태 (조사 완료)

| 요소 | 발생 시각 | duration | 비고 |
| --- | --- | --- | --- |
| user 발화 | ✅ `receivedAt`(라이브) / `thread.turns[].timestamp`(히스토리) | — (즉시) | 데이터 OK |
| assistant(LLM 응답, tool-only 포함) | ❌ **데이터 없음** | ✅ `llmCalls[].durationMs` | **백엔드 추가 필요** |
| tool 실행 | △ 라이브만 client stamp / 히스토리 없음 | ✅ `tool_call_completed.durationMs` | **백엔드 startedAt/finishedAt 영속 필요** |
| presentation/system/system_error | ✅ `thread.turns[].timestamp` | — | 데이터 OK, 렌더 누락 |

핵심: assistant 절대 시각 + tool 히스토리 시각만 데이터가 없다 → WS 프로토콜 + 영속 turnDebug 에
`startedAt`/`finishedAt`(ISO) 추가. **DB 마이그레이션 불필요** (turnDebug 는 `NodeExecution.output_data`
JSONB 내부). 모두 하위호환 optional 필드.

## Phase 1 — Spec (project-planner 영역; consistency-check --spec 선행)

- `spec/5-system/6-websocket-protocol.md` §4.4
  - `ai_message.llmCalls[].startedAt` / `.finishedAt` (ISO8601) 필드 정의 + JSON 예시
  - `tool_call_started.startedAt` 추가
  - `tool_call_completed.startedAt` / `.finishedAt` 추가
  - Reconciliation/persist 노트 업데이트 (turnDebug 영속 형태에도 동봉)
  - Rationale 항목 추가
- `spec/conventions/conversation-thread.md` §1.2 / §9
  - 각 turn source 별 timestamp/duration 렌더 규약 (모든 요소 노출)

## Phase 2 — Backend (developer)

- `ai-agent.handler.ts`: single/multi-turn LLM 호출 + tool 실행 캡처 지점에서 `startedAt`/`finishedAt`
  ISO 기록 → `llmCalls[]` · `toolCallTraces[]` · turnDebug 동봉
- WS payload 타입 4종 (`websocket.service.ts`) + `execution-engine.service.ts`
  `buildAiMessageDebugFromResumeState` 전파
- 단위/통합 테스트

## Phase 3 — Frontend (developer)

- 타입: `LlmCallEntry`, `TurnToolCallEntry`, WS payload, `ai_message` 핸들러 payload
- `conversation-utils.ts`: assistant `timestamp`(=llmCalls[].startedAt), tool 히스토리 `startedAt` 채우기
- 렌더 (절대 시각):
  - `conversation-timeline-item.tsx` — 모든 turn 시각 + assistant·tool duration
  - `result-timeline.tsx` 노드 row, `result-detail.tsx` 헤더
  - 실행 내역 `executions/[executionId]/page.tsx` 노드 리스트 + 상세 헤더
  - `conversation-inspector.tsx` 누락 요소 보완
- i18n 키 (KO/EN parity)

## Phase 4 — 검증

- 프론트/백 빌드·타입체크·테스트
- `/ai-review` + critical/warning fix
