---
title: "chatChannel PATCH 가 bot token single-path 를 우회한다 — 차단 대상을 값 필드로 넓히고 PATCH 의 토큰 쓰기를 끊는다"
worktree: spec-chat-channel-patch-token-8d3f52
started: 2026-09-10
owner: planner
status: in-progress
priority: P1
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/2-navigation/2-trigger-list.md
---

# chatChannel PATCH 의 bot token 우회 (planner 턴)

출처: `spec-draft-nullable-notation-followups.md` 의 **CRITICAL** 항목 두 개 —
「chatChannel PATCH 가 bot token single-path 를 우회한다」 · 「`ChatChannelCard` 편집-저장이 항상 400」.
`#1308` 의 `/ai-review` 에서 `api_contract` 가 판정했고 `security`·`requirement` 가 독립 확인했다.

## 등재된 처방이 그대로면 **토큰을 파괴한다** — 이 턴의 핵심

두 reviewer 가 준 처방은 *"PATCH 전용 `ChatChannelConfigDto` 변형(`botToken` 제외)"* 이었다.
**그것만 하면 지금보다 나빠진다.** 실측한 호출 사슬:

| 단계 | 코드 | 관측 |
|---|---|---|
| 1 | `update()` — 바디에 `chatChannel` 이 있으면 **무조건** `setupChatChannel(saved, chatChannel)` | `triggers.service.ts:539` |
| 2 | `setupChatChannel` — `botTokenRef` 를 **trigger id 에서 결정적으로 재유도** | `buildSecretRef({scope:'triggers', resourceId: trigger.id, name:'bot-token'})` |
| 3 | 그 다음 줄에서 **무조건** `await this.secrets.rotate(botTokenRef, ws, chatChannelCfg.botToken ?? '')` | 조건 없음 |
| 4 | `SecretResolver.rotate` 는 **빈 문자열 가드가 없다** — 받은 값을 그대로 암호화해 row 를 덮어쓴다 | `secret-resolver.service.ts:129-145` |

즉 `botToken` 을 DTO 에서 빼기만 하면 모든 chatChannel PATCH 가 `rotate(ref, ws, '')` 를 태워
**저장된 봇 토큰을 빈 값으로 파괴**하고, 이어지는 `adapter.setupChannel` 이 빈 토큰으로 401 을 받아
`chatChannelHealth=degraded` 로 조용히 앉는다.

> **오늘 그 일이 안 일어나는 유일한 이유가 그 버그다.** `ChatChannelConfigDto.botToken` 이 **필수**라
> 요청이 서비스에 닿기 전에 400 이 난다 — *"`ChatChannelCard` 저장이 항상 400"* 이라는 **버그가
> 지금 토큰을 지키고 있다.** 순진하게 고치면 **보이는 실패가 조용히 비밀을 지우는 실패로 바뀐다.**
>
> 등재 당시 처방의 전제가 한 층 얕았다 — 두 reviewer 다 DTO 층까지만 보고 `setupChatChannel` 의
> 무조건 `rotate` 를 안 봤다. 이 저장소가 아는 형태다: **반증된 전제는 더 큰 결함의 덮개다.**

## 착수 전 재판정 (`origin/main` = `d93e8511d`)

| 잰 것 | 값 |
|---|---|
| PATCH 로 `chatChannel` 을 보내는 프런트 호출자 | **1곳** — `chat-channel-card.tsx:366`. `botToken` 을 **생략**한다(그래서 항상 400) |
| `page.tsx` 의 `chatChannel` 부착 | **생성(POST)** 경로다(`CreateTriggerDto`) — PATCH 아님 |
| `setupChatChannel` 호출부 | **2곳** — `create()`(`:442`) · `update()`(`:539`) |
| `secrets.rotate` 의 빈 값 가드 | **없음**(`:129-145`) |
| 전역 ValidationPipe | `whitelist: true, forbidNonWhitelisted: true` — DTO 밖 키는 자동 400 |

**깨질 정상 호출자가 0 이다** — 오늘 성공하는 chatChannel PATCH 자체가 없다. 그래서 *"present 면
400"* 을 택해도 호환성 비용이 없다.

## 결정

### D-1. PATCH 의 `chatChannel` 은 `botToken` 을 **받지 않는다** (present 면 400)

대안이었던 *"optional 로 두고 조용히 무시"* 는 기각한다 — 사용자가 설정했다고 믿은 **비밀을 말없이
버리는** 형태이고, 이 문서가 이미 형제 세 필드(`botTokenRef` · `inboundSigningPlaintext` ·
`inboundSigning`)를 전부 400 으로 막고 있어 그 관례와도 어긋난다.

**에러 형태는 `details.field='chatChannel.botToken'`(중첩 경로)이다.**
[`3-error-handling.md:270`](../5-system/3-error-handling.md) 가 *"`details[].field` 는 중첩/배열
경로를 `nodes[3].type` 형식으로 유지한다"* 로 규정하고, DTO 화이트리스트가 내는 형태가 그것이다.

> **형제 세 필드가 규약에서 이탈해 있다** — §5.4.1 이 `details.field='botTokenRef'`(접두어 없음)로
> 적는데, 그것은 서비스 가드(`assertChatChannelInputSafe`)가 리터럴을 던지기 때문이다. **새 항목을
> 그 이탈에 맞추지 않는다** — 규약을 따르고, 형제들의 정정은 별 후속으로 등재한다(기존 클라이언트의
> 에러 파싱을 건드리는 변경이라 이 턴에 섞지 않는다).

### D-2. PATCH 경로는 **봇 토큰을 쓰지 않는다** — 이것이 실제로 CRITICAL 을 닫는다

D-1 만으로는 부족하다(위 표 3~4행). **토큰을 secret store 에 쓰는 단계는 생성(POST)과 rotate
엔드포인트에만 속한다.** PATCH 가 타는 `setupChatChannel` 은 `secrets.rotate(botTokenRef, …)` 를
**건너뛰고**, 저장된 secret 을 그대로 둔 채 `setupChannel` 재호출·config 갱신만 한다.

이것이 §5.4.1 표 2행(*"트리거 활성화 PATCH — 기존 `botTokenRef` 그대로 사용, token 변경 없음"*)이
이미 선언한 동작이다. **그 선언이 `{isActive}` PATCH 에만 적용되는 것처럼 좁게 읽혀 왔고, 구현은
`chatChannel` 이 실린 PATCH 에서 그것을 어겼다.**

### D-3. `botTokenRef` 는 **보존이 아니라 재유도**로 살아남는다 — 그렇게 적는다

`mergeExternalConfig` 는 `next.chatChannel = chatChannel` 로 **객체를 통째로 교체**하므로 들어오지
않은 `botTokenRef` 는 그 시점에 사라진다. 그런데 `setupChatChannel` 이 trigger id 에서 ref 를
**결정적으로 재유도**해 다시 써 넣어 결과적으로 동일해진다.

읽는 사람이 *"머지가 보존해 준다"* 로 오해하지 않도록 **재유도라고 명시**한다 — 그 차이는 실제로
중요하다: ref 를 config 에서 읽는 구조로 바뀌는 순간 이 경로는 조용히 깨진다.

## 변경안

### A. `15-chat-channel.md §5.4.1` 표 — 차단 대상을 값 필드까지 넓힌다

3행의 차단 서술이 `botTokenRef` **필드명 하나**만 가리키고 있어, 값을 나르는 `botToken` 이 열려
있었다. 3행을 고치고 `chatChannel` 이 실린 PATCH 를 별 행으로 세운다.

| 시점 | 메커니즘 | 비고 |
|---|---|---|
| 토큰 변경 (rotation) | **항상 rotate 엔드포인트만.** PATCH body 의 `config.chatChannel.botTokenRef`(ref) **와 `botToken`(plaintext) 둘 다** 400 — 전자는 `details.field='botTokenRef'`, 후자는 `details.field='chatChannel.botToken'` | 24h grace 적용 |
| **`chatChannel` 이 실린 PATCH** (uiMapping · rateLimit 등 편집) | `setupChannel()` 재호출로 provider 등록만 갱신. **`secrets.rotate(botTokenRef, …)` 를 호출하지 않는다** — 저장된 토큰은 손대지 않는다. `botTokenRef` 는 trigger id 에서 재유도된다(보존이 아님) | **token 변경 없음** |

### B. `15-chat-channel.md §5.4.1` 정당화 문단 — 왜 필드명이 아니라 값이 기준인가

종전 정당화 (a)(b)(c) 는 그대로 두고, **차단의 기준이 필드명이 아니라 "토큰 값이 바뀌는가" 임을**
한 문단 추가한다. 그것이 이번에 드러난 갭의 정확한 형태다 — 정책이 **강제되는 층**(필드명)과 정책이
**보호하려는 대상**(값 교체)이 다른 층에 있었다.

### C. `15-chat-channel.md` 신설 Rationale `R-CC-17` — 우회의 형태와 처방의 함정

R-CC-10 은 *결정*(single-path)을 갖고 있으므로 그대로 두고, **그 결정이 어떻게 우회됐고 왜 순진한
처방이 더 나쁜지**를 새 항목으로 남긴다. 담을 것:

1. 우회의 형태 — 강제되는 층(필드명)과 보호 대상(값 교체)이 갈렸다.
2. **처방의 함정** — `botToken` 을 DTO 에서 빼기만 하면 `secrets.rotate(…, '')` 가 토큰을 파괴한다.
   *"항상 400" 버그가 토큰을 지키고 있었다*는 사실을 그대로 적는다.
3. 기각한 대안 — optional + 조용히 무시(비밀을 말없이 버린다) · `details.field` 를 형제들의 이탈
   형태에 맞추기(규약을 따르고 형제 정정은 별 후속).

### D. `2-trigger-list.md §3` PATCH 본문 서술

현재 *"`chatChannel.botTokenRef` 는 PATCH 로 변경 불가"* 만 적혀 있다. **`botToken` 도 같은 자리에**
적고, `chatChannel` 이 실린 PATCH 가 **토큰을 건드리지 않는다**는 것과 `botTokenRef` 가 재유도된다는
것을 한 문장으로 덧붙인다. `각 키는 명시되면 해당 객체를 통째로 교체` 라는 기존 서술이 `botTokenRef`
소멸을 함의하므로 그 오해를 여기서 닫는다.

## Rationale (이 draft 의 결정 근거)

### 왜 planner 턴이 먼저인가

처방에 **택일**이 셋 있었고(400 vs 무시 · 에러 field 형태 · rotate 를 끊을지) 셋 다 계약·보안
결정이다. developer 가 구현하며 고를 일이 아니다. 특히 D-2 는 **등재된 처방이 놓친 것**이라 spec 이
먼저 그것을 요구하지 않으면 구현이 원 처방대로 가서 토큰을 파괴한다.

### 이 turn 에서 하지 않는 것

- **구현** — DTO 분리·`setupChatChannel` 분기는 developer 턴.
- **형제 세 필드의 `details.field` 규약 이탈 정정** — 기존 에러 페이로드를 바꾸는 변경이라 별 항목.
- **`ChatChannelCard` 프런트 수정** — D-1·D-2 가 반영되면 그 카드는 **지금 코드 그대로 통과**한다
  (이미 `botToken` 을 생략한다). 프런트 변경이 필요 없다는 것이 이 처방의 장점이라 그대로 둔다.
- **`secrets.rotate` 에 빈 값 가드 추가** — 이 경로는 D-2 로 닫히지만, `rotate` 자체가 빈 문자열을
  받아 비밀을 지우는 것은 **다른 호출부에도 열려 있는 표면**이다. 별 후속으로 등재한다.
