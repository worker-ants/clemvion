---
worktree: (assigned at impl-start)
started: 2026-05-24
owner: developer (TBD)
status: backlog
---

# Discord Gateway 도입 — v1 의 Interactions Webhook only 한계 해소

Discord v1 의 [R-D-3](../../spec/4-nodes/7-trigger/providers/discord.md#r-d-3-v1--interactions-webhook-only-gateway-는-v2) "Interactions Webhook only" 정책의 결과로 [R-CC-13](../../spec/5-system/15-chat-channel.md#r-cc-13-discord-v1-의-cch-mp-01-부분-유예--interactions-webhook-only-의-결과) 의 CCH-MP-01 부분 유예 — 자유 텍스트 DM 미수신. v2 에서 Gateway WebSocket 연결로 해소.

## 진입 조건 (사용자 결정 필요)

- [ ] 사용자가 "자유 채팅 강제" 가 필요한 사용 사례를 명시
- [ ] WebSocket 인프라 (long-lived connection + heartbeat + 다중 인스턴스 라우팅) 도입 결정
- [ ] R-D-3 의 기각 결정 번복 정당화 (rationale-continuity-check 통과)

## 산출물 범위 (예상)

1. **Spec 변경** — `spec/4-nodes/7-trigger/providers/discord.md`
   - §3 에 Gateway path 매핑 추가 (`gateway.bot` endpoint + READY / MESSAGE_CREATE event)
   - R-D-3 의 결정 번복 + Rationale 갱신 (Webhook-mode + Gateway hybrid 인지, Gateway-only 인지)
   - R-CC-13 의 해소 명시 (CCH-MP-01 inbound text_message 완전 충족)
   - R-D-7 (file 한계) 도 부분 해소 (MESSAGE_CREATE attachment 수신 가능)

2. **Backend 구현**
   - `discord-gateway.service.ts` — WebSocket connection manager (bot 별 1개, heartbeat, resume, reconnect)
   - `discord-gateway.module.ts` — NestJS module + OnModuleInit / OnModuleDestroy
   - MESSAGE_CREATE event → ChannelUpdate 변환 (DM only filter)
   - 다중 인스턴스 라우팅 — Redis pub/sub or sticky routing (어느 인스턴스가 어느 bot 의 Gateway 보유)

3. **Test**
   - Unit: connection lifecycle (heartbeat / resume / reconnect)
   - Integration: MESSAGE_CREATE → adapter dispatch → execution

## 위험 / 의존성

- **WebSocket 인프라 부담** — long-lived connection management. discord.js 같은 lib 도입 또는 raw WebSocket 직접 관리.
- **다중 인스턴스 라우팅** — 어느 backend instance 가 어느 bot 의 Gateway 를 보유할지. Redis-based assignment / sticky session.
- **시작 비용** — bot 수가 늘면 connection 수 ↑. Discord 의 shard 패턴 (대규모 bot) 도 검토.
- **Bot scopes 추가** — Privileged Gateway Intents (Message Content Intent) 필수, 100+ guilds 봇은 Discord 승인 필요.

## 참조

- Spec: `spec/4-nodes/7-trigger/providers/discord.md` R-D-3
- 시스템 spec: `spec/5-system/15-chat-channel.md` R-CC-13
- Discord docs: [Gateway](https://discord.com/developers/docs/topics/gateway)
