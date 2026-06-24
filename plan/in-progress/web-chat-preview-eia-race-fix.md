---
title: 웹채팅 미리보기 EIA race fix — SSE replay(lastEventId) + getStatus 표면 복구 + CORS 분리배포 문서
worktree: web-chat-console-mgmt
started: 2026-06-24
owner: planner
status: in-progress
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/7-channel-web-chat/4-security.md
  - spec/7-channel-web-chat/5-admin-console.md
related_spec:
  - spec/5-system/14-external-interaction-api.md
  - spec/7-channel-web-chat/4-security.md
  - spec/7-channel-web-chat/5-admin-console.md
related_plans:
  - plan/complete/web-chat-console-management.md
---

# 배경

웹채팅 라이브 미리보기에서 **첫 노드(캐러셀 등 빠른 waiting_for_input)가 위젯의 SSE 구독보다
먼저 emit** 되어, 위젯이 `lastEventId` 없이 연결하면 buffer replay 를 못 받아 **heartbeat 만**
수신 → 캐러셀 미표시·입력 비활성 (CORS·stale session 과 별개로 확정된 race).

추가로, 운영이 프론트(`workflow.getit.co.kr`)/API(`workflow-api.getit.co.kr`)를 **별도 origin** 으로
분리 배포하면 위젯→API 가 cross-origin → `/api/external/*` 가 CORS 로 막힘 (`WEB_CHAT_WIDGET_ORIGINS`
에 프론트 origin 필요). spec/문서에 이 분리배포 케이스 안내가 누락돼 있었다.

사용자 합의 범위: **둘 다** — (2) 위젯 SSE replay + (1) 백엔드 getStatus 표면 복구 + 문서 보완.

# 핵심 사실 (조사 확정)
- seq: Redis `INCR` 로 **1부터** 단조 증가(`execution-seq-allocator`). `openStream(lastEventId=0)` → `sse-adapter:91-98` 이 seq≥1 전부 replay. `execution.started` 는 위젯 `handleEiaEvent` 가 무시.
- waiting 표면: `button-interaction.service.ts` 가 emit 하는 payload(interactionType/buttonConfig/conversationThread)는 `NodeExecution.outputData`(`withInteractionMeta`)·`status=WAITING_FOR_INPUT` 에 저장 → getStatus 가 재구성 가능.
- `eia-types.ExecutionStatus` 에 `currentNode`/`context` 필드 이미 존재. `EiaClient.getStatus` 도 존재.

# 실행 계획

## P0 — race fix
- [x] **(2) 위젯 SSE replay**: `use-widget.ts` start·restore 경로의 `openStream(session)` 을 `openStream(session, lastEventId)` 로 — buffer 의 누락 이벤트 replay
- [x] **(1a) 백엔드 getStatus 확장**: `interaction.service.ts getStatus` — `WAITING_FOR_INPUT` 시 현재 waiting `NodeExecution` 조회해 `currentNode{id,type,interactionType}`·`context{buttonConfig|formConfig|conversationConfig, conversationThread}` 채움(현재 null). seq 는 가능하면 정확값(allocator peek), 어려우면 0 유지 + replay 로 보정
- [x] **(1b) 위젯 status 시드**: start·restore 직후 `client.getStatus()` → WAITING dispatch 로 현재 표면 시드(buffer 만료/새로고침에도 복구). `parseWaitingForInput` 형식과 일치 매핑. 실패는 console.warn 후 진행(soft)

## 문서
- [x] **spec 5-system/14**: §5.3 getStatus 의 `currentNode`/`context`(waiting 표면) 명시, §3.5 replay 의 `lastEventId=0`(seq≥1 전부) 동작 명시
- [x] **spec 7-channel 4-security §2 / 5-admin-console §6**: 프론트≠API origin 분리배포 시 `/api/external/*` cross-origin → `WEB_CHAT_WIDGET_ORIGINS` 에 프론트 origin 필요 명시
- [x] **k8s/README.md**: 동일 CORS 운영 안내

## 마감
- [x] **테스트**: interaction.service.spec(getStatus waiting 표면), sse-adapter.spec(lastEventId=0 replay), use-widget.test(getStatus 시드·openStream lastEventId), eia-client.test(getStatus)
- [~] **검증**: bootstrap·typecheck·lint(error 0)·unit(backend 28·cwc 16) green → build 진행 중 → e2e
- [ ] **리뷰·PR**: `/ai-review` → resolution → `/consistency-check --impl-done` → PR(base main)
