---
title: setupChannel 실패 분류를 transport 에서 원인으로 — 502 가 클라이언트 고칠 수 있는 오류를 덮는다
status: in-progress
owner: planner
worktree: .claude/worktrees/spec-setup-error-classification-5e5a82
started: 2026-09-12
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/conventions/chat-channel-adapter.md
---

## 왜 이 턴인가 — developer 항목이라고 등재했는데 **spec 결함이었다**

트래커에 *"`translateSetupChannelError` 가 discord verify_key 불일치를 502 로 떨어뜨린다 —
의도는 400"* 을 **developer 항목**으로 올려 뒀다. 착수해서 읽어 보니 **코드가 spec 을 정확히
구현하고 있었다.** §5.4 에러 표가 그렇게 적고 있다:

| HTTP | error.code | 사유 (현행 spec) |
|---|---|---|
| 400 | `BOT_TOKEN_INVALID` | 신규 토큰으로 `setupChannel` (`getMe`/`setWebhook`) **401/403** |
| 502 | `CHAT_CHANNEL_SETUP_FAILED` | `setupChannel` API 호출 실패 (재시도 후에도 실패) |

즉 판별식 `/\b(401|403)\b/` 은 **spec 문면 그대로**다. 내가 *"의도는 400"* 이라고 쓴 근거는
spec 이 아니라 **adapter 주석**(`discord.adapter.ts`: *"불일치면 BOT_TOKEN_INVALID"*)이었다 —
**주석과 spec 이 서로 어긋나 있었고**, 나는 둘 중 주석만 보고 코드 결함이라 판정했다.

HTTP 코드를 바꾸는 것은 **API 계약**이므로 자기-반증형 소정정 조건 2가 명시적으로 배제한다.
→ planner 턴. (트래커 항목은 developer → planner 로 재분류한다.)

## 실측 — spec 의 술어가 **2/3 provider 에서 구현 불가능**하다

`setupChannel` 경로가 던지는 message 의 꼬리를 전수로 셌다. 꼬리는 status 가 아니라
**provider 자신의 error 문자열**이다:

| provider | 자격 증명 거부를 알리는 방식 | message 예 | `/\b(401\|403)\b/` |
|---|---|---|---|
| **Slack** | **HTTP 200** + `{ok:false, error:'invalid_auth'}` — Slack Web API 의 문서화된 스타일 | `Slack auth.test failed: invalid_auth` | **안 걸림 → 502** |
| **Discord** | `verify_key` 불일치 — 응답은 200, **status 자체가 없다** | `BOT_TOKEN_INVALID: Discord verify_key 가 …` | **안 걸림 → 502** |
| **Telegram** | client 가 `HTTP ${status}` 를 문자열에 싣는다 | `Telegram setWebhook failed: … HTTP 401 …` | 걸림 → 400 |

> Slack 의 그 동작은 추측이 아니다 — `slack-client.ts` 자신이 주석으로 적고 있다:
> *"2xx — Slack Web API 는 200 OK 에도 `{ ok: false, error }` 형식 반환 가능."*

**그래서 결함은 트래커가 적은 discord 한 건보다 크다.** rotate 엔드포인트의 **가장 흔한 실패**
— 잘못된 토큰을 넣는 것 — 이 Slack 에서 **502** 로 나간다.

## 왜 그게 틀린 분류인가 — 502 는 "당신이 할 수 있는 게 없다" 는 뜻이다

`502 Bad Gateway` 는 **상류가 고장났다**는 신호다. 클라이언트가 할 수 있는 일은 재시도뿐이다.
그런데 *"토큰이 잘못됐다"* 는 **클라이언트가 입력을 고쳐 해결할 수 있는** 오류다. 502 를 주면
사용자는 **토큰이 문제라는 것을 알 수 없고**, 재시도만 반복한다.

판별 원칙은 transport 가 아니라 **누가 고칠 수 있는가**다 —
[`3-error-handling.md`](../../spec/5-system/3-error-handling.md) 의 4xx/5xx 경계가 그것이다.

## 결정 — 분류 기준을 **원인**으로 바꾸고, 판별을 **adapter 가 선언**하게 한다

### (1) `15-chat-channel.md §5.4` 에러 표 두 행

| HTTP | error.code | 새 사유 |
|---|---|---|
| 400 | `BOT_TOKEN_INVALID` | `setupChannel` 이 **자격 증명 거부**로 실패 — provider 가 그것을 401/403 · `{ok:false, error:'invalid_auth'}` · `verify_key` 불일치 중 무엇으로 알리든 **같은 분류**다. 신호 방식은 transport 세부이고 분류 기준이 아니다 |
| 502 | `CHAT_CHANNEL_SETUP_FAILED` | 그 밖의 실패 — 5xx · 네트워크 · 타임아웃 등 **클라이언트가 입력으로 고칠 수 없는** 것 |

### (2) `chat-channel-adapter.md` — adapter 가 사유를 **선언**한다 (신규 §1.1.2)

현행 spec 이 *"401/403"* 이라 적어 놓아서 구현이 **문자열에서 숫자를 찾는** 모양이 됐다.
그 구조가 이 결함의 원인이다 — provider 가 숫자를 안 주면 영원히 못 잡고, **다음 provider 에서
같은 일이 난다.** 그래서 술어를 호출자의 추측에서 **adapter 의 선언**으로 옮긴다:

> `setupChannel` 이 **자격 증명 거부**로 실패하면 던지는 `Error` 의 message 를
> **`BOT_TOKEN_INVALID:` 로 시작**한다. 그 밖의 실패는 접두를 붙이지 않는다.

**이것은 새 관례가 아니라 기존 관례의 승격이다** — `discord.adapter.ts` 가 **이미** 그 접두로
던지고 있다. 규칙이 없어서 나머지 둘이 따르지 않았을 뿐이다. (`#1316` 에서 같은 패턴으로
`details.code` 를 승격했다.)

호출자(`translateSetupChannelError`)는 **접두를 먼저** 보고, 없으면 401/403 fallback 을 유지한다
— fallback 을 지우지 않는 이유는 telegram 이 그 경로로 이미 옳게 동작하고, 아직 접두를 안 붙인
provider·미래 provider 에 대해 **fail-safe** 로 남기 때문이다.

## 구현 위임 (이 턴 밖 — developer 후속)

1. `chat-channel-input-rules.ts` 의 `translateSetupChannelError` — 접두 우선 판별 추가.
2. `slack.adapter.ts` — `auth.test` 실패에 접두. **단 `ratelimited` 류는 제외**해야 한다
   (자격 증명 문제가 아니다) → 어느 `result.error` 값이 자격 증명 거부인지 developer 가 실측해
   열거할 것. Slack 문서상 `invalid_auth` · `not_authed` · `account_inactive` ·
   `token_revoked` · `token_expired` 가 그 축이다.
3. `discord.adapter.ts` — `getApplicationMe` 실패도 접두 대상인지 판정(4xx 이면 그렇다).
   verify_key 불일치는 **이미** 접두가 있다.
4. **캐너리를 뒤집는다** — `chat-channel-input-rules.spec.ts` 의 *"discord verify_key → 502"*
   테스트가 이 변경으로 RED 가 되는 것이 **의도**다. 그 자리에 *"→ 400"* 단언과 **Slack
   `invalid_auth` → 400** 단언을 넣는다(후자가 이 PR 의 실질 동기다).
5. `providers/{slack,discord,telegram}.md` 의 §3.1 에 그 provider 의 자격 증명 거부 신호 방식을
   한 줄씩 적을지 판단 — spec 표가 *"무엇으로 알리든"* 이라 적으므로 **필수는 아니다**.

## 안 하는 것

- **`translateSetupChannelError` 의 파일 위치** — `chat-channel-input-rules.ts`(입력 규칙)에
  출력측 변환이 섞여 있다는 지적은 별 트래커 항목이다. 이 턴은 **분류 기준**만 다룬다.
- **`setupChatChannel`(생성/PATCH 경로)의 degraded 저장** — 그쪽은 코드화된 에러를 던지지 않고
  `chatChannelHealth='degraded'` + `chatChannelLastError` 로 앉는다. 분류 표의 대상이 아니다.
- **`chatChannelLastError` 에 외부 원문이 실리는 문제** — 별 항목(보안 축).

## Rationale (spec 에 실을 근거) — `R-CC-23`

실측상 현재 최대가 `R-CC-22` 다(`R-CC-14` 는 결번, 재사용 안 함). adapter 규약 쪽은 `R-CCA-9`
(최대가 `R-CCA-8`).

핵심 논지 셋:

1. **분류는 원인으로 한다.** 4xx/5xx 경계는 *"누가 고칠 수 있는가"* 다. 잘못된 토큰은 클라이언트가
   고칠 수 있으므로 4xx 이고, provider 가 그것을 어떤 transport 로 알리는지는 무관하다.
2. **술어를 구현 가능하게 만든다.** spec 이 *"401/403"* 이라 적으면 구현은 문자열에서 숫자를
   찾게 된다. provider 가 숫자를 안 주는 순간 그 규칙은 **조용히 거짓**이 된다 — 실제로 2/3 에서
   그랬다. 그래서 신호를 **선언**으로 옮긴다.
3. **fallback 을 남긴다.** 접두 없는 401/403 경로는 telegram 이 이미 옳게 타고 있고, 접두를
   안 붙인 provider 가 생기면 **502 로 조용히 빠지는 것보다 400 을 주는 편이 안전**하다.

---

## 편집 대상 **원문** (verbatim, `c7699bdf0` 기준)

> **왜 draft 안에 싣나** — 세션 준비 후 `_prompts/*.md` 를 실측해 보면 편집 대상 spec 의 본문이
> 안 실리는 일이 있다(`related_specs` 선택이 `conventions/`·`5-system/` 에 도달 못 하는 경우).
> 원문을 target 문서에 담아 checker 가 *"새 문장이 현행과 맞는가"* 를 판정할 수 있게 한다.
> 부수로 이 draft 가 무엇을 바꿨는지의 증거가 된다.

### ⓐ `spec/5-system/15-chat-channel.md` §5.4 에러 표의 대상 두 행

```markdown
| 400 | `BOT_TOKEN_INVALID` | 신규 토큰으로 `setupChannel` (`getMe`/`setWebhook`) 401/403 |

| 502 | `CHAT_CHANNEL_SETUP_FAILED` | `setupChannel` (Telegram `setWebhook` 등) API 호출 실패 (재시도 후에도 실패) |
```

### ⓑ `spec/conventions/chat-channel-adapter.md` §1.1 표의 `setupChannel` 행

```markdown
| `setupChannel` | 외부 채널의 inbound hook 등록 (텔레그램 `setWebhook`) + bot identity 조회 | 외부 API 호출 1회 이상 | yes — 같은 config 재호출 OK. **뜻은 [§1.1.1](#111-setupchannel-멱등의-뜻--등록-안전성이지-시크릿-값-불변이-아니다)** |
```

### ⓒ 현행 구현 — `translateSetupChannelError` (`chat-channel-input-rules.ts`)

```ts
export function translateSetupChannelError(err: unknown): BadRequestException {
  const message = err instanceof Error ? err.message : String(err);
  if (/\b(401|403)\b/.test(message)) {
    return new BadRequestException({
      code: 'BOT_TOKEN_INVALID',
      message: 'Bot token is invalid (401/403 from provider).',
      details: { reason: message.slice(0, 256) },
    });
  }
  return new BadRequestException({
    code: 'CHAT_CHANNEL_SETUP_FAILED',
    message: 'Chat channel setup failed after rotation.',
    details: { reason: message.slice(0, 256) },
  });
}
```

### ⓓ adapter 3종이 `setupChannel` 에서 던지는 자격-증명 계열 message

```ts
// slack.adapter.ts — auth.test 실패 (Slack 은 HTTP 200 + {ok:false,error} 로 온다)
    if (!result.ok) {
      throw new Error(`Slack auth.test failed: ${result.error ?? 'unknown'}`);

// discord.adapter.ts — verify_key 불일치 (이미 `BOT_TOKEN_INVALID:` 접두를 쓴다)
        throw new Error(
          'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와 불일치',
        );

// telegram-client.ts — 유일하게 status 를 문자열에 싣는다
          lastError = new Error(
            `Telegram ${method} HTTP ${res.status} ${body.description ?? ''}`,
          );
```

## 체크리스트

- [ ] `/consistency-check --spec` **BLOCK: NO**
- [ ] (1) `§5.4` 에러 표 두 행 교체
- [ ] (2) `chat-channel-adapter.md` §1.1.2 신설 + §1.1 표의 `setupChannel` 행에서 링크
- [ ] (3) `R-CC-23` + `R-CCA-9`
- [ ] 트래커 항목을 **developer → planner 완료 + developer 후속**으로 재기술 (discord 한 건이
      아니라 **Slack 이 실질 동기**임을 적는다)
- [ ] `plan/complete/` 이동
