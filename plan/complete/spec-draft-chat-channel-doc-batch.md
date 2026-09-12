---
title: chat-channel 문서 잔여 배치 — glob·규약 프로즈·카탈로그·다의성 표
status: complete
owner: planner
worktree: spec-chat-channel-doc-batch
started: 2026-09-12
completed: 2026-09-12
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/conventions/swagger.md
  - spec/conventions/chat-channel-adapter.md
  - spec/4-nodes/7-trigger/providers/slack.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/3-error-handling.md
---

# Spec Draft — chat-channel 문서 잔여 배치

## 왜 한 턴인가

`#1324`·`#1326` 이 남긴 **planner 축 잔여가 7건**이고, 전부 같은 기능(chat-channel)의 문서다.
따로 열면 `--spec` 게이트만 7번 돈다. 한 배치로 닫는다.

`origin/main` = `9762fe53f` 기준 **전 항목 재판정 완료** — 7건 모두 여전히 열려 있다.

## 1. `15-chat-channel.md` `code:` glob 이 `dto/responses/` 를 못 잡는다

**실측**: glob `.../triggers/dto/chat-channel-*.dto.ts` 의 `*` 는 `/` 를 넘지 않는다(정본 매처
`review_guard._glob_to_regex`). `#1326` 이 `swagger.md §5-1` 규약대로
`dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 에 응답 DTO 를 두자 **이 spec 이
자기 파일을 못 보게 됐다**(`2-trigger-list.md` 의 `dto/**` 만 잡는다).

### 변경안

```diff
-  - codebase/backend/src/modules/triggers/dto/chat-channel-*.dto.ts
+  # `**/` 를 쓴다 — 응답 DTO 는 `swagger.md §5-1` 이 `dto/responses/` 를 자리로 정하는데
+  # `*` 는 `/` 를 넘지 않아 그 하위를 못 잡았다(#1326 실측). `**/` 는 평평한 `dto/` 도 함께
+  # 덮으므로 종전 경로가 빠지지 않는다.
+  - codebase/backend/src/modules/triggers/dto/**/chat-channel-*.dto.ts
```

**대체이지 추가가 아니다** — `**/` 가 `(?:.*/)?` 로 컴파일돼 평평한 자리도 덮는다.
**정본 매처(`review_guard._glob_to_regex`)로 확인했다**:

| 후보 | 종전 glob | `**/` glob |
|---|---|---|
| `dto/chat-channel-config.dto.ts` | MATCH | **MATCH** |
| `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` | **MISS** | **MATCH** |
| `dto/create-trigger.dto.ts` (비대상) | MISS | **MISS** — 넓혀도 과잉 포획 없음 |

두 줄을 다 두면 같은 파일을 두 번 세는 자리가 생긴다.

## 2. `15-chat-channel.md §7` 파일 트리 — 신규 파일 누락 + 서술 부정확

**실측 2건**:

- `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 가 트리에 **없다**(`#1326` 신설).
- `chat-channel-input-rules.ts` 설명이 *"입력 검증·변환 순수 함수"* 인데 그 파일은
  `translateSetupChannelError`(**출력측** — adapter 실패를 §5.4 응답 계약으로 변환)도 담는다.
  `#1326` 이 코드 헤더 주석은 넓혔지만 spec 쪽은 planner 축이라 남겨 뒀다.

### 변경안

```diff
-    chat-channel-input-rules.ts              # 입력 검증·변환 순수 함수 (R-CC-21 정본. DI 없음 — 외부 의존 0)
+    chat-channel-input-rules.ts              # chat-channel 입·출력 도메인 규칙 순수 함수 (DI 없음 — 외부 의존 0).
+                                             #   입력: R-CC-21 정본 / 출력: `translateSetupChannelError` (§5.4 응답 계약)
     chat-channel-rejection-messages.const.ts # PATCH 금지 필드 목록 + 거부 문구 (DTO·서비스 두 층의 단일 SoT)
     trigger-callback-url.ts                  # webhook callback URL 조립 순수 함수 (binder·rotateBotToken 공용)
     chat-channel-token-rotator.service.ts    # C-2: chat-channel 에서 이전 — bot token 회전 hourly 워커
     dto/chat-channel-config.dto.ts           # chatChannel 설정 DTO (생성/수정 검증 분리)
+    dto/responses/chat-channel-rotate-bot-token-response.dto.ts  # rotate 200 응답 DTO (§5.4). `swagger.md §5-1` 이 자리를 정한다
     dto/create-trigger.dto.ts                # 기존 — chatChannel 필드 추가
```

> **파일 분리(입력/출력)는 이 턴에서 하지 않는다.** `#1326` 이 *"분리는 §7 과 함께 결정"* 으로
> 유예했는데, 지금 판단하면 **developer 턴을 한 번 더 부르는 비용**이 든다. 서술을 실제 책임에
> 맞추는 것으로 drift 는 닫히고, 분리는 그 파일을 다음에 만질 때 함께 한다.

## 3. `swagger.md §5-1` — 가드가 규약보다 먼저 있다

**실측**: `#1326` 이 *"DTO 클래스명은 저장소 전체에서 유일"* 을 **build-blocking 가드**로 세웠다
(`repo-guards/__tests__/dto-class-name-collision{,-guard}.ts`). 그런데

- `swagger.md §5-1` 본문에 그 규칙이 **없다**(기존 *"이름 충돌을 피합니다"* 문단은
  `*.literal.ts` 상수 한정 — `--impl-done` checker 가 실측).
- frontmatter `code:` 에 그 두 파일이 **없다** → 어느 spec 도 그 가드를 자기 것으로 안 본다.

**왜 위험한가**: 다음 사람이 가드를 *"누가 왜 넣었는지 모르는 검사"* 로 보고 지울 수 있다.
이 저장소가 `#244` 에서 겪은 *"문서화됐는데 미구현"* 의 **거울상**이다.

### 변경안 (a) §5-1 에 규칙 추가

```markdown
**응답 DTO 클래스명은 저장소 전체에서 유일해야 합니다.** `@nestjs/swagger` 는 스키마를
**클래스 `.name` 문자열**로 `components.schemas` 에 등록하므로, 서로 다른 두 클래스가 같은
이름을 쓰면 **한쪽이 다른 쪽을 덮어씁니다** — 어느 쪽이 남는지는 스캔 순서에 달렸고, 남지 못한
엔드포인트의 문서는 실제 응답과 다른 형태를 광고합니다. **컴파일은 통과합니다**(서로 다른
모듈의 서로 다른 클래스이므로) — 타입이 막아 주지 않는 축입니다.

같은 개념을 층별로 나눠 선언해야 할 때(입력 검증 DTO vs 응답 DTO)는 **이름을 다르게** 둡니다.
선례: `ChatChannelBotIdentityDto`(입력, 전 필드 optional) vs
`ChatChannelRotateBotIdentityDto`(응답, `botId`·`username` 필수 + provider 부가 필드).

> 강제: `repo-guards/__tests__/dto-class-name-collision.spec.ts` 가 `modules/`·`common/` 의
> `*.dto.ts` 를 AST 로 훑어 중복 0을 고정합니다(2026-09-12 신설 — 이 규칙의 첫 위반이 그
> 가드를 부른 계기입니다).
```

### 변경안 (b) frontmatter `code:` 등재

```diff
   - codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts
+  - codebase/backend/src/repo-guards/__tests__/dto-class-name-collision*.ts
   - codebase/backend/src/shared/testing/response-contract*.ts
```

대조군 fixture 도 같은 이유로 등재한다(기존 주석이 *"없으면 술어가 죽어도 테스트가 통과한다"*
라고 그 관례를 이미 적어 뒀다):

```diff
   - codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load*.ts
+  - codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/*.ts
```

## 4. `chat-channel-adapter.md §1.1.2` 다의성 표 — **네 번째 뜻**

**실측**: 표가 `code` 의 세 뜻을 적는데, Node/undici 시스템 에러(`ENOTFOUND`·`ECONNREFUSED`·
`UND_ERR_*`)도 `.code` 를 갖는다. `telegram-client.ts` 주석이 그 경로의 실재를 이미 적고 있었고,
`#1324` 의 `--impl-prep` 이 **코드를 쓰기 전에** 그 오분류 위험을 잡았다.

### 변경안

```diff
-> **`code` 라는 이름이 이 저장소에서 세 뜻으로 쓰인다 — 혼동하면 조용히 잘못 분기한다.**
+> **`code` 라는 이름이 이 콜스택에서 네 뜻으로 쓰인다 — 혼동하면 조용히 잘못 분기한다.**
 >
 > | 무엇 | 소유 | 값 도메인 |
 > |---|---|---|
 > | **본 절의 `code`** | **어댑터가 새로 throw 하는 `Error` 의 프로퍼티** | 우리 문자열 (`'BOT_TOKEN_INVALID'`) |
 > | [§3.1](#31-execution-failed-분류-알고리즘) 의 `event.error.code` | EIA 이벤트 payload | 실행 실패 분류용 — **별 네임스페이스** |
 > | `app.code` / `res.code` | **provider 원본 API 응답 필드** (Discord) | **숫자** |
+> | **Node/undici 시스템 에러의 `code`** | **런타임이 붙인다 — 우리가 만들지 않는다** | `'ENOTFOUND'` · `'ECONNREFUSED'` · `'UND_ERR_*'` |
 >
 > 세 번째가 특히 가깝다 — discord 어댑터는 이미 `'code' in app` 으로 **원본 응답**을 검사한다.
+>
+> **네 번째는 판별을 뒤집는다.** DNS 가 죽은 `Error` 도 `.code` 를 갖기 때문에 `if (err.code)`
+> 같은 truthiness 판별은 **네트워크 단절을 "토큰이 잘못됐다" 로 보고**한다. 그래서 이 계약의
+> 판별은 **화이트리스트 정확 일치**다 — `err.code === 'BOT_TOKEN_INVALID'`. 구현은 그 오분류를
+> `ENOTFOUND → 502` 캐너리로 고정한다(`chat-channel-input-rules.spec.ts`).
```

## 5. `slack.md §3.1` — 개방형 `...` 를 확정 5값으로

**실측**: 코드가 5값을 확정했다(`slack.adapter.ts` 의 `SLACK_CREDENTIAL_REJECTED_ERRORS`)는데
spec 은 4값 + `...` 로 열어 둔다. **이 목록은 저장소 안에서 실측할 수 없다**(외부 API 응답)라
코드 상수가 사실상 SoT 인데, spec 이 열려 있으면 다음 사람이 임의로 늘린다.

### 변경안

```diff
 # 실패(자격 증명 거부): HTTP **200** + { ok: false, error: 'invalid_auth' | 'not_authed'
-#                                    | 'account_inactive' | 'token_revoked' | ... }
+#                                    | 'account_inactive' | 'token_revoked' | 'token_expired' }
```

그리고 그 아래 한 문단:

```markdown
> **이 5값이 `BOT_TOKEN_INVALID` 판별의 전부다**([CCA §1.1.2](../../../conventions/chat-channel-adapter.md#112-setupchannel-실패-판별--자격-증명-거부는-code-로-선언한다)).
> `ratelimited` 처럼 자격 증명과 무관한 값은 **의도적으로 제외**한다 — *"당신 토큰이 잘못됐다"*
> 를 잘못 말하는 것이 `502`(그 밖의 실패) 보다 나쁘다. 목록을 늘리려면 **Slack 이 문서화한
> 표준 auth 에러**임을 근거로 대고 코드 상수(`SLACK_CREDENTIAL_REJECTED_ERRORS`)와 **함께**
> 늘린다 — 한쪽만 바꾸면 판별이 조용히 갈린다.
```

## 6. `2-api-convention.md §7` — chat-channel per-chat rate limit 행 신설

**실측**: §7 이 *"throttle 수치의 단일 진실은 본 표"* 라고 선언하는데 `CCH-NF-03`(per-chat 분당
60건, 1–600 override)이 없다. 형제 사례(EIA inbound·SSE 동시연결·WS 명령)는 전부 행이 있다.

### 변경안 — §7 표 마지막 행 뒤

```markdown
| Chat Channel inbound (per-chat) | **chat 당** 분당 60건 (기본값. `config.chatChannel.rateLimitPerMinute` 로 1–600 override). 초과분은 **버퍼링 없이 처리 생략** + `chat_channel_health=degraded`. `ChatChannelRateLimiterService`(Redis fixed-window), Redis 미가용 시 **fail-open**. 응답은 telegram-safe `202 Accepted` + `{ executionId: 'ignored' }` — **429 가 아니다**. SoT: [Chat Channel §3.6 CCH-NF-03](./15-chat-channel.md#36-비기능-요구사항) | — (2xx 유지) |
```

> **이 행이 다른 행들과 다른 점을 적는다**: 다른 rate limit 은 초과 시 `429` 인데 이것만
> `202` 다. Telegram 이 비-2xx 를 재시도·webhook 해제로 다루기 때문이고, 근거는 `R-CC-19`.
> 표가 그 예외를 안 적으면 다음 사람이 "429 로 통일" 을 정합성 개선으로 착각한다.

## 7. `3-error-handling.md §1.12` — chat-channel rotate 에러 코드 카탈로그

**실측**: `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` 등 6종이 중앙 카탈로그에 **0건**이다.
`2-api-convention.md §5.3` 이 *"어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다 — 등재되지
않으면 소비자가 존재를 알 방법이 없다"* 라고 규정한다. 형제 도메인(§1.7 webhook · §1.8 KB ·
§1.10 endpointPath · §1.11 AuthConfig)은 전부 등재돼 있다.

### 변경안 — §1.11 뒤에 §1.12 신설 (§1.11 의 형식을 그대로 따른다)

```markdown
### 1.12 Chat Channel bot token 회전 에러 코드 (도메인 spec 참조)

`POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 실패 응답. 정의·트리거 SoT 는
[15-chat-channel.md §5.4](./15-chat-channel.md#54-bot-token-rotation-api-응답-계약) 이고 본 절은
공용 카탈로그 가시성 등재다. `UPPER_SNAKE_CASE` 규약([conventions/error-codes.md](../conventions/error-codes.md)).

| 코드 | status | 설명 | 도메인 SoT |
|------|--------|------|-----------|
| `INVALID_BOT_TOKEN` | **400** | `newBotToken` 누락/비-string (컨트롤러 입력 검증) | [§5.4](./15-chat-channel.md#54-bot-token-rotation-api-응답-계약) |
| `CHAT_CHANNEL_NOT_CONFIGURED` | **400** | `config.chatChannel` 미설정 트리거 | 〃 |
| `CHAT_CHANNEL_PROVIDER_UNKNOWN` | **400** | registry 에 미등록 provider | 〃 |
| `CHAT_CHANNEL_ENDPOINT_REQUIRED` | **400** | trigger `endpointPath` 부재 | 〃 |
| `BOT_TOKEN_INVALID` | **400** | `setupChannel` 이 **자격 증명 거부**로 실패. provider 가 401/403 · `{ok:false,error:'invalid_auth'}`(HTTP 200) · `verify_key` 불일치 중 무엇으로 알리든 같은 분류 — 판별은 어댑터가 [CCA §1.1.2](../conventions/chat-channel-adapter.md#112-setupchannel-실패-판별--자격-증명-거부는-code-로-선언한다) 로 선언한다 | 〃 |
| `CHAT_CHANNEL_SETUP_FAILED` | **502** | 그 밖의 `setupChannel` 실패 — provider 5xx · 네트워크 · 타임아웃. **이 저장소의 첫 502** (근거 [R-CC-23](./15-chat-channel.md#r-cc-23-setupchannel-실패는-transport-가-아니라-원인으로-분류한다)) | 〃 |

> **이름이 두 갈래다** — `INVALID_BOT_TOKEN`(입력 형식)과 `BOT_TOKEN_INVALID`(provider 가 거부).
> 어순만 다르고 뜻이 다르므로 **혼동 주의**. 둘을 합치거나 개명하지 않는 이유는
> `error-codes.md §2`(rename 금지)와 같다 — 이미 wire 에 나간 코드다.
```

## 8. §3.x 절 번호 중복 — **구조 변경을 기각한다. 측정과 함께**

**실측**: 이 문서는 `3.x` 를 두 계층에서 쓴다 — Overview 의 `#### 3.1~3.6`(요구사항)과 본문의
`### 3.1~3.3`(처리 흐름). **앵커는 이미 충돌하지 않는다**(제목이 달라 슬러그가 다르다). 해는
사람이 *"§3.3"* 을 인용할 때 둘 중 어느 쪽인지 모른다는 것이다.

**두 구조 처방의 비용을 셌다** (repo 전체 인바운드 앵커 링크):

| 처방 | 깨지는 링크 | 비고 |
|---|---|---|
| (a) 요구사항을 `## 3` 으로 승격 + 본문 `## 4~9` 로 cascade | **48+** (`#54*` 23 · `#55*` 13 · `#4x` 12) | 코드 주석·CHANGELOG 의 **비-링크 `§5.4` 인용**은 이 수에 안 들어간다 |
| (b) Overview 요구사항 소절 재번호 | **34** (`#34` 17 · `#32` 6 · `#35` 4 · `#33` 3 · `#31` 3 · `#36` 1) | |

두 처방 다 "표시 번호의 미관" 을 위해 34~48개 링크를 건드린다. 이 저장소는 **유한한 문제를
무한한 문제와 바꾸지 않는다**(`#970` push 가드 재작성 철회의 교훈). 그래서:

### 변경안 — 번호는 두고 **인용 규칙**을 못박는다

Overview 요구사항 머리와 본문 처리 흐름 머리 **양쪽**에 한 줄:

```markdown
> **이 문서의 `3.x` 는 두 계층에 있다** — Overview 의 **요구사항** `3.1~3.6`(CCH-* ID 소유)과
> 본문의 **처리 흐름** `3.1~3.3`. 앵커는 제목이 달라 충돌하지 않지만 **번호만으로는 가려지지
> 않는다** — 인용할 때 `§3.4 신뢰성/보안` 처럼 **제목을 함께** 적는다.
> (구조 정렬은 인바운드 앵커 34~48개를 건드리는 일이라 별도 판단으로 미뤘다.)
```

**기각을 기록으로 남긴다** — 이 판단이 없으면 다음 checker 가 같은 지적을 또 하고, 그때마다
같은 측정을 반복한다.

## 9. `R-CC-23` 의 미래형 — 완료 주석

**실측**: *"구현 정정은 developer 후속이다"* 가 현재형으로 남아 있는데 `e4e259530`(#1324)이
그 구현을 끝냈다.

```diff
-몰랐다 — *"문서한 보장이 구현보다 넓으면 안 된다"* 의 사례다. 구현 정정은 developer 후속이다.
+몰랐다 — *"문서한 보장이 구현보다 넓으면 안 된다"* 의 사례다.
+~~구현 정정은 developer 후속이다.~~ **완료** — `e4e259530`(#1324)이 `BadGatewayException`
+배선·`details.reason` 제거·`getStatus()` 단언까지 끝냈다. 남은 한시적 예외(401/403 message
+fallback)의 제거 조건은 [CCA §1.1.2](../conventions/chat-channel-adapter.md#112-setupchannel-실패-판별--자격-증명-거부는-code-로-선언한다) 가 갖는다.
```

## Rationale — 이 배치의 판단 3가지

1. **glob 은 `**/` 로 넓히고 규약은 그대로 둔다.** `#1326` 이 한 번 반대로 갔다가(규약을 어기고
   glob 에 맞춤) 리뷰에서 되돌렸다. **규약이 자리를 정하고 glob 은 그 자리를 덮는 도구**다.
2. **가드에는 규약 문장을 붙인다.** 코드가 강제하는데 문서가 침묵하면 다음 사람이 가드를 지운다.
3. **번호 정렬은 측정으로 기각한다.** 34~48개 링크를 미관 때문에 건드리지 않는다 — 대신 인용
   규칙을 명문화해 실제 해(잘못된 인용)를 막는다.

## 체크리스트

- [x] `/consistency-check --spec` BLOCK: NO — `review/consistency/2026/09/12/18_55_57`
- [x] 1~2 (`15-chat-channel.md`)
- [x] 3 (`swagger.md`)
- [x] 4 (`chat-channel-adapter.md`)
- [x] 5 (`slack.md`)
- [x] 6 (`2-api-convention.md`)
- [x] 7 (`3-error-handling.md`)
- [x] 8~9 (인용 규칙 `R-CC-24` 정식화 · R-CC-23 완료 주석)
- [x] 앵커 무결성 + frontend unit — 21파일 / 3,269 통과 · **새 앵커를 깨뜨려 RED 확인**
- [x] **트래커 종결** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
      다음 항목들을 `[x]` + 완료 메모로 갱신한다(`--spec` plan_coherence WARNING 2 — *"대상
      tracker 를 특정하지 않으면 그 tracker 가 영구 미완료로 남는다"*):
      「`15-chat-channel.md` 의 `code:` glob 이 `dto/responses/` 를 못 잡는다」 ·
      「`swagger.md §5-1` 에 "DTO 클래스명은 저장소 전체에서 유일하다" 규칙이 없다」 ·
      「`slack.md §3.1` 의 개방형 열거를 확정 5값으로」 ·
      「CCA §1.1.2 다의성 표에 Node 시스템 `.code` 행을 추가한다」 ·
      「`2-api-convention.md §7` rate-limit 표에 chat-channel per-chat 행이 없다」 ·
      「`3-error-handling.md §1` 중앙 카탈로그에 chat-channel rotate 에러 코드군이 없다」 ·
      「`15-chat-channel.md` 가 "3.x" 절 번호를 두 계층에서 중복 사용한다」(**기각으로 종결**) ·
      「`15-chat-channel.md §7` 파일 트리가 … 입력으로만 적는다」
      (R-CC-23 미래형 정정은 tracker 에 없던 이 draft 고유 발견 — 별도 메모)
- [x] draft `plan/complete/` 이동 — **이동 뒤 문서 게이트 재실행**


## 반영 결과 (2026-09-12)

`/consistency-check --spec` → `review/consistency/2026/09/12/18_55_57` **BLOCK: NO**
(CRITICAL 0 · WARNING 4 · INFO 4). **WARNING 3건을 draft 보다 넓게 반영했다**:

| # | 지적 | 반영 |
|---|---|---|
| W1 | glob 확장이 `R-CC-22` 의 정량 진술(*"10개를 정확히"*)을 stale 하게 만든다 | **R-CC-22 하단에 재측정 캐비엇**. 정본 매처로 다시 셌다 — 좁은 glob **10 → 11**, 통짜는 결정 당시 **27 → 지금 28**. 그 증가가 *"열거 대신 술어"* 결정의 근거임을 함께 적었다 |
| W2 | 체크리스트가 대상 tracker 를 특정하지 않는다 | 파일 경로 + **8개 항목 제목을 그대로 인용**(줄 번호가 아니라 문구로 — 줄은 밀린다) |
| W3 | `slack.md` 의 `token_expired` 가 `Integration.status_reason` 의 동명 값과 겹친다 | 각주 1줄 — *"글자만 같고 별 네임스페이스"*. 같은 문서가 `TOKEN_EXPIRED` 에 이미 단 각주의 관례를 따랐다 |
| W4 | `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID` 근접 명명 | **수정 불요**(rename 금지). §1.12 콜아웃이 이미 경고 중 — 그 사실을 확인만 했다 |

**항목 8(절 번호)은 기각을 `R-CC-24` 로 정식화했다** — 기각도 결정이므로 Rationale 에 남겨야
다음 checker 가 같은 측정을 반복하지 않는다.

### 검증

- **앵커 가드가 내 새 링크를 실제로 본다** — `§1.12` 가 새로 넣은 앵커 하나를 깨뜨려 **RED** 확인
- 문서 게이트 21파일 / **3,269 통과**(spec-link-integrity · frontmatter · code-paths 포함)
- glob 확장의 과잉 포획 0 — `dto/create-trigger.dto.ts` 미매칭을 정본 매처로 확인
