---
worktree: (unstarted)
started: 2026-05-24
owner: developer (TBD)
status: backlog
---

# Slack Socket Mode 지원 — v1 Webhook-mode only 의 보완

Slack v1 의 [R-S-3](../../spec/4-nodes/7-trigger/providers/slack.md#r-s-3-v1--webhook-mode-only-socket-mode-는-v2) "Webhook-mode only" 결정의 결과로 private network 안의 Slack 운영이 불가능. v2 에서 Socket Mode (WebSocket) 도입.

## 진입 조건 (사용자 결정 필요)

- [ ] 사용자가 private network / firewall 안의 Slack 운영 사용 사례 명시
- [ ] WebSocket 인프라 (long-lived connection + 다중 인스턴스 라우팅) 도입 결정
- [ ] R-S-3 의 기각 결정 번복 정당화

## 산출물 범위

1. **Spec 변경** — `spec/4-nodes/7-trigger/providers/slack.md`
   - §3 에 Socket Mode path 매핑 추가 (`apps.connections.open` endpoint)
   - R-S-3 의 결정 번복 + Rationale 갱신 (Webhook-mode + Socket Mode hybrid)
   - 트리거 config 에 `slackMode?: 'webhook' | 'socket'` 옵션 추가 (default webhook)

2. **Backend 구현**
   - `slack-socket.service.ts` — Socket Mode WebSocket 연결 manager (bot 별 1개)
   - Slack 의 `apps.connections.open` 으로 WebSocket URL 발급
   - envelope_id 기반 ack flow (3초 시한)
   - Discord Gateway 와 유사한 다중 인스턴스 라우팅 패턴

3. **Test**
   - Unit: connection lifecycle (envelope_id ack / reconnect)
   - Integration: events_api / interactivity / slash_commands 가 Socket Mode 로 도착하는 경로

## 위험 / 의존성

- Discord Gateway 와 매우 비슷한 인프라 — 두 plan 을 동시에 진행하면 공유 WebSocket connection manager 추상화 가능 (`chat-channel-websocket-base`)
- Slack 의 Socket Mode 는 **App Level Token** (`xapp-...`) 필요 — bot token (`xoxb-...`) 와 별도 자격증명. config 에 추가 ref 필드 (`appLevelTokenRef`) 신설 검토.
- 다중 인스턴스 라우팅 — Redis-based assignment.

## 참조

- Spec: `slack.md R-S-3`
- Sibling plan: `chat-channel-discord-gateway` (유사한 WebSocket 인프라 — 같이 진행 시 공유 추상화)
- Slack docs: [Socket Mode](https://api.slack.com/apis/socket-mode)
