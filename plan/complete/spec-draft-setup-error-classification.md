---
title: setupChannel 실패 분류 — transport 대신 원인, 추측 대신 typed code, 그리고 502 는 실재하지 않았다
status: complete
owner: planner
worktree: spec-setup-error-classification-5e5a82
started: 2026-09-12
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/conventions/chat-channel-adapter.md
  - spec/5-system/2-api-convention.md
  # 아래 둘은 §5.4 를 SoT 로 인용하면서 "401/403 에서 드러난다" 를 **자기 본문에 복제**한다 —
  # §5.4 만 고치면 그 복제가 반증된 채로 남는다 (`--spec` 1회차 CRITICAL).
  - spec/2-navigation/2-trigger-list.md
  - spec/data-flow/14-chat-channel.md
  # `--spec` 2회차가 넓혔다: Slack 의 실패 응답 형태가 spec 트리에 없어서, 이 draft 가 봉인되면
  # 이 결정의 **실질 동기가 사라진다**(W2). swagger 표는 저장소 최초 502 라 갱신이 필요하다(W4).
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/conventions/swagger.md
  # `--spec` 3회차 W1: C-1 의 "502 아니라 503" 이 스코프 한정 없이 절대적으로 읽힌다 —
  # 역방향 각주가 없으면 그 독자는 "우리는 502 를 안 쓴다" 로 결론한다(미러 유실과 같은 클래스).
  - spec/5-system/4-execution-engine.md
  # `providers/discord.md` 는 **확인했고 편집 불요** — verify_key 불일치를 이미
  # `BOT_TOKEN_INVALID` 로만 적고 401/403 주장을 하지 않는다(L56·L76 실측). 이 결정으로도 참이다.
---

## 왜 이 턴인가 — developer 항목으로 등재했는데 **spec 결함이었다**

트래커에 *"`translateSetupChannelError` 가 discord verify_key 불일치를 502 로 떨어뜨린다 —
의도는 400"* 을 **developer 항목**으로 올려 뒀다. 착수해서 읽으니 **코드가 spec 을 정확히
구현하고 있었다** — §5.4 표가 `400 BOT_TOKEN_INVALID ← setupChannel 401/403` 이라 적고 있어
판별식 `/\b(401|403)\b/` 은 문면 그대로다.

내가 *"의도는 400"* 이라 쓴 근거는 spec 이 아니라 **adapter 주석**이었다. **주석과 spec 이 어긋나
있었고 나는 주석만 보고 코드 결함이라 판정했다.** HTTP 코드는 **API 계약**이라 자기-반증형
소정정 조건 2가 배제한다 → planner 턴.

**파고 보니 결함이 셋이다.** 하나를 고치려다 셋을 찾았고, 셋 다 같은 계약(§5.4 실패 응답)에 있다.

---

## 결함 ① 분류 술어가 **2/3 provider 에서 구현 불가능**하다

`setupChannel` 경로가 던지는 message 의 꼬리를 전수로 셌다 — status 가 아니라 **provider 자신의
error 문자열**이다:

| provider | 자격 증명 거부를 알리는 방식 | message 예 | `/\b(401\|403)\b/` |
|---|---|---|---|
| **Slack** | **HTTP 200** + `{ok:false, error:'invalid_auth'}` — Slack Web API 의 문서화된 스타일 | `Slack auth.test failed: invalid_auth` | **안 걸림 → SETUP_FAILED** |
| **Discord** | `verify_key` 불일치 — 응답은 200, **status 자체가 없다** | `BOT_TOKEN_INVALID: Discord verify_key 가 …` | **안 걸림 → SETUP_FAILED** |
| **Telegram** | client 가 `HTTP ${status}` 를 문자열에 싣는다 | `Telegram setWebhook failed: … HTTP 401 …` | 걸림 → `BOT_TOKEN_INVALID` |

> Slack 의 그 동작은 추측이 아니다 — `slack-client.ts` 자신이 주석으로 적고 있다:
> *"2xx — Slack Web API 는 200 OK 에도 `{ ok: false, error }` 형식 반환 가능."*

**트래커가 적은 discord 한 건보다 크다.** rotate 엔드포인트의 가장 흔한 실패 — 잘못된 토큰을
넣는 것 — 이 Slack 에서 `BOT_TOKEN_INVALID` 가 아니라 `CHAT_CHANNEL_SETUP_FAILED` 로 나간다.

## 결함 ② spec 이 **502 라 적은 행이 실제로는 400** 이다 — 한 번도 502 가 아니었다

`--spec` 1회차 WARNING 이 짚었고, 정본 구현을 **실행**해 확정했다:

| 입력 message | 실측 status | code |
|---|---|---|
| `ECONNRESET` | **400** | `CHAT_CHANNEL_SETUP_FAILED` |
| `Slack auth.test failed: 401` | 400 | `BOT_TOKEN_INVALID` |
| `Telegram setWebhook failed: HTTP 500` | **400** | `CHAT_CHANNEL_SETUP_FAILED` |

`translateSetupChannelError` 는 **두 분기 모두 `BadRequestException`** 을 돌려준다. 그리고
**`2-api-convention.md §6` 상태 코드 표에 `502` 행 자체가 없다**(있는 것은 `503`).
즉 §5.4 의 `502` 는 **카탈로그에도 없고 구현에도 없는 값**이었고, 테스트는 `code` 만 단언해
`getStatus()` 를 본 적이 없어 **아무도 몰랐다.**

## 결함 ③ 반증된 서술이 **3곳에 복제**돼 있다

§5.4 만 고치면 같은 문서군이 자기 자신과 모순한다 (`--spec` 1회차 **CRITICAL**):

| 파일 | 복제된 문장 |
|---|---|
| `15-chat-channel.md` §4.1 (**같은 파일**) | *"잘못된 토큰은 `setupChannel` 의 외부 API **401/403** 에서 `BOT_TOKEN_INVALID` 로 드러난다"* |
| `2-navigation/2-trigger-list.md` | *"… 외부 provider API **401/403** 에서 400 `BOT_TOKEN_INVALID` 로 드러난다"* |
| `data-flow/14-chat-channel.md` | *"외부 API **401/403** 은 `BOT_TOKEN_INVALID` 400, 그 외는 `CHAT_CHANNEL_SETUP_FAILED`"* |

셋 다 §5.4 를 **SoT 로 인용하면서** 그 내용을 본문에 다시 적었다 — SoT 가 바뀌면 조용히 거짓이
되는 구조다. **내가 또 한 자리만 보고 범위를 정했다**(같은 실패를 이 세션에서 네 번째로 한다).

---

## 결정

### (1) 분류는 **원인**으로 한다 — `15-chat-channel.md §5.4` 에러 표

| HTTP | error.code | 새 사유 |
|---|---|---|
| 400 | `BOT_TOKEN_INVALID` | `setupChannel` 이 **자격 증명 거부**로 실패. provider 가 그것을 401/403 · `{ok:false, error:'invalid_auth'}` · `verify_key` 불일치 중 무엇으로 알리든 **같은 분류**다 — 신호 방식은 transport 세부이고 분류 기준이 아니다 |
| **502** | `CHAT_CHANNEL_SETUP_FAILED` | 그 밖의 실패 — provider 5xx · 네트워크 · 타임아웃 등 **클라이언트가 입력으로 고칠 수 없는** 것 |

판별 원칙은 **누가 고칠 수 있는가**다. 잘못된 토큰은 클라이언트가 고칠 수 있으므로 4xx 이고,
provider 장애는 재시도밖에 없으므로 5xx 다. 502 를 주면 사용자는 *"토큰이 문제"* 라는 것을 알 수
없고 재시도만 반복한다 — 그것이 지금 Slack 사용자가 겪는 일이다.

### (2) 판별을 **typed `code`** 로 — 추측하지 않는다 (`chat-channel-adapter.md` 신규 §1.1.2)

> `setupChannel`(및 `teardownChannel`·`revokeBotToken`)이 **자격 증명 거부**로 실패하면
> `code: 'BOT_TOKEN_INVALID'` 프로퍼티를 가진 에러를 던진다. 호출자는 **그 `code` 로만** 분류하고
> `message` 를 파싱하지 않는다. code 가 없는 에러는 호출자가 generic 실패로 다룬다.

**처음엔 message 접두(`'BOT_TOKEN_INVALID: …'`)로 제안했다가 `--spec` 지적을 받고 바꿨다.**
접두는 여전히 **문자열 파싱으로 제어흐름을 가르는** 형태이고, 이 저장소는 같은 문제에 이미 두 번
반대 방향으로 결정해 뒀다:

- [`4-execution-engine.md §7.5.2`](../../spec/5-system/4-execution-engine.md) — client 경계 에러는
  **typed `{code, message, serverDetail}`**. `code` 가 판별자, `message` 는 고정 client-safe 문자열.
- [`chat-channel-adapter.md R-CCA-5`](../../spec/conventions/chat-channel-adapter.md) — `error.message`
  원문을 전달하지 않는 **이유**(노드 핸들러가 URL·query·DB 컬럼명·stack·API key 를 흘릴 수 있다).
  **화이트리스트(`error.code` + `details.statusCode`) 자체를 정의하는 것은 그 절이 위임하는
  [`15-chat-channel.md R-CC-15`](../../spec/5-system/15-chat-channel.md)** 다 — 처음엔 둘을 R-CCA-5
  하나로 인용했는데 출처가 어긋났다(`--spec` 2회차 INFO 4).

discord 가 접두를 쓰고 있는 것은 **관례가 아니라 규칙 부재의 흔적**이다 — 승격 대상이 아니라
정정 대상이다. (`#1316` 의 *"관례를 규칙으로 승격"* 은 그 관례가 이미 옳았을 때의 패턴이다.)

**fallback 은 남긴다** — code 없는 에러에 대해 401/403 판별을 유지한다. telegram 이 그 경로로
이미 옳게 동작하고, `code` 를 아직 안 붙인 경로가 **조용히 502 로 빠지는 것보다** 400 을 주는
편이 사용자에게 낫다.

> **이 fallback 은 「message 원문으로 분기하지 않는다」에 대한 의도적·한시적 예외**다
> (`--spec` 2회차 INFO 3). 같은 원칙의 선례가 **셋**이다 — R-CCA-5(→R-CC-15) · §7.5.2 ·
> 그리고 [`3-error-handling.md §1.3` 의 `FILE_REQUIRED` 주석](../../spec/5-system/3-error-handling.md)
> 이 가장 가깝다(3회차 INFO 2). 예외인 이유를 §1.1.2 에 적고 **제거 조건과 소유자도 함께
> 적는다**: 세 adapter 가 모두 `code` 를 달면 이 분기는 삭제 후보이고, 그 판정을 **후속 트래커
> 항목으로 등재**한다(3회차 INFO 3). 조건만 적고 추적을 안 하면 한시적 예외가 영구 예외가 된다.

**`code` 라는 이름이 세 뜻으로 쓰인다** — §1.1.2 서두에 전부 갈라 적는다:

| 무엇 | 소유 | 값 도메인 |
|---|---|---|
| **§1.1.2 의 `code`** (신설) | **우리가 새로 throw 하는 `Error` 의 프로퍼티** | `'BOT_TOKEN_INVALID'` 등 우리 문자열 |
| §3.1 의 `event.error.code` | EIA 이벤트 payload | 실행 실패 분류용 (별 네임스페이스, 2회차 INFO 2) |
| `app.code` / `res.code` | **Discord 원본 API 응답 필드** | **숫자** (`discord.adapter.ts:69,438`) |

**세 번째가 특히 위험하다**(`--spec` 3회차 W6) — `discord.adapter.ts` 는 이미 `'code' in app`
으로 원본 응답을 검사한다. 거기에 우리 `code` 를 얹는 구현이 두 개를 헷갈리면 **조용히 잘못
분기**한다. 구현 위임 항목 3에 그 주의를 적는다.

제목은 §1.1.1(**멱등**의 뜻)과 대조되게 **「실패 판별」** 로 짓는다(2회차 INFO 7).

### (3) `details.reason` 의 **provider 원문 echo 를 중단**한다

현행 구현은 두 분기 모두 `details: { reason: message.slice(0, 256) }` 로 **외부 원문을 응답에
싣는다.** §7.5.2 가 *"plain `Error` 의 `error.message` 를 client 에 전달하지 않는다"* 를
**보안 게이트**로 명시하고 R-CCA-5 도 같은 이유(*"URL·query·DB 컬럼명·stack·API key 일부"* 유출)로
원문을 배제하는데, 이 경로만 예외가 돼 있었다.

→ 응답은 **고정 client-safe message + code** 만, 원문은 **서버 로그**로. §5.4 표에 그 분리를
명시한다.

> **필드명을 차용하지 않는다**(`--spec` 3회차 INFO 6) — 처음엔 *"§7.5.2 의 `serverDetail`
> 자리로"* 라고 썼는데, `serverDetail` 은 **EIA 이벤트** 계약의 필드이고 REST 에러 봉투(§5.3)에는
> 그 필드가 **없다**. 빌려 쓸 것은 필드가 아니라 **원칙**이다 — *"클라이언트엔 고정 문구,
> 원문은 서버 전용."*

### (4) `2-api-convention.md §6` 에 **502 행 신설** — 저장소 **최초 502** 다

§5.4 가 쓰는 값인데 카탈로그에 없다. 그리고 실측하니 **코드에도 없다**:

| 심볼 | 사용 파일 수 |
|---|---|
| `BadGatewayException` · `HttpStatus.BAD_GATEWAY` · `@ApiBadGatewayResponse` | **각 0** |
| `ServiceUnavailableException` (대조군) | 4곳 (비-테스트) |

**502 는 이 저장소가 한 번도 낸 적이 없는 상태 코드다.** 그래서 도입은 표 한 줄로 끝나지 않는다 —
`swagger.md §2-4` 데코레이터 표에도 5xx 행이 **없어서** 컨트롤러가 문서화할 방법이 없다.

추가할 행(정상 표 문법 — 초안 blockquote 가 아니라 `|` 행으로 넣는다, INFO 5):

```markdown
| 502 | Bad Gateway | **외부 제3자 API**(chat provider 등) 호출 실패 — 재시도 가능. 코드: `CHAT_CHANNEL_SETUP_FAILED` — [Spec Chat Channel §5.4](./15-chat-channel.md#54-bot-token-rotation-api-응답-계약). 우리 의존성(Redis 등) 일시 장애인 `503` 과 구분한다 |
```

> 서식은 **이웃 503 행의 관행**(`코드: X — [링크]`)을 그대로 따른다(`--spec` 3회차 W2) —
> 표 안에서 한 행만 다른 모양이면 그 행이 나중에 다른 규칙으로 읽힌다.

> **노드 출력의 `statusCode` 와 무관하다**(INFO 7) — 그쪽은 HTTP 노드가 응답 상태를 payload 에
> 담는 필드이고, 이 행은 **우리 API 가 클라이언트에 주는 상태**다. 각주로 갈라 적는다.

**기존 축과 충돌하지 않는다 — 실측으로 확인했다** (`--spec` 2회차 W1). `4-execution-engine.md` 는
*"Redis 장애 = 503, 502 아님"* 이라 결정해 뒀는데, 그 판정의 대상이 전부 **우리 쪽**이다:

| 실제 HTTP 503 사용처 | 주어 |
|---|---|
| `WEBAUTHN_DISABLED` | 우리 기능 플래그 |
| `SERVER_SHUTTING_DOWN` | 우리 서버 |
| `EXECUTION_ENQUEUE_FAILED` | 우리 continuation bus |

즉 *"응답 유효성 vs 일시 가용성"* 축과 *"외부 제3자 vs 우리 인프라"* 축은 **현재 사례 전부에서
같은 결론**을 낸다. 이 결정은 그 축을 바꾸는 것이 아니라 **어느 축으로도 비어 있던 자리**(외부
provider 가 실패했다)를 채운다. `R-CC-23` 에 그 정합을 명시 인용한다.

> **경계 사례를 인지해 둔다**: provider **타임아웃**은 두 축이 갈릴 수 있다(외부이므로 502,
> 그러나 "일시 가용성" 이므로 503 로 읽을 여지). 현재 구현은 타임아웃을 재시도 후
> generic 실패로 넘기므로 이 결정에서는 502 다 — 갈리면 그때 판정한다.

**기각한 대안**: 기존 `503` 재사용. 위 표대로 503 은 **우리 쪽**에 스코프돼 있어, 외부 provider
실패를 거기 섞으면 운영자가 *"우리가 죽었나 남이 죽었나"* 를 상태 코드로 못 가린다.

### (6) `providers/slack.md §3.1` — **실패 응답 형태**를 적는다

이 결정의 실질 동기(Slack 이 자격 증명 거부를 **HTTP 200 + `{ok:false, error}`** 로 준다)가
**spec 트리에 없다.** §3.1 은 성공 응답(`{ok:true, …}`)만 보여준다. draft 가 `plan/complete/` 로
봉인되면 **근거가 spec 에서 사라진다**(`--spec` 2회차 W2).

→ §3.1 에 실패 형태 한 줄 + *"자격 증명 거부 신호"* 라벨을 넣고 `chat-channel-adapter.md §1.1.2`
로 링크한다.

### (5) 복제된 3곳은 **문장을 지우고 §5.4 로 보낸다**

같은 내용을 세 곳에 다시 적으면 SoT 가 바뀔 때마다 세 곳이 낡는다 — 이번이 그 증거다.
*"401/403 에서 드러난다"* 를 *"`setupChannel` 실패 시 §5.4 의 분류에 따라 드러난다"* 로 줄이고
링크만 남긴다. **복제를 원인-기반으로 다시 적는 것이 아니라 복제 자체를 없앤다.**

---

## 구현 위임 (이 턴 밖 — developer 후속)

1. `translateSetupChannelError` — ⓐ `err.code === 'BOT_TOKEN_INVALID'` 우선 판별, ⓑ fallback
   401/403 유지, ⓒ **`BadGatewayException`(502)** 로 정정, ⓓ `details.reason` 원문 제거 +
   `logger.warn` 으로 이동.
   ⓔ **컨트롤러에 `@ApiBadGatewayResponse` 부착** — 저장소 최초 사용이므로 `swagger.md §2-4` 의
   신설 행과 짝이다(`--spec` 2회차 W4). ⓕ `http-exception.filter` 가 502 를 표준 envelope 로
   싸는지 **실측 확인** — 한 번도 지나간 적 없는 경로다.
2. `slack.adapter.ts` — `auth.test` 실패에 `code` 부착. **`ratelimited` 류는 제외**(자격 증명
   문제가 아니다). 어느 `result.error` 값이 자격 증명 거부인지 **developer 가 실측해 열거**할 것 —
   Slack 문서상 `invalid_auth`·`not_authed`·`account_inactive`·`token_revoked`·`token_expired`.
3. `discord.adapter.ts` — verify_key 불일치의 **message 접두를 `code` 로 교체**(접두는 제거).
   `getApplicationMe` 4xx 실패도 대상인지 판정.
4. `telegram.adapter.ts` — `getMe`/`setWebhook` 의 401/403 경로에 `code` 부착(fallback 의존 해소).
5. **캐너리를 뒤집는다** — `chat-channel-input-rules.spec.ts` 의 *"discord verify_key → 502"* 가
   RED 가 되는 것이 **의도**다. 그 자리에 ⓐ verify_key → 400 ⓑ **Slack `invalid_auth` → 400**
   (이 변경의 실질 동기) ⓒ **`getStatus()` 단언**(지금 아무도 안 본다) 을 넣는다.
   > **인접 백로그와 같은 커밋에서 처리한다** —
   > `spec-draft-nullable-notation-followups.md` 의 *"`chat-channel-input-rules.spec.ts` 잔여
   > 보강 5건"* 중 **(d) `translateSetupChannelError` 의 non-Error 입력 분기 + `details.reason`
   > 값 단언** 이 같은 함수·같은 테스트 블록이다. 따로 하면 한쪽이 조용히 stale 된다
   > (`--spec` 1회차 WARNING 5). **(d) 의 `details.reason` 단언은 이 결정으로 뜻이 바뀐다** —
   > 원문이 아니라 **부재**를 단언해야 한다.
6. `providers/{slack,discord,telegram}.md` §3.1 에 그 provider 의 자격 증명 거부 신호 방식을
   한 줄씩 적을지 판단 — §5.4 가 *"무엇으로 알리든"* 이라 적으므로 **필수는 아니다**.

## 안 하는 것

- **`translateSetupChannelError` 의 파일 위치** — 입력 규칙 모듈에 출력측 변환이 섞여 있다는
  지적은 별 트래커 항목이다. 이 턴은 **분류 계약**만 다룬다.
- **`setupChatChannel`(생성/PATCH 경로)의 degraded 저장** — 코드화된 에러를 던지지 않고
  `chatChannelHealth='degraded'` + `chatChannelLastError` 로 앉는다. 분류 표의 대상이 아니다.
- **`chatChannelLastError` 에 외부 원문이 저장되는 문제** — (3)과 **같은 클래스지만 다른 표면**
  (응답 vs DB 컬럼)이다. 이 턴에서 함께 고치지 않는 이유는 그쪽이 **운영자용 진단**이라 제거
  판단에 다른 근거가 필요하기 때문이다.

  > ### ⚠️ *"별 항목으로 등재돼 있다"* 고 썼는데 **거짓이었다** (`--spec` 3회차 W5)
  >
  > `plan/` 전체를 grep 하니 **그런 항목이 없다** — 이 draft 자신만 매치한다.
  > 그런데 `review/` 를 grep 하니 **코드 리뷰 세션 22개**가 그것을 제기했다
  > (2026-06-12 ~ 2026-09-11, **3개월**). 즉 리뷰어가 스무 번 넘게 짚었고 **매번 유실**됐다.
  >
  > 원인은 알려진 것이다 — **`review/**` 는 SoT 가 아니다.** RESOLUTION 에 *"이미 트래커
  > 등재"* 라고 적으면 그 문장 자체가 증거처럼 보이지만, `plan/` 에 실제로 쓰지 않으면
  > 다음 세션은 `review/` 를 읽지 않는다. **나는 이 세션에서만 같은 거짓 기재를 세 번 했다**
  > (`#1319` 의 CRITICAL · `#1321` 의 RESOLUTION · 이번).
  >
  > → 이 턴에서 **실제로 등재한다**(체크리스트 ⓓ). 그리고 규율을 하나 더 좁힌다:
  > *"해소"* 를 쓰기 전에 grep 하는 것과 똑같이, **"이미 등재됨" 을 쓰기 전에도 grep 해
  > 그 항목을 인용한다.** 항목 제목을 인용할 수 없으면 등재되지 않은 것이다.
- **`3-error-handling.md §1` 중앙 카탈로그에 chat-channel rotate 코드군 등재** — 기존 갭이고
  (`--spec` INFO 1) 이 턴의 동기가 아니다. 트래커에 남긴다.

## Rationale — `R-CC-23` (15-chat-channel) · `R-CCA-9` (adapter 규약)

실측: `R-CC-` 최대 22(`R-CC-14` 결번, 재사용 안 함) · `R-CCA-` 최대 8.

논지 넷:

1. **분류는 원인으로.** 4xx/5xx 경계는 *"누가 고칠 수 있는가"* 다. 이 판정은
   `3-error-handling.md` 의 축자 인용이 아니라 그 문서의 개별 사례(`VALIDATION_ERROR`·
   `FILE_REQUIRED`)에서 일반화한 것임을 밝힌다(`--spec` INFO 2).
2. **술어를 구현 가능하게.** spec 이 *"401/403"* 이라 적으면 구현은 문자열에서 숫자를 찾는다.
   provider 가 숫자를 안 주는 순간 규칙이 **조용히 거짓**이 된다 — 실제로 2/3 에서 그랬다.
3. **판별자는 구조적으로.** `code` 프로퍼티는 컴파일러·리팩터가 볼 수 있고 message 는 아니다.
   §7.5.2·R-CCA-5 가 이미 같은 결론을 냈으므로 **새 원칙이 아니라 적용**이다.
4. **원문은 로그로.** 응답에 외부 원문을 싣지 않는 것은 §7.5.2 의 보안 게이트와 동일한 이유다.

---

## 편집 대상 **원문** (verbatim, `c7699bdf0` 기준)

> **왜 draft 안에 싣나** — 세션 준비 후 `_prompts/*.md` 를 실측하면 편집 대상 spec 의 본문이
> 안 실리는 일이 있다(`related_specs` 선택이 `conventions/`·`5-system/` 에 도달 못 함).
> 원문을 target 에 담아 checker 가 *"새 문장이 현행과 맞는가"* 를 판정할 수 있게 한다.
> 부수로 이 draft 가 무엇을 바꿨는지의 증거가 된다.

### ⓐ `15-chat-channel.md` §5.4 에러 표 — 교체 대상 두 행

```markdown
| 400 | `BOT_TOKEN_INVALID` | 신규 토큰으로 `setupChannel` (`getMe`/`setWebhook`) 401/403 |

| 502 | `CHAT_CHANNEL_SETUP_FAILED` | `setupChannel` (Telegram `setWebhook` 등) API 호출 실패 (재시도 후에도 실패) |
```

### ⓑ `chat-channel-adapter.md` §1.1 표의 `setupChannel` 행 (링크 추가 대상)

```markdown
| `setupChannel` | 외부 채널의 inbound hook 등록 (텔레그램 `setWebhook`) + bot identity 조회 | 외부 API 호출 1회 이상 | yes — 같은 config 재호출 OK. **뜻은 [§1.1.1](#111-setupchannel-멱등의-뜻--등록-안전성이지-시크릿-값-불변이-아니다)** |
```

### ⓒ 현행 구현 — `translateSetupChannelError`

**두 분기 모두 `BadRequestException`** 이고 **두 분기 모두 원문을 `details.reason` 에 싣는다.**

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

### ⓓ adapter 3종의 자격-증명 계열 throw

```ts
// slack.adapter.ts — auth.test 실패 (Slack 은 HTTP 200 + {ok:false,error})
    if (!result.ok) {
      throw new Error(`Slack auth.test failed: ${result.error ?? 'unknown'}`);

// discord.adapter.ts — verify_key 불일치 (message 접두 — 이 결정으로 `code` 로 교체)
        throw new Error(
          'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와 불일치',
        );

// telegram-client.ts — 유일하게 status 를 문자열에 싣는다
          lastError = new Error(
            `Telegram ${method} HTTP ${res.status} ${body.description ?? ''}`,
          );
```

### ⓔ **복제된 3곳** (결함 ③ — 문장을 지우고 §5.4 링크로 축약할 자리)

```markdown
# spec/5-system/15-chat-channel.md §4.1 (같은 파일)
    "botToken": "<provider 발급 plaintext>",   // 입력 전용 — POST /api/triggers 요청 body 한정. service 가 SecretResolver.rotate 로 옮긴 뒤 strip — 응답·DB JSONB 미노출 (SS-SE-01). telegram=BotFather `\d+:[A-Za-z0-9_-]+` — **입력 안내이고 서버 검증이 아니다**(형식 게이트 없음. 잘못된 토큰은 `setupChannel` 의 외부 API 401/403 에서 `BOT_TOKEN_INVALID` 로 드러난다) / slack=`xoxb-*` / discord=Developer Portal Bot Token

# spec/2-navigation/2-trigger-list.md
| Chat Channel | `botToken` | edit (입력) + rotate 액션 (single-path) | **write-only** — 응답에는 `hasBotToken: boolean` 만 노출 ([Spec Chat Channel §5.4.2](../5-system/15-chat-channel.md#542-응답-dto-derived-필드--hasbottoken)). **마스킹 값도 last4 도 응답에 싣지 않는다** — AuthConfig 의 `***<last4>` 마스킹 규약([데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책))은 *Reveal 로 읽을 수 있는* 자격증명용이라 write-only 필드에 차용하지 않는다([secret-store §1.1](../conventions/secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다)). 입력창 placeholder 는 형식 예시(`123456789:ABCdef...`)이지 서버가 보낸 값이 아니다. **서버는 형식을 검증하지 않는다** — 잘못된 토큰은 `setupChannel` 의 외부 provider API 401/403 에서 400 `BOT_TOKEN_INVALID` 로 드러난다([Spec Chat Channel §1.11](../5-system/3-error-handling.md#111-트리거-authconfig-binding-에러-코드-도메인-spec-참조) 은 별 코드다 — 혼동 말 것. 회전 실패 분기는 [§5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약)). telegram BotFather 형식 `^\d{6,}:[A-Za-z0-9_-]{30,}$` 는 **입력 안내**이고 **telegram 전용**이다(slack `xoxb-*` · discord Developer Portal 은 다른 형식). 그 정규식은 user-guide·i18n 에만 있고 코드에 구현이 없다(2026-09-11 실측). 변경 시 **항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token`** 만 사용 (24h grace). PATCH body 의 `botTokenRef` 변경은 차단 — 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`, `details.code='INVALID_FIELD'`). 정당화 Rationale [R-CC-10](../5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only) |

# spec/data-flow/14-chat-channel.md
> 회전 실패 분기: `setupChannel` 의 외부 API 401/403 은 `BOT_TOKEN_INVALID` 400, 그 외는
> `CHAT_CHANNEL_SETUP_FAILED` 로 변환 ([Spec Chat Channel §5.4](../5-system/15-chat-channel.md) 에러 표).
```

### ⓕ `2-api-convention.md §6` 상태 코드 표 — **502 행이 없다**(503 만 있다)

```markdown
| 429 | Too Many Requests | Rate Limit 초과 |
| 500 | Internal Server Error | 서버 오류 |
| 503 | Service Unavailable | upstream 의존성(Redis 등) 일시 장애로 요청을 수락할 수 없음 — 재시도 가능. 코드: `SERVER_SHUTTING_DOWN`(SIGTERM 후 새 실행 거부)·`EXECUTION_ENQUEUE_FAILED`(continuation publish 실패로 cancel 미수락) — [error-handling §1.5](./3-error-handling.md#15-ws-commands-에러-코드-도메인-spec-참조) |

```

### ⓖ `providers/slack.md §3.1` — 성공 응답만 있다 (결정 (6) 의 대상)

```markdown

```
POST https://slack.com/api/auth.test
Authorization: Bearer {botToken}
→ { ok: true, team_id, user_id, bot_id, url, team, user, ... }
  → config.chatChannel.botIdentity = { botId: hashStringToInt(user_id ?? bot_id), username: (user ?? bot_id), teamId: team_id }
```
```

### ⓗ `conventions/swagger.md §2-4` 데코레이터 표 — **5xx 행이 없다** (결정 (4) 의 대상)

```markdown
| 상황 | 데코레이터 |
|------|-----------|
| 200 OK (조회/수정) | `@ApiOkResponse` |
| 201 Created | `@ApiCreatedResponse` |
| 204 No Content | `@ApiNoContentResponse` |
| 400 검증 실패 | `@ApiBadRequestResponse` |
| 401 인증 실패 | `@ApiUnauthorizedResponse` |
| 403 권한 부족 | `@ApiForbiddenResponse` |
| 404 없음 | `@ApiNotFoundResponse` |
| 409 중복/충돌 | `@ApiConflictResponse` |

```

### ⓘ `4-execution-engine.md` C-1 의 502/503 문구 (W1 대상 — 역방향 각주를 붙일 자리)

```markdown
**C-1** — `cancelWaitingExecution` 은 옛 `void publish` fire-and-forget 였다(publish 실패가 caller 에 닿지 않는 에러 유실). 다른 4종 continuation 메서드가 이미 `ContinuationPublishResult` 를 반환하므로 cancel 만 예외로 둘 근거가 없어 동일 패턴으로 정합화하고(§7.4), REST `POST /executions/:id/stop` 의 WAITING cancel 분기가 `queued:false` 를 surface 한다. HTTP 코드는 **503** 으로 정한다 — Redis 의존성 장애 = upstream 불가용이므로 502(잘못된 게이트웨이 응답)가 아니라 503(일시 불가·재시도)이 맞고, 이미 `SERVER_SHUTTING_DOWN`(SIGTERM 후 새 실행 거부)이 같은 503 선례를 확립했다. cancel 은 WS ack 경로(§7.5.2 의 4종 handler)가 아니라 REST stop 진입점이므로 신규 코드 `EXECUTION_ENQUEUE_FAILED`(`EXECUTION_*` 네임스페이스, §7.5.2)로 표기한다.

**M-7** — `nextSeq` 의 Redis INCR 실패 시 옛 `Math.random` seq fallback 을 제거하고 fail-fast(INCR throw → `publish` outer catch → `null`/`queued:false`)로 전환했다. random seq 는 §7.4 "seq = idempotency key"·§9.2 단조성 계약을 위반해 jobId 중복 dedup 을 무력화하며, BullMQ 자체가 Redis 라 INCR 가 실패하는 장애에선 직후 `queue.add` 도 실패할 공산이 커 fallback 의 가용성 실익이 사실상 없다. `exec:seq`(emit-event)는 분산 monotonic 미보장을 수용해 in-memory degraded fallback 을 두지만, continuation seq 는 jobId dedup 계약 보존이 우선이라 의도적으로 **비대칭**이다 (§9.2). 두 항목은 publish 실패를 `queued:false` 단일 표면으로 통일한다는 점에서 같은 결정이다.
```

## 체크리스트

- [x] `/consistency-check --spec` 1회차 (`11_50_28`) **BLOCK: YES** — CRITICAL 1 (복제 3곳) ·
      WARNING 4. **네 지적 전부 실측으로 확인**하고 설계를 바꿨다(접두 → typed `code`,
      502 실증, 원문 echo 중단, 복제 제거)
- [x] `/consistency-check --spec` 2회차 (`12_05_58`) **BLOCK: NO** · CRITICAL 0 · WARNING 5 —
      1회차 CRITICAL 해소 확인. 5건 전부 실측으로 확인해 반영했다(**502 는 저장소 최초 사용**임을
      0건 실측으로 확정 · 기존 503 축과의 정합을 사용처 3곳 주어로 확인 · `R-CCA-5`→`R-CC-15`
      인용 정정 · `slack.md` 근거 보강 · 트래커 정정 3건)
- [x] `/consistency-check --spec` 3회차 (`12_22_24`) **BLOCK: NO** · CRITICAL 0 · WARNING 6 ·
      전 checker **LOW**. 6건 전부 반영했다 — 그중 **W5 가 내 거짓 기재**였고(위 §안 하는 것),
      실측하니 그 항목은 **22개 리뷰 세션에서 제기되고 3개월간 매번 유실**된 것이었다.

### 4회차를 돌리지 않는다 — 판단을 적어 둔다

3회차가 **BLOCK: NO** 이므로 게이트 요건은 충족됐다. 그런데 W1 반영으로 `spec_impact` 에
`4-execution-engine.md` 가 늘었다 — 나는 지금까지 *"체커가 안 본 파일이 생기면 재실행"* 을
적용해 왔으므로 일관성을 따지면 4회차다.

**그래도 돌리지 않는다**: 그 파일의 편집은 **체커가 문구까지 지정한 한 줄 역방향 각주**이고,
체커에게 자기 처방을 다시 검사시키는 것은 정보 이득이 거의 없다. 대신 그 원문을 아래 ⓘ 에
실어 **다음 세션이 대조할 수 있게** 남긴다. 이 판단이 틀렸다면 `--impl-done`(구현 턴)에서
같은 파일이 다시 스코프에 들어오므로 그때 잡힌다.

- [x] (W1) `4-execution-engine.md` C-1 에 역방향 각주 — C-1 이 **502 를 명시적으로 기각**하고
      있어서(*"Redis 의존성 장애이므로 502 가 아니라 503"*) 그 기각이 **우리 쪽에 스코프됨**을
      적지 않으면 독자가 "우리는 502 를 안 쓴다" 로 결론한다
- [x] (1) `§5.4` 에러 표 두 행 + 원문/로그 분리 각주 + **§4.1 미러 축약**(같은 파일)
- [x] (2) `chat-channel-adapter.md` **§1.1.2 신설**(`code` 3중 네임스페이스 표 · provider 별
      신호 방식 · fallback 한시 예외 + 제거 조건) + §1.1 표 링크
- [x] (4) `2-api-convention.md §6` **502 행 신설** — 503 행 서식(`코드: X — [링크]`)을 따르고
      노드 `statusCode` 축과의 구분을 각주로
- [x] (4-b) `conventions/swagger.md §2-4` **`502` 행** 신설 (`@ApiBadGatewayResponse`).
      기존 8행이 전부 **단일 코드**라 *"5xx 행"* 이라 쓰면 500/503 까지 포함으로 오독된다
      (`--spec` 3회차 W3)
- [x] (6) `providers/slack.md §3.1` 에 실패 응답 형태 + *"자격 증명 거부 신호"* 라벨
- [x] (5) 복제 3곳을 §5.4 링크로 축약 — **다시 적지 않고 복제를 없앴다**
- [x] (3) `R-CC-23` + `R-CCA-9` — 기각 대안 2건(status-in-message · message 접두)을 표로 남겼다.
      `R-CCA-9` 에 §7 *"모든 구체 어댑터 명세 동시 갱신"* 을 **「영향받는 모든」으로 읽는다**는
      해석을 한 줄 명시 — 이번엔 slack 만 필수다(`--spec` 3회차 INFO 5. §1.1.1 선례도 telegram
      한 파일만 갱신했다)
- [x] (W4) `chat-channel-adapter.md` **`pending_plans:` 갱신** — 그 파일은 `status: partial` 이고
      §1.1.2 는 **미구현 계약**(adapter 3종 전부 developer 후속)이다. `spec-impl-evidence.md §2.1`
      이 partial spec 의 미구현 surface 추적을 의무화한다
- [x] **반영 후 grep — 낡은 주장 잔여 0**. 남은 3건은 전부 의도된 것이다: 신규 400 행이
      401/403 을 *여러 신호 중 하나*로 열거 · `R-CC-23` 이 **옛 규칙을 인용** ·
      §1.1.2 의 **fallback 서술**(한시 예외)
- [x] 트래커 **정정 5건** (`spec-draft-nullable-notation-followups.md`) —
      ⓐ *"(b) adapter 가 status 를 message 에 싣게 통일 **이 근본이다**"* 를 **취소선 + 정정**:
      근본 처방은 typed `code`(§1.1.2 / R-CCA-9)로 **대체됐다**. 남겨 두면 다음 사람이
      **기각된 접근을 되살린다**(`--spec` 2회차 W3 — 이 저장소의 반복 실패 클래스).
      ⓑ botToken 형식검증 developer 갈래(`:2697`) 옆에 *"인용할 정답 문장은 이제 §5.4 의
      원인-기반 서술이고 「401/403」이 아니다"* 를 적는다(W5) — 그 항목이 `2-trigger-list.md` 의
      그 문장을 정답 텍스트로 쓸 예정이었다.
      ⓒ `3-error-handling.md §1` 중앙 카탈로그에 `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`
      미등재를 **살아있는 항목으로 등재**(2회차 INFO 6) — 이 draft 가 `complete/` 로 봉인되면
      유예 근거가 사라진다.
      ⓓ **`chatChannelLastError` 원문 저장을 실제로 등재**한다 (3회차 W5). 항목 본문에
      **22개 리뷰 세션 · 3개월** 실측을 싣는다 — 그 수치가 *"리뷰 산출물에만 적으면 유실된다"* 의
      증거이고, 다음 사람이 *"왜 이제 등재하나"* 를 묻지 않게 한다.
      ⓔ **fallback 제거 판정**을 후속 항목으로 등재 (3회차 INFO 3) — 조건(세 adapter 모두 `code`)
      만 §1.1.2 에 적고 추적을 안 하면 한시적 예외가 영구가 된다.
- [x] 트래커 항목을 **developer → planner 완료 + developer 후속**으로 재기술.
      discord 한 건이 아니라 **Slack 이 실질 동기**임과 **502 미실증**을 적는다.
      > 그 트래커의 소유 worktree(`plan-in-progress-items-b0c80b`)는 **실측상 부재**라 이 세션이
      > 대신 처리한다(`--spec` INFO 4 — 선례 동일).
- [x] `plan/complete/` 이동

## 반영 중 드러난 것 — 내 **검증기가 주장보다 좁았다**

`spec_impact` 완결성을 확인하는 내 스크립트가 `spec/…` **전체 경로만** 찾고 있었다. 그래서 내가
새로 쓴 항목이 `3-error-handling.md` 를 **접두 없이** 인용한 것을 놓치고 *"미등재 0건"* 을 냈다.
검증기를 **bare 파일명 축**까지 넓히자:

| 축 | 새로 잡힌 미등재 |
|---|---|
| 전체 경로 | 0건 |
| **bare 파일명** | **5건** (`1-auth.md` · `error-codes.md` · `4-execution-engine.md` · `6-websocket-protocol.md` · `4-integration.md`) |

**넷은 내 턴이 만든 게 아니라 사전 존재 갭**이고(각각 소속 항목의 처방이 그 파일을 고치라고
말한다) 등재했다. **`4-integration.md` 는 의도적으로 제외**했다 — 그 항목의 결정 대상은 DTO
필드이고 spec 캐비엇 수정은 조건부 하류다. 조건부 대상을 넣으면 목록이 *"이 plan 이 건드리는
파일"* 이 아니게 된다. **제외 판단을 frontmatter 주석에 적어 침묵과 구분했다.**

교훈은 기존 것의 재확인이다 — *"같은 병이 검증 명령에도 난다."* **0 을 보였다고 말하기 전에
그 0 을 낸 술어가 내 주장만큼 넓은지 확인해야 한다.**
