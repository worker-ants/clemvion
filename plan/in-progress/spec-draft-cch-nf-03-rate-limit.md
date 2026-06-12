---
worktree: chat-channel-rate-limit-baa15a
started: 2026-06-12
owner: planner
---

# spec-draft: CCH-NF-03 rate-limit 메커니즘 명확화

> 대상 spec: `spec/5-system/15-chat-channel.md` (§3.6 CCH-NF-03, §5.5 inbound 계약, §4.1 config, Rationale)
> 배경: 현 CCH-NF-03 문구 "초과분은 어댑터의 chat 단위 큐에 적재, 폭주 시 가장 오래된 update 부터 폐기하지 않고 degraded" 가 (a) WH-NF-01 200ms 응답 시한, (b) Rationale R9(lifecycle 큐 기각: input-sequence 충돌·dedup·TTL·순서)와 충돌해 **구현 불가/모순**. v1 구현 가능 정책으로 refine.

## 결정 (v1 정책)

채널(chat)당 분당 inbound 한도를 **per-chat Redis fixed-window 카운터**로 enforcement한다.

- **한도**: 기본 60건/분, `config.chatChannel.rateLimitPerMinute` (1–600) override.
- **저장**: Redis fixed-window (key = `trigger.id` + `conversationKey` + 분 버킷). 기존 `PublicWebhookQuotaService.incrWithWindow` 패턴 재사용 (INCR + EXPIRE pipeline). Redis 미가용 시 **fail-open**(rate-limit 미적용, 정상 처리) — 가용성 우선, 기존 throttle 동형.
- **초과 시 동작**: 해당 update 를 **버퍼링/재발사하지 않고 처리 생략** → `202 Accepted` + `{ executionId: 'ignored' }` (telegram-safe 2xx, non-2xx 시 provider webhook 자동 비활성화·retry 폭주 회피 — R-CC-12) + `chat_channel_health=degraded` 갱신 (`ChatChannelDispatcher.markDegraded` 동형 경로).
- **enforcement 위치**: `HooksService.handleChatChannelWebhook` 의 `parseUpdate` 직후(conversationKey 확정 후) — execution 시작/forwarding 분기 이전. group/bot/unsupported skip 과 동일 계층.
- **degraded 의미 정합**: CCH-SE-01 의 "어댑터 외부 API 호출 실패 → degraded" 와 별개의 degraded 트리거(외부 사용자 폭주 방어 신호)이나, 두 경우 모두 "채널 동작이 정상 범위를 벗어남"을 운영자에게 알리는 동일 health 자원. 자동 비활성화 금지(CCH-SE-01 정책 그대로).

## "큐 적재 → 재발사" 미채택 이유 (Rationale 본문화)

> **R9 인용 정정(W-4)**: R9 는 rate-limit 큐를 *기각하지 않았다* — R9 는 lifecycle 케이스(running 중 사용자 메시지)와 rate-limit 케이스(분당 60건 초과)를 **다른 트리거 조건**으로 분리했을 뿐이다. 본 결정은 그 rate-limit 케이스 *내부*에서 큐 vs skip 을 추가로 정하는 **독립 사안**이다.

skip 채택의 독립 근거: (1) **WH-NF-01 200ms** 응답 시한상 inbound 를 동기적으로 버퍼링·보류할 수 없다(텔레그램 webhook 응답 지연 시 retry 폭주). (2) replay 버퍼는 input-sequence 가정 충돌·dedup 책임·TTL/순서 정렬 등 추가 메커니즘을 v1 에 도입하는데, 그 한계 분석 자체는 R9 가 lifecycle 맥락에서 이미 정리했고 rate-limit 맥락에도 동일하게 성립한다(직교 사안이나 동일 trade-off). 따라서 v1 = **초과분 처리 생략(skip) + degraded 표시**. 사용자 mental model("처리량을 넘기면 잠시 후 다시")과 정합.

## 변경 surface

### 1. §3.6 CCH-NF-03 (요구사항 문구)
"초과분은 chat 단위 큐에 적재 … 폐기하지 않고 degraded" → "초과분은 버퍼링/재발사 없이 처리 생략(202 ignored) + chat_channel_health=degraded. per-chat Redis fixed-window(기본 60/분, rateLimitPerMinute override). Redis 미가용 시 fail-open." + 구현 상태 주석(미구현 Planned 유지 — 구현은 후속 PR).

### 2. §5.5 inbound 계약 표 (신규 행)
`분당 rate-limit 초과 (per-chat)` | `202 Accepted` | `{ executionId: 'ignored' }` | fixed-window 카운트 초과 시 처리 생략 + `chat_channel_health=degraded` (버퍼링 없음, CCH-NF-03). 안내 메시지 발송은 v1 범위 밖(선택).

### 3. §4.1 config (rateLimitPerMinute)
주석에 "기본 60, 1–600, per-chat 분당 한도" 명확화 (이미 `// CCH-NF-03 override` 존재 — 범위·기본값 보강).

### 4. Rationale R-CC-19 신설
위 "큐 미채택" 근거 + fixed-window/Redis 선택(멀티 인스턴스 정확성, PublicWebhookQuotaService 재사용) + R9 와의 직교성(외부 폭주 방어 vs execution lifecycle 정합).

## plan 정합
- `spec-sync-chat-channel-gaps.md` #3 항목: 메커니즘 확정 반영(문구 갱신), 구현은 여전히 `[ ]`(후속 PR). spec 확정 ↔ 구현 분리 명시.

## Rationale (본 draft 결정 근거)
- replay 큐 대신 skip+degraded: WH-NF-01·R9 정합(위). v1 단순성.
- Redis fixed-window(sliding 아님): 기존 PublicWebhookQuotaService 동형 — 일관성·재사용. 분 버킷 경계 burst 허용은 rate-limit 표준 trade-off(허용).
- fail-open(Redis 부재 시): 가용성 우선. rate-limit 은 방어적 기능이라 부재 시 차단보다 통과가 안전(기존 throttle 동일 정책).
