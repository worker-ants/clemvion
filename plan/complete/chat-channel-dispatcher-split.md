---
worktree: chat-channel-dispatcher-split-impl-d7c3ea
status: in-progress (R8 v2 per-trigger listener 정책 적용 — 2026-05-24)
created: 2026-05-22
started: 2026-05-24
owner: developer
priority: post-v1 (provider ≥ 2 도입 시 진입)
related_spec_pr: PR #259
base_branch: claude/trigger-create-multi-provider-ui-plan-677f12 (PR #308 dependent)
---

> 본 plan 은 spec/5-system/15-chat-channel.md Rationale R8 의 의무 정책 (listener dedup·teardown) 을 v2 구조에서 적용하기 위한 분리 리팩토링 추적용이다. 본 PR (#259) 에서는 다음 사항이 정밀화 완료:
> - R8 본문에 **v1 vs v2 적용 시점** 명확화: v1 단일 dispatcher 구조에서는 subscription 1개라 per-trigger listener dedup 자체가 무의미. 정책은 분리 후 적용.
> - 본 plan 의 trigger 조건 명문화: Telegram 외 두 번째 chat channel provider (Slack / KakaoTalk 등) 도입 결정 시 본 plan 으로 진입.
>
> **Trigger 조건 충족 (2026-05-24)**: Slack / Discord backend adapter 가 PR #300 으로 registry 등록되고, `trigger-create-multi-provider-ui` plan 으로 GUI 진입점도 활성화됨 (사용자 관점 multi-provider). status `backlog → ready` 전환. 실제 분리 리팩토링 진입은 별 사용자 결정 (`status: ready → in-progress` 시점) — 그 전까지는 단일 NotificationDispatcher 구조 유지 (v1 단일 listener 라 dedup/teardown 정책이 무음).


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

---

## 진입 시점 작업 분할 (2026-05-24 — chat-channel-dispatcher-split-impl-d7c3ea)

### 현황 재평가 (R8 의 spec 본문 vs 실제 코드)

R8 본문은 "v1 의 NotificationDispatcher 가 3 갈래 fan-out (외부 HTTP / Redis pub/sub / In-process EventEmitter) 을 단일 클래스에 담는다" 고 가정. 실제 코드 (`origin/main` 기준 + PR #308) 는 이미 분리된 상태:

- `WebsocketService.executionEvents$` RxJS Subject 가 fan-out source
- `NotificationDispatcher` — 외부 HTTP POST 전담 (별 모듈)
- `SseAdapter` — Redis pub/sub 전담 (별 모듈)
- `ChatChannelDispatcher` (`codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`) — in-process subscription 전담 (별 모듈)

즉 R8 의 "분리 리팩토링" 은 사실상 이미 적용됨. 본 plan 의 실제 작업은 **(a) spec R8 본문을 코드 현실과 정합 갱신** + **(b) per-trigger listener dedup/teardown 정책 적용** + **(c) 본 plan 의 `Phase 1` "별 ChannelDispatcher 클래스 추출" 항목 deprecation** 임.

### Phase A — spec R8 본문 정합화 (catch-up)

| 항목 | 파일 | 상세 |
|---|---|---|
| R8 본문 갱신 | `spec/5-system/15-chat-channel.md` R8 절 | "v1 의 NotificationDispatcher 가 3 갈래 fan-out 을 단일 클래스에 담는다" → "v1 의 fan-out source 는 `WebsocketService.executionEvents$` RxJS Subject. 3 listener (NotificationDispatcher / SseAdapter / ChatChannelDispatcher) 가 별 모듈에 분리되어 있음 — 분리 리팩토링은 이미 완료된 상태." 본 plan 의 작업은 **per-trigger listener dedup/teardown 정책 적용** 으로 재정의 |
| R8 v2 적용 시점 명확화 | 같은 절 | v1 에서도 적용 (provider ≥ 2 충족 + GUI multi-provider 도입). 단 message routing 자체는 module-level handler 안에서 일어나므로 listener key 는 **lifecycle 추적용 + handle() 안전 가드** 로 사용 (DB round-trip 절감 + active listener 미등록 trigger 의 event silent skip) |

### Phase B — per-trigger listener registry 도입 (low-risk)

| 항목 | 파일 | 상세 |
|---|---|---|
| `ChannelListenerRegistry` 신설 | `codebase/backend/src/modules/chat-channel/channel-listener.registry.ts` | `Map<triggerId, { provider: string; registeredAt: Date }>` 단순 in-memory registry. 메서드: `register(triggerId, provider)`, `unregister(triggerId)`, `has(triggerId)`, `get(triggerId)`. 멱등성 — register 가 동일 key 재등록 시 기존 entry overwrite (R8 (a) 정합) |
| `TriggersService.setupChatChannel` 호출 흐름에 register 추가 | `codebase/backend/src/modules/triggers/triggers.service.ts` | setupChatChannel 의 try 블록 success path 에서 `channelListenerRegistry.register(trigger.id, chatChannelCfg.provider)`. 실패 path 는 등록 안 함 (degraded 상태) |
| `TriggersService.remove` 호출 흐름에 unregister | 같은 service | trigger 삭제 시 `channelListenerRegistry.unregister(trigger.id)` (R8 (b) 정합) |
| `ChatChannelDispatcher.handle` 에 listener check 추가 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` | trigger DB 조회 전 `channelListenerRegistry.has(triggerId)` 로 사전 필터링. 미등록 trigger 의 event 는 silent skip (DB round-trip 절감 + 비활성 trigger 안전 가드). 단 hot reload / process restart 후 listener registry 가 빈 상태에서는 fallback — registry 가 비어있으면 DB 조회 기존 흐름 (graceful degradation) |
| `ChatChannelModule.onApplicationBootstrap` 에 활성 trigger 의 listener 미리 등록 | `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` | 모듈 bootstrap 시 DB 에서 `isActive=true AND config->chatChannel IS NOT NULL` 트리거 fetch → 각각 registry.register. process restart 후 registry 가 비어있는 시간 창 해소 |
| Unit test | `channel-listener.registry.spec.ts` + 기존 dispatcher spec 확장 | register/unregister/has/get + 멱등성 + hot reload 시뮬레이션 |

### Phase C — `chat-channel-dispatcher-split.md` plan 의 Phase 1 deprecation 명시

본 plan 본문 (이 파일) 의 "Phase 1 — ChannelDispatcher 클래스 분리" 항목 deprecation 명시. 이미 별 모듈로 분리됨. Phase 2/3 는 본 plan 의 Phase B 작업으로 흡수됨.

### Phase D — TEST + plan complete

lint / unit / build / e2e 모두 통과 + `git mv plan/in-progress/ → plan/complete/`.
