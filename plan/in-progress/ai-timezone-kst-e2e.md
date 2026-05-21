---
worktree: (pending assign)
started: 2026-05-21
owner: developer
---

# Plan: AI Timezone Context — KST e2e 시나리오 통합 검증

`ai-timezone-context-followups.md` (PR #228 예정) 의 M2 항목을 본 plan 으로 분리.

## 배경

`impl-ai-timezone-context.md` (PR #191) 의 System Context Prefix 기능 회귀 안전망으로 e2e 가 부족하다.

현재 안전망:

- unit: `system-context-prefix.spec.ts` (27 case, KST/UTC/America/New_York/Asia/Kolkata 등)
- unit: `system-context-schema.spec.ts` (helper + pickNonDefaultSystemContext)
- handler: `information-extractor.handler.spec.ts` single + multi-turn prefix 케이스 4건
- engine: `execution-engine.service.spec.ts` `runExecution — workspace timezone injection` 2 case (`Asia/Seoul` mock, 빈 settings fallback)

빠진 것: **실제 워크플로 실행 경로** (HTTP POST `/api/workflows/{id}/execute` → BullMQ → engine runExecution → AI 핸들러) 에서 AI Agent / IE / TC 노드가 KST workspace 의 `__workspaceTimezone` 을 받아 systemPrompt prefix 에 `Asia/Seoul (UTC+9)` 줄을 생성하는지 e2e 단언.

## 선결 인프라

본 검증은 **LLM stub provider** 가 필요하다. 본 plan 의 첫 phase 는 인프라 작성.

### Phase A — e2e LLM stub provider 도입

- [ ] `codebase/backend/src/modules/llm/` 에 `e2e-stub.client.ts` 추가 — `LlmClient` interface 구현. `messages[0].content` (system prompt) 를 메모리 ring buffer 에 저장하고, `finalizeCall(...)` 형태의 ChatResult 를 즉시 반환.
- [ ] e2e bootstrap (`test/helpers/*` 또는 `app.module` factory) 에서 `LLM_PROVIDER=stub` 또는 `NODE_ENV=test-e2e` 시 본 stub 을 inject. 프로덕션 provider (anthropic / openai) 는 변경하지 않는다.
- [ ] stub introspection 헬퍼 — `getLastSystemPrompt(executionId)` 가 마지막 system message 를 반환 (test 가 단언 가능).

### Phase B — KST scenario e2e

- [ ] `codebase/backend/test/ai-timezone.e2e-spec.ts` 신설:
  - workspace 생성 → settings PATCH `{ timezone: 'Asia/Seoul' }`
  - AI Agent 노드 1개 + Manual Trigger 1개의 워크플로 생성 (`POST /api/workflows/.../nodes`)
  - 실행 후 `getLastSystemPrompt(executionId)` 로 systemPrompt 회수
  - assertion: `^## System Context\n` + `- Current time: 2026-... +09:00` + `- Timezone: Asia/Seoul (UTC+9)`
- [ ] 동일 워크플로 + UTC workspace (`settings.timezone` 미지정) 케이스 — `Timezone: UTC (UTC)` 노출 검증
- [ ] config 의 `includeSystemContext: false` 케이스 — prefix 부재 검증

### Phase C — 후속 정리

- [ ] make e2e-test 가 추가 suite 포함해 그린.
- [ ] 본 plan 을 `plan/complete/` 로 mv.

## 우선순위

LOW. 본 plan 의 wiring 회귀는 unit/handler/engine spec 으로 cover 되며, e2e 누락이 운영 incident 로 이어진 사례는 아직 없다. Phase A 인프라 작성 비용이 본 e2e suite 1건의 가치를 상회하지 않도록 작은 단위로 분리 권장.
