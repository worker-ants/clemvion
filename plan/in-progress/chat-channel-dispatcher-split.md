---
status: backlog
created: 2026-05-22
owner: project-planner
priority: post-v1 (provider ≥ 2 도입 시 trigger)
---

# Plan — NotificationDispatcher → ChannelDispatcher 분리 리팩토링

## 배경

[CCH-AD-05 Rationale R8](../../spec/5-system/15-chat-channel.md#r8-notificationdispatcher-분리--provider-증가-시점에-재검토-2026-05-22) 가 명시한 후속 결정:

현재 v1 의 `NotificationDispatcher` 는 세 가지 fan-out 갈래를 단일 클래스에 담는다:
1. 외부 HTTP POST (EIA-NX-*)
2. Redis pub/sub (SSE 어댑터 fan-out)
3. In-process EventEmitter (Chat Channel adapter)

(a) Chat Channel provider 가 2개 이상으로 늘어나거나 (b) 새 in-process subscriber 유형이 추가되는 시점에 `ChannelDispatcher` (EventEmitter 전담 in-process bus) 를 `NotificationDispatcher` 에서 분리한다.

## Trigger 조건

본 plan 의 in-progress 진입 조건:

- Telegram 외 두 번째 chat channel provider (Slack / KakaoTalk 등) 도입 결정
- 또는 in-process subscriber 가 chat channel 외에 추가 (예: in-process metrics aggregator)

위 trigger 가 발생할 때까지 본 plan 은 backlog 유지.

## 범위 (trigger 발생 시)

### Phase 1 — 인터페이스 분리
- `ChannelDispatcher` interface 신설 (`onChannelEvent(triggerId, handler)`, `offChannelEvent(triggerId)`)
- `NotificationDispatcher` 에서 in-process EventEmitter 관련 메서드 추출

### Phase 2 — 라이프사이클 정책 적용 (R8 의무 사항 강화)
- `setupChannel()` 시 동일 triggerId 의 기존 listener 제거 → 새 listener 등록 (멱등성)
- `teardownChannel()` 시 listener 반드시 해제 (중복 발송 방지)
- listener 등록 키: `(triggerId, provider)` 단위

### Phase 3 — 구현·테스트
- `ChannelDispatcher` 단위 테스트 (등록·해제·중복 방지·다중 provider)
- 기존 NotificationDispatcher 의 외부 HTTP / Redis pub/sub 경로는 무변경

## 의존 관계

- 관련 spec: spec/5-system/15-chat-channel.md §3.1, §3.2, §3.3, Rationale R4 + R8
- 구현 영향: codebase/backend/src/modules/external-interaction/notification-dispatcher.service.ts, codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts

## Out of Scope

- 외부 HTTP / Redis pub/sub 경로 변경
- 다중 인스턴스 환경 cross-process pub/sub 변경
