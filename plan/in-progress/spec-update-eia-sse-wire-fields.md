---
worktree: fix-webchat-sse-field-map-22cd94
started: 2026-06-06
owner: resolution-applier
---
# Spec Update Draft — EIA SSE wire 필드명 (§6.2 / §6.5)

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — 코드(`eia-types.ts`, `eia-events.ts`)가 실제 백엔드 wire 형태(`waitingNodeId`/`nodeOutput.*`/`message`)를 사용하도록 수정됐으나, spec §6.2·§6.5 본문이 구 notification 추상 형태(`node.id`/`context.*`)만 기술. 코드가 정합이고 spec 이 낡음.

## 원본 발견사항

**INFO-1 (SPEC-DRIFT)**:
> SUMMARY#1: EIA §6.2 notification 형태가 SSE wire 필드명과 상이 — `spec/5-system/14-external-interaction-api.md §6.2` 본문이 `node.id`/`context.*` 구조를 정의하나 SSE wire는 `waitingNodeId`/`nodeOutput.*` 사용. 코드가 맞고 spec 갱신 누락 상태.

**INFO-2 (SPEC-DRIFT)**:
> SUMMARY#2: EIA §6.5 `execution.ai_message` — SSE wire에서 `message` 필드명이 그대로 도착함을 spec 본문이 명시하지 않음. WS §4.4와 코드는 정합, spec §6.5 서술 불완전.

## 제안 변경

### §6.2 (`execution.waiting_for_input` 페이로드)

**현재**: 본문이 `node.id`/`context.formConfig`/`context.buttonConfig`/`context.conversationConfig`/`context.conversationThread` 구조만 서술 (notification webhook outbound 추상 형태).

**제안 추가**: §6.2 jsonc 블록 아래 또는 블록 헤더에 다음 note 삽입:

```
> **SSE 스트림 wire 형태 주의**: SSE 스트림(`GET /api/external/executions/:id/stream`)에서 전송되는
> `execution.waiting_for_input` 페이로드는 위 notification 추상 형태가 아닌 **백엔드 fanout wire
> 형태**를 그대로 전송한다. 구체적으로:
> - `node.id` → `waitingNodeId` (최상위 필드)
> - `node.interactionType` → `interactionType` (최상위)
> - `context.conversationConfig` → `nodeOutput.conversationConfig`
> - `context.buttonConfig` → `buttonConfig` (최상위)
> - `context.formConfig` → `nodeOutput.formConfig` (없으면 `nodeOutput` 자체)
> - `context.conversationThread` → `conversationThread` (최상위)
>
> 위젯/SDK 는 `waitingNodeId`·`nodeOutput.*` 필드를 직접 읽어야 한다. 이 차이는 SSE 어댑터가
> notification envelope 재구성 없이 execution-engine raw emit 을 fan-out 하기 때문이다.
```

### §6.5 (`execution.ai_message` 페이로드)

**현재**: WS §4.4 payload 를 포함한다고만 서술하며, SSE wire 에서 실제 필드명 (`message`, `nodeId`, `turnCount`, `presentations`) 을 명시하지 않음.

**제안 추가**: §6.5 본문 마지막에 다음 note 삽입:

```
> **SSE wire 필드**: `execution.ai_message` SSE 프레임의 data 는 다음 필드를 포함한다:
> `message` (어시스턴트 텍스트, WS `text` 필드와 동명이 아님에 주의), `nodeId`, `turnCount`,
> `presentations?: PresentationPayload[]`. `text` 필드는 존재하지 않으며 위젯/SDK 는 `message`
> 를 읽어야 한다.
```

## 담당
`project-planner` 가 `spec/5-system/14-external-interaction-api.md` §6.2·§6.5 본문에 위 note 를 삽입한 뒤 consistency-check --spec 을 수행하고 본 plan 파일을 `plan/complete/` 로 이동한다.
