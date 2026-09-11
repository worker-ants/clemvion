---
title: T1·T2 이동을 SoT 에 반영한다 — code 를 glob 으로 · §7 5파일 · 귀속 3곳
status: in-progress
owner: planner
worktree: .claude/worktrees/spec-chat-channel-binder-drift-eb5b89
started: 2026-09-11
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/conventions/secret-store.md
  - spec/conventions/chat-channel-adapter.md
  - spec/data-flow/14-chat-channel.md
  # `--spec` W1 이 반증한 뒤 넓혔다 — T1 이 옮긴 다른 함수의 같은 드리프트가 여기 있다.
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/4-nodes/7-trigger/providers/discord.md
  - spec/4-nodes/7-trigger/providers/telegram.md
---

## 왜 이 턴인가

`#1319`(T1) · `#1320`(T2)가 chat-channel 도메인 규칙을 `TriggersService` 에서 떼어냈다.
그 두 PR 은 **developer 턴이라 `spec/` 을 못 고쳤고**, 낡은 자리를 전부 실측해 트래커에
planner 항목으로 등재했다. 이 턴이 그것을 닫는다.

세 축이다 — **① 게이트 술어(`code:`) · ② 사람이 읽는 열거(§7) · ③ 귀속 표기 3곳.**

---

## ① `15-chat-channel.md` frontmatter `code:` — 명시 경로 → **좁은 glob 3개**

### 실측 — 지금 8/10 이 게이트 밖이다

`code:` 는 `review_guard` 의 spec-linked 술어다. **그 파일에 매칭되지 않으면
`--impl-done` 게이트가 그 변경을 아예 요구하지 않는다.** `modules/triggers/` 의 chat-channel
관련 파일 10개를 **정본 매처(`review_guard._glob_to_regex`)로 직접 컴파일**해 재니:

| 파일 | 현재 |
|---|---|
| `chat-channel-token-rotator.service.ts` · `dto/chat-channel-config.dto.ts` | 매칭 |
| `chat-channel-binder.service.ts`(+spec) · `chat-channel-input-rules.ts`(+spec) · `chat-channel-rejection-messages.const.ts` · `chat-channel-token-rotator.service.spec.ts` · `trigger-callback-url.ts`(+spec) | **미등재 8개** |

즉 **R-CC-21 검증 규칙의 정본**(`chat-channel-input-rules.ts`)과 **secret 쓰기·ref 보존의
정본**(`chat-channel-binder.service.ts`)이 둘 다 게이트 밖에 있다.

### 이 누락은 **세 번 연속** 났다 — 그래서 개별 경로를 더하지 않는다

`#1317`(const 파일) · `#1319`(input-rules) · `#1320`(binder + callback-url) 이 매번 새 파일을
만들고 매번 `code:` 에 안 들어갔다. 원인은 **목록이 명시 경로라 새 파일이 자동으로 들어오지
않는다**는 것이고, 그건 다음 PR 에서도 그대로다. 산문 규율로 세 번 실패했으므로 **술어를 바꾼다.**

### 결정 — **좁은 glob 3개**. 통짜 `triggers/**` 는 쓰지 않는다

```yaml
  - codebase/backend/src/modules/triggers/chat-channel-*.ts
  - codebase/backend/src/modules/triggers/dto/chat-channel-*.dto.ts
  - codebase/backend/src/modules/triggers/trigger-callback-url*.ts
```

**정본 매처로 검증했다**(추정이 아니라 실행):

| 후보 | 매칭 수 | 판정 |
|---|---|---|
| 위 3개 합집합 | **10** = 의도한 집합과 **차집합 0** | **채택** |
| `modules/triggers/**` | **27** — 무관 17개(`notification-secret-rotator` · `web-chat-appearance.dto` · `query-trigger.dto` …)까지 | 기각 |
| (현행 명시 경로 유지) | 2 | 기각 — 네 번째 재발이 예정된다 |

추가 후 재측정: **미등재 0개 · 새로 끌려온 무관 파일 0개.**

**통짜 glob 을 기각한 이유는 스코프다.** `15-chat-channel.md` 의 spec-linked 집합이 넓어지면
`notification-secret-rotator.service.ts` 한 줄만 고쳐도 **chat-channel 스펙 기준
`--impl-done`** 을 요구받는다. 게이트가 무는 범위는 *"그 spec 이 서술하는 표면"* 이어야 한다 —
넓히면 요구가 늘고, 요구가 근거 없이 늘면 사람이 게이트를 우회한다.

**`*` 는 `/` 를 넘지 않는다**(`review_guard._glob_to_regex`: `*`→`[^/]*`, `**`→`.*`).
그래서 `dto/` 하위는 별 줄이 필요하고, 그 경계가 오히려 스코프를 좁게 유지해 준다.
와일드카드는 각 1개 — 가드 상한(6)에 한참 못 미친다.

### 명시 경로를 **지우고** glob 으로 갈음한다 — 역할 분담을 명시

`chat-channel-token-rotator.service.ts` 와 `dto/chat-channel-config.dto.ts` 는 새 glob 이 덮으므로
중복이다. 지운다. 대신 **열거는 §7 이 갖는다**:

| 자리 | 역할 |
|---|---|
| frontmatter `code:` | **기계 술어** — glob. 자동 확장되어 재발하지 않는다 |
| §7 구현 파일 구조 | **사람이 읽는 열거** — 파일마다 무엇을 하는지 한 줄 |

이 분담을 §7 머리말에 적어, 다음 사람이 *"둘 중 어디를 고쳐야 하나"* 를 묻지 않게 한다.

---

## ② §7 구현 파일 구조 — **5파일 누락**

실측: `modules/triggers/` 의 chat-channel 소스 6개 중 **§7 에 있는 것은 1개**뿐이다.
트래커는 *"신규 3파일(T1 1 + T2 2)"* 이라고 적었는데 **낮았다** — `#1317` 의 상수 파일과
`chat-channel-config.dto.ts` 도 처음부터 빠져 있었다(후자는 `code:` 엔 있는데 §7 엔 없어 **두
목록이 서로 어긋나 있었다**).

`triggers/` 블록을 이렇게 고친다:

```
  triggers/
    triggers.service.ts                      # 기존 — chat-channel 은 호출만 한다 (setup/teardown 은 아래 binder, 회전·cleanup 은 자기 메서드)
    triggers.controller.ts                   # C-2: rotateBotToken 엔드포인트 이전 (chat-channel→triggers forwardRef 순환 해소)
    chat-channel-binder.service.ts           # adapter setup/teardown + secret 쓰기·ref 보존 (T2 에서 TriggersService 에서 이전)
    chat-channel-input-rules.ts              # 입력 검증·변환 순수 함수 (R-CC-21 정본. DI 없음 — 의존 0)
    chat-channel-rejection-messages.const.ts # PATCH 금지 필드 목록 + 거부 문구 (두 층의 단일 SoT)
    trigger-callback-url.ts                  # webhook callback URL 조립 순수 함수 (binder·rotateBotToken 공용)
    chat-channel-token-rotator.service.ts    # C-2: chat-channel 에서 이전 — bot token 회전 hourly 워커
    dto/chat-channel-config.dto.ts           # chatChannel 설정 DTO (생성/수정 검증 분리)
    dto/create-trigger.dto.ts                # 기존 — chatChannel 필드 추가
```

**`triggers.service.ts` 행의 주석을 고치는 것이 핵심**이다. 현행은
*"setupChannel / teardownChannel / rotateBotToken 호출 추가"* 인데, 이제 앞의 둘은 **binder 가
정의하고 service 가 호출**하며 회전은 **service 가 직접** 갖는다. 옛 문장도 *"호출"* 이라 거짓은
아니었지만, **정의처가 생겼는데 그 사실이 어디에도 없으면** 다음 사람이 `triggers.service.ts`
에서 `setupChatChannel` 을 찾는다.

---

## ③ 귀속 표기 **7곳** — 호출자/정의처를 갈라 적는다

> ### ⚠️ 첫 판본의 *"3곳"* 은 **틀렸다.** `--spec` 이 반증했다
>
> 나는 **`setupChatChannel` 이라는 문자열 하나**로 `spec/` 을 전수 분류하고 *"드리프트 범위는
> 3곳"* 이라고 단정했다. `--spec` `review/consistency/2026/09/11/20_33_26` W1 이
> **재현 검증으로 반증**했다 — T1 이 옮긴 **다른 함수**
> (`assertInboundSigningPlaintextByProvider`)의 같은 드리프트가 `slack.md`·`discord.md` 에
> 있고, W2 는 **내가 편집하려는 파일 안**(§1.3 표 헤더)에 또 하나가 있다고 짚었다.
>
> **키워드를 하나 더 넣는 것은 처방이 아니다** — 다음 키워드를 모른다. 술어를 바꿨다:
>
> | | 첫 판본 | 고친 판본 |
> |---|---|---|
> | 기준 | 문자열 `setupChatChannel` | **이동한 심볼 집합 전체**(T1 6 + T2 3 = **9개**) |
> | 축 | 1개 | **3개** — ⑴ 심볼 × 클래스/파일 접두 · ⑵ `triggers.service.ts` 지목 × chat-channel 문맥 · ⑶ 편집 대상 파일 **내부** 전수 |
> | 결과 | 3곳 | **7곳** (비대상은 주어 확인으로 갈랐다) |
>
> 이동한 심볼 9개는 **두 머지 커밋에서 확정된 유한 집합**이다(`ba634a4b0` 6개 ·
> `77f4a88e5` 3개, 그중 `buildCallbackUrl` 은 `buildTriggerCallbackUrl` 로 개명).
> *"전수 열거 + 주어 확인"* 으로 가야 0이 되고, 이번엔 그렇게 했다.

`setupChatChannel`·`teardownChatChannel` 은 `TriggersService` private → `ChatChannelBinderService`
public 으로, T1 의 6개 검증 함수는 `chat-channel-input-rules.ts` **module-level 함수**로
이동했다. **규칙의 실질은 불변**이고(같은 시점에 같은 일을 한다) 부정확한 것은 **심볼 경로**뿐이다.

### 대상 7곳

| # | 파일 | 무엇이 낡았나 |
|---|---|---|
| (a) | `spec/conventions/secret-store.md` §2.1 표 | `triggers.service.ts.setupChatChannel` |
| (b) | `spec/conventions/chat-channel-adapter.md` §2.4 | `TriggersService.setupChatChannel` |
| (c) | `spec/data-flow/14-chat-channel.md` §0 목록 | 파일 귀속 |
| (d) | `spec/data-flow/14-chat-channel.md` §1.3 표 헤더 | **`흐름 (triggers.service.ts)`** — (c)만 고치면 **같은 파일이 자기모순** |
| (e) | `spec/4-nodes/7-trigger/providers/slack.md` | `TriggersService.assertInboundSigningPlaintextByProvider` |
| (f) | `spec/4-nodes/7-trigger/providers/discord.md` | 같음 |
| (g) | `spec/4-nodes/7-trigger/providers/telegram.md` | `caller (TriggersService)` — `issuedInboundSigning` 인계 주체 |

### 비대상 — **주어를 확인해 갈랐다**

| 자리 | 왜 참인가 |
|---|---|
| `2-trigger-list.md` · `12-webhook.md` 의 `TriggersService.update()` | `update()` 는 **그대로 있다** |
| `15-chat-channel.md` 의 `TriggersService.remove` | `remove()` 도 그대로 |
| `15-chat-channel.md` 의 `rotateBotToken` 귀속 | **영구 잔류**로 판정된 메서드다 |
| `data-flow/14-chat-channel.md` 의 *"cleanup 로직 `TriggersService` 와 co-location"* | `cleanupRotatedChatChannelTokens` 도 잔류 |
| 접두 없이 함수명만 쓰는 **9곳** | 이동 후에도 참 |

### 편집 내용

**(a)** `spec/conventions/secret-store.md` §2.1 — `triggers.service.ts.setupChatChannel` →
`chat-channel-binder.service.ts` 의 `setupChatChannel`.

**(b)** `spec/conventions/chat-channel-adapter.md` §2.4 `SetupResult` JSDoc — caller 를
**두 겹으로** 적는다: `ChatChannelBinderService.setupChatChannel`(직접 caller) ←
`TriggersService`(생성/수정 경로 진입). 한 겹만 적으면 *"어디서 시작되나"* 를 잃는다.

**(c)** `spec/data-flow/14-chat-channel.md` §0 — 한 줄을 두 줄로 가른다. **경로는 축약하지 않고
전체로 쓴다** — 그 목록의 다른 불릿이 전부 전체 경로이고 축약 선례가 0건이다
(`--spec` W3). 즉 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 와
`codebase/backend/src/modules/triggers/triggers.service.ts` 두 줄이 된다.
`teardownChatChannel` 은 원래 이 목록에 없었으므로 **가르면서 함께 채운다**.

**(d)** 같은 파일 §1.3 표 헤더 `| 단계 | 흐름 (`triggers.service.ts`) | sink |` — 이 표의 첫 행이
*"최초 setup"* 이고 그것이 이제 binder 소유다. 헤더의 파일 한정을 **떼고**(`| 단계 | 흐름 | sink |`)
표 위에 한 줄 각주로 *"최초 setup/teardown 은 `chat-channel-binder.service.ts`, 회전·cleanup 은
`triggers.service.ts`"* 를 적는다. **헤더에 파일명을 박아 두면 행이 늘 때마다 낡는다** — 이번이
그 증거다.

**(e)(f)** `providers/{slack,discord}.md` — `TriggersService.assertInboundSigningPlaintextByProvider`
→ `chat-channel-input-rules.ts` 의 `assertInboundSigningPlaintextByProvider`(`TriggersService` 가
생성 경로에서 호출). **이 두 곳은 트래커에 별 항목으로 등재돼 있던 것**이라 이 턴에 함께 닫는다.

**(g)** `providers/telegram.md` — `caller (TriggersService)` →
`caller (ChatChannelBinderService)`. 같은 클래스의 마지막 자리다.

## 안 하는 것

- **`rotate-bot-token` OpenAPI 데코레이터** — 코드 사안(developer). 트래커 유지.
- **`getAppBaseUrl()` 통합** — 코드 사안(developer), DI 변경이라 별 PR.
- **`triggers.service.ts` 의 `TriggersService:` 로그 리터럴** — 코드 사안(developer).
- **§7 의 `chat-channel/` 블록** — 이번 이동과 무관하다. 건드리지 않는다.

## Rationale (spec 본문에 실을 근거)

`code:` 를 glob 으로 바꾸는 결정의 근거는 **세 번 연속 재발 + 정본 매처 실측**이다. 그 둘을
`15-chat-channel.md` 의 `## Rationale` 에 **`R-CC-22`** 로 남긴다 — 실측상 현재 최대가
`R-CC-21` 이고 **`R-CC-14` 는 결번**이다(재사용하지 않는다). 다음 사람이 *"왜 여기만
glob 인가"*(다른 spec 은 대부분 명시 경로다: 633개 중 528개가 `*` 없음) 를 묻기 때문이다.

**상위 원칙은 이미 있다 — 새로 만들지 않고 인용한다.**
[`spec-impl-evidence.md` R-1](../conventions/spec-impl-evidence.md#r-1-code-글로브-허용-vs-명시-파일만)
이 *"글로브 허용을 채택"* 하면서 **바로 그 절에서** *"넓은 트리 글롭으로 가드만 통과시키는 것은
아무것도 가리키지 않는 것과 같다"* 고 못박고 있다. 즉 **통짜 `triggers/**` 기각도 이 원칙의
집행**이고, `R-CC-22` 는 예외가 아니라 **적용례**다. cross-ref 를 달아 그렇게 읽히게 한다.

R-1 이 경고하는 **stale glob**(없어진 파일을 가리키는 glob 이 다른 파일에 매칭돼 통과) 위험도
함께 적는다 — 좁은 glob 3개는 접두가 구체적이라 그 표면이 작지만, 0은 아니다.

답은 **이 모듈만 파일이 계속 늘어난다**는 것이다. `chat-channel/` 은 이미 `**` 이고,
`triggers/` 안의 chat-channel 부분은 T1·T2 로 3파일이 늘었으며 남은 백로그(binder 내부 분리 ·
secret-ref 공유 헬퍼)도 파일을 더 만든다. **증가가 예정된 집합은 열거가 아니라 술어로 잡는다.**

---

## 편집 대상 **원문** (verbatim, `77f4a88e5` 기준)

> **왜 draft 안에 싣나 — checker 프롬프트에 이 파일들이 안 실린다.** 세션 준비 후
> `_prompts/*.md` 를 실측하니 **네 대상 파일의 본문이 0건**이었다(편집할 문장을 고유 문자열로
> grep). `CONSISTENCY_MAX_CONTEXT_SIZE` 상한 문제가 아니다 — 프롬프트는 16~120KB 로 기본 상한
> 262144 에 한참 못 미친다. **`related_specs` 선택이 이 파일들에 도달하지 못하는 것**이다
> (기존 교훈: *"`--spec` 기본 예산이 conventions 를 통째로 떨군다"*).
>
> 원문을 여기 실으면 **target 문서의 일부로 번들에 들어가** checker 가 *"새 문장이 현행과
> 맞는가"* 를 판정할 수 있다. 부수로 이 draft 가 **무엇을 바꿨는지의 증거**가 된다
> (draft 는 임시 파일이 아니라 `plan/complete/` 로 보존되는 산출물이다).

### ⓐ `spec/conventions/secret-store.md` §2.1 표의 해당 행

```markdown
| Trigger 생성 (notification / chatChannel 설정 포함) | **`rotate(ref, workspaceId, plaintext)` 권장** — UPSERT 멱등성으로 setup 재시도 안전 (§5.5 예시 + `triggers.service.ts.setupChatChannel` 구현체 모두 `rotate()` 사용). `store()` 도 동일 결과를 내지만, 동일 ref 가 이미 있을 때 `store()` 의 동작 (덮어쓰기 vs throw) 은 backend 구현 변경에 취약 — `rotate()` 의 명시적 UPSERT 시맨틱이 안전 |
```

### ⓑ `spec/conventions/chat-channel-adapter.md` §2.4 `SetupResult` JSDoc

```markdown
  /**
   * setupChannel 직후 1회만 노출되는 inbound-signing 자료의 plaintext (server-issued 한정 — 현재
   * v1 에서는 Telegram 만 `setWebhook.secret_token` 을 어댑터가 `randomBytes` 로 발급). caller
   * (`TriggersService.setupChatChannel`) 가 즉시 `SecretResolver.rotate(secret://triggers/{id}/inbound-signing, ...)`
   * 로 보관 후 ref 를 config 의 `inboundSigningRef` 에 set 한다. plaintext 가 config 에
   * 흘러들어가지 않도록 분리 — SS-SE-01 정책 적용.
   *
```

### ⓒ `spec/data-flow/14-chat-channel.md` §0 구현 파일 목록

```markdown
- `codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` (inbound 전체 오케스트레이션)
- `codebase/backend/src/modules/chat-channel/channel-conversation.service.ts` — Redis ConversationState CRUD + form-submit lock
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — outbound subscription (`WebsocketService.executionEvents$`)
- `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` — `chat-channel-token-rotator` 큐 (매시간 cleanup; C-2 로 triggers 모듈로 이전 — cleanup 로직 `TriggersService` 와 co-location)
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `setupChatChannel` / `rotateBotToken` / `cleanupRotatedChatChannelTokens`
- `codebase/backend/src/modules/web-chat-cors/web-chat-cors-origin.resolver.ts` + `codebase/backend/src/modules/hooks/embed-config.service.ts` — web-chat 경로 (§1.4)
```

### ⓓ `spec/5-system/15-chat-channel.md` frontmatter `code:` (현행 14줄)

```yaml
code:
  - codebase/backend/src/modules/chat-channel/**
  - codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts
  - codebase/backend/src/modules/triggers/triggers.service.ts
  - codebase/backend/src/modules/triggers/triggers.controller.ts
  - codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts
  - codebase/backend/src/modules/hooks/hooks.service.ts
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/test/chat-channel-slack.e2e-spec.ts
  - codebase/backend/test/chat-channel-discord.e2e-spec.ts
  - codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts
  - codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx
  - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
  - codebase/frontend/src/lib/i18n/dict/ko/triggers.ts
  - codebase/frontend/src/lib/i18n/dict/en/triggers.ts
pending_plans:
```

### ⓔ `spec/5-system/15-chat-channel.md` §7 전문

```markdown
## 7. 구현 파일 구조

```
codebase/backend/src/modules/
  chat-channel/
    chat-channel.module.ts
    channel-adapter.registry.ts            # provider 문자열 ↔ adapter 인스턴스
    channel-listener.registry.ts           # per-trigger listener dedup/teardown (R8 ChannelListenerRegistry)
    chat-channel.dispatcher.ts             # WebsocketService.executionEvents$ 직접 subscribe (NotificationDispatcher·SseAdapter 와 형제 listener)
    chat-channel-inbound-authenticator.ts  # provider 별 inbound 서명/secret_token 검증
    channel-conversation.service.ts        # Redis ChannelConversation CRUD
    types.ts
    shared/
      execution-failure-classifier.ts       # CCH-ERR-* 분류 (Convention §3.1)
      form-mode.ts                           # CCH-MP-03 formMode 분기
      language-hint-defaults.ts              # §4.1.1 KO/EN default 문구
    providers/
      telegram/  ( telegram.adapter.ts · telegram-client.ts · telegram-update.parser.ts · telegram-message.renderer.ts )
      slack/     ( slack.adapter.ts · slack-client.ts · slack-update.parser.ts · slack-message.renderer.ts · slack-signing.ts · slack.types.ts )
      discord/   ( discord.adapter.ts · discord-client.ts · discord-update.parser.ts · discord-message.renderer.ts · discord-signing.ts · discord.types.ts )
  hooks/
    hooks.controller.ts                    # 기존 — config.chatChannel 분기 추가
    hooks.service.ts                       # 기존 — adapter dispatch 추가
  triggers/
    triggers.service.ts                    # 기존 — setupChannel / teardownChannel / rotateBotToken 호출 추가
    triggers.controller.ts                 # C-2: rotateBotToken 엔드포인트 이전 (chat-channel→triggers forwardRef 순환 해소)
    chat-channel-token-rotator.service.ts  # C-2: chat-channel 에서 이전 — bot token 회전 hourly 워커
    dto/create-trigger.dto.ts              # 기존 — chatChannel 필드 추가
```

> v1 supported provider 는 `telegram` / `slack` / `discord` 3종 (각 provider 디렉토리에 adapter·client·parser·renderer 구현). Slack/Discord 는 signing 검증 모듈 (`*-signing.ts`) 을 추가로 가진다.

`chat-channel/` 모듈은 [`external-interaction/`](./14-external-interaction-api.md#10-구현-파일-구조) 모듈과 동등한 facade 계층에 위치한다 — 둘 다 엔진 외부.

---
```

### ⓕ `spec/data-flow/14-chat-channel.md` §1.3 표 헤더 주변 (편집 (d))

```markdown
plaintext bot token 은 DB `trigger.config` 에 저장되지 않고 secret store ref 로만 참조된다
(SS-SE-01 — [Convention Secret Store](../conventions/secret-store.md)).

| 단계 | 흐름 (`triggers.service.ts`) | sink |
| --- | --- | --- |
| 최초 setup (**생성 `POST /api/triggers` 한정**) | `setupChatChannel`: plaintext (`botToken`, provider-issued `inboundSigningPlaintext`) → secret store UPSERT → `adapter.setupChannel(config, callbackUrl)` (Telegram 은 server-issued `issuedInboundSigning` 을 돌려줘 추가 저장) → config 에 `botTokenRef`/`inboundSigningRef`/`botIdentity` 머지 | `secret_store` rows + UPDATE `trigger.config`, `chat_channel_setup_at`, `chat_channel_health='healthy'` + listener registry register |
| **`chatChannel` 이 실린 PATCH** | `setupChannel()` 재호출로 provider 등록만 갱신. **사용자가 보낸 비밀을 secret store 에 쓰지 않는다** — bot token 과 slack/discord inbound signing 값은 요청 전후로 동일하다. **telegram 은 예외다**: `setupChannel()` 이 Telegram 에 새 `secret_token` 을 등록하므로 `inboundSigningRef` 가 **매번 갱신된다**(건너뛰면 인입 401). `botTokenRef`/`inboundSigningRef` 는 config 에서 보존되는 것이 아니라 trigger id 에서 **재유도**된다(`buildSecretRef`). SoT: [Chat Channel §5.4.1 · R-CC-21](../5-system/15-chat-channel.md#r-cc-21-patch-는-비밀을-쓰지-않는다--차단이-필드명-층에만-걸려-있었다) | UPDATE `trigger.config`, `chat_channel_setup_at`, health — **`secret_store` 는 bot token·slack/discord signing 축 무변경. telegram 은 `inbound-signing` row 가 갱신된다** |
| **PATCH 가 거부하는 세 경우** | ① 비밀 필드(`botToken`·`inboundSigningPlaintext`)를 실었다 ② `chatChannel` 이 없는 트리거에 **사후 부착**을 시도했다 ③ `provider` 를 바꾸려 했다 — 셋 다 400 `VALIDATION_ERROR` 로 **아무 것도 쓰지 않고 끝난다**. SoT: [Chat Channel §5.4.1 · §5.4.1.2](../5-system/15-chat-channel.md#5412-chatchannel-필드-존재성--provider-불변성) | **무변경** (DB·secret store 둘 다) |
```

### ⓖ `spec/4-nodes/7-trigger/providers/slack.md` 해당 행 (편집 (e))

```markdown
  - **형식 (Slack 발급 표준)**: `^[a-f0-9]{32}$` (lowercase hex 32 chars). Backend 의 `TriggersService.assertInboundSigningPlaintextByProvider` 가 trigger 생성 시점에 정규식 검증 — 위반 시 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`, `details.code='INVALID_FIELD'`). uppercase hex 는 외부 Slack HMAC 검증 실패를 유발하므로 사전 차단.
```

### ⓗ `spec/4-nodes/7-trigger/providers/discord.md` 해당 행 (편집 (f))

```markdown
  - **형식 (Discord 발급 표준)**: `^[a-f0-9]{64}$` (lowercase hex 64 chars, ed25519 public key 32 bytes). Backend 의 `TriggersService.assertInboundSigningPlaintextByProvider` 가 trigger 생성 시점에 정규식 검증 — 위반 시 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`, `details.code='INVALID_FIELD'`). uppercase hex 는 외부 Discord ed25519 verify 실패 회피를 위해 사전 차단.
```

### ⓘ `spec/4-nodes/7-trigger/providers/telegram.md` 해당 행 (편집 (g))

```markdown
  "secret_token": "{randomly_generated}",   // 32 chars [A-Za-z0-9_-]. plaintext 는 SetupResult.issuedInboundSigning 로 1회만 노출 → caller (TriggersService) 가 SecretResolver.rotate(secret://triggers/{id}/inbound-signing, ...) 로 보관 후 ref 만 config.chatChannel.inboundSigningRef 에 set
```

## 체크리스트

- [x] `/consistency-check --spec` 1회 (`20_33_26`) **BLOCK: NO** · CRITICAL 0 · WARNING 3 —
      **W1 이 내 "3곳" 완결성 주장을 반증**했다. 3축 전수로 다시 재어 **7곳**으로 넓혔고
      W2(§1.3 헤더) · W3(경로 축약) · INFO 2·3·4·5·7 도 반영했다
- [ ] `/consistency-check --spec` **재실행** — draft 가 3파일 늘었으므로 checker 가 안 본
      대상이 생겼다. 넓힌 스코프로 BLOCK: NO 를 다시 받는다
- [ ] ① `code:` — glob 3줄 추가 + 중복 명시 2줄 제거, 추가 후 **정본 매처로 재측정**
- [ ] ② §7 — 5파일 추가 + `triggers.service.ts` 주석 정정 + 두 목록의 역할 분담 머리말
- [ ] ③ 귀속 **7곳** (a)~(g)
- [ ] `## Rationale` `R-CC-22` + `spec-impl-evidence.md` R-1 cross-ref
- [ ] **반영 후 3축 스캔 재실행해 잔여 0 확인** (*"해소" 를 쓰기 전에 grep 으로 0을 보인다*)
- [ ] 트래커 항목 **3건** 종결 (`code:` 등재 · `setupChatChannel` 귀속 · `slack`/`discord` 귀속)
      + co-located 항목에 해소 주석 (`--spec` INFO 5)
- [ ] `plan/complete/` 이동
