---
title: setupChannel 실패 분류 구현 — typed code · 502 실현 · 원문 echo 중단
status: in-progress
owner: developer
worktree: impl-setup-error-code-ddd078
started: 2026-09-12
spec_impact: none
---

## 왜 이 턴인가

`#1323`(planner) 이 `15-chat-channel.md §5.4` · `chat-channel-adapter.md §1.1.2` ·
`2-api-convention.md §6` · `swagger.md §2-4` 에 계약을 확정했다. **구현이 그것을 따라가는 턴**이다.
spec 은 한 줄도 건드리지 않는다 (`spec_impact: none`).

## 계약 요약 (SoT = spec, 여기 복제하지 않는다)

- `400 BOT_TOKEN_INVALID` ← **자격 증명 거부**. provider 가 무엇으로 알리든 같은 분류.
- `502 CHAT_CHANNEL_SETUP_FAILED` ← 그 밖 (클라이언트가 입력으로 고칠 수 없는 것).
- 판별은 **adapter 가 `Error` 의 `code` 프로퍼티로 선언**. 호출자는 `message` 를 파싱하지 않는다.
- 401/403 fallback 은 **한시적 예외**로 유지.
- 응답 본문에 **provider 원문을 싣지 않는다** — 고정 message + code 만, 원문은 서버 로그.

## 작업 5건

| # | 파일 | 무엇 |
|---|---|---|
| 1 | `chat-channel-input-rules.ts` | `translateSetupChannelError` — `code` 우선 판별 · `BadGatewayException`(502) · `details.reason` 제거 |
| 2 | `slack.adapter.ts` | `auth.test` 실패에 `code` 부착 (자격 증명 값 한정) |
| 3 | `discord.adapter.ts` | message 접두 → `code` 교체 |
| 4 | `telegram.adapter.ts` | 401/403 경로에 `code` 부착 |
| 5 | `triggers.controller.ts` | `@ApiBadGatewayResponse` (+ `@ApiBadRequestResponse` — §5.4 가 **가르는** 두 축이라 함께) |
| 6 | `backend-labels.ts` | `BOT_TOKEN_INVALID` 한국어 안내에서 *"(제공자 인증 401/403)"* 제거 |

> **6행은 착수 후에 추가됐다** (`/ai-review` scope INFO). 위 5건은 planner 계약이 지목한 파일이고,
> 6행은 그 계약이 *"transport 로 분류하지 않는다"* 로 바뀌면서 **사용자 노출 문구가 거짓이 된**
> 자리다 — Slack/Discord 경로 사용자에게 401/403 은 화면에도 로그에도 없는 숫자다.
>
> **리뷰 후속으로 더 붙은 것** (`review/code/2026/09/12/13_41_55` RESOLUTION):
> `http-exception.filter.spec.ts`(502 통과 캐너리) · `CHANGELOG.md`(breaking 공지) ·
> 유저가이드 `{slack,discord}{,.en}.mdx` 4파일 · `discord-client.spec.ts`(뮤테이션 생존 자리).

## 설계 판단 — 착수 전에 정한다

### (a) 원문 로깅은 **호출자**가 한다 — 순수 함수에 logger 를 주지 않는다

계약이 *"원문은 서버 로그"* 라고 하지만 `translateSetupChannelError` 는
`chat-channel-input-rules.ts` 의 **순수 함수**다(의존 0 — 그게 `#1319` T1 의 이동 근거였다).
logger 를 인자로 받거나 모듈에 `new Logger()` 를 두면 그 파일의 성격이 깨진다.

→ **호출자(`TriggersService.rotateBotToken`)가 `this.logger.warn` 으로 원문을 남기고** 변환 함수는
순수하게 유지한다. 호출부가 한 곳뿐이므로 중복 위험도 없다.

### (b) `code` 를 어떻게 싣는가 — `Error` 서브클래스가 아니라 **프로퍼티**

spec §1.1.2 는 *"`code: 'BOT_TOKEN_INVALID'` 프로퍼티를 가진 에러"* 라고만 정한다.
서브클래스(`class BotTokenInvalidError extends Error`)는 adapter 3종이 공통 타입을 import 해야
하고, 그러면 `chat-channel/` → 공통 모듈 의존이 하나 늘어난다. **프로퍼티 부착**은 그런 결합이
없고 `unknown` 에서 좁히는 판별도 한 줄이다.

→ 작은 헬퍼 하나를 `chat-channel/types.ts`(이미 adapter 3종이 공유)에 둔다:
`credentialRejected(message)` 가 `code` 를 단 `Error` 를 만든다. **문자열 리터럴 3벌을 막는다.**

### (c) Slack 의 어느 `result.error` 가 자격 증명 거부인가 — **열거하고 나머지는 502**

`authTest` 실패의 `error` 는 Slack 이 채우는 문자열이다. 자격 증명 축만 고른다:
`invalid_auth` · `not_authed` · `account_inactive` · `token_revoked` · `token_expired`.

**`ratelimited` 등은 제외한다** — 자격 증명 문제가 아니다. 그리고 **모르는 값은 502 로 둔다**:
*"당신 토큰이 잘못됐다"* 를 잘못 말하는 것이 현행 동작(502)보다 나쁘다. 즉 **열거에 없으면
동작이 지금과 같다** — 변경의 blast radius 가 열거한 5값으로 한정된다.

> 이 목록은 Slack 이 문서화한 표준 auth 에러다. **이 저장소 안에서 실측할 방법이 없다**(외부 API
> 응답이다) — 그래서 목록을 코드에 상수로 두고 **출처를 주석에 적는다.** 빠진 값이 나중에
> 드러나면 그 상수 한 곳만 늘린다.

### (d) `discord.adapter.ts` 의 **기존 `code` 필드와 헷갈리지 않는다**

그 파일은 이미 `'code' in app` 으로 **Discord 원본 응답의 숫자형 `code`** 를 검사한다
(spec §1.1.2 의 3중 네임스페이스 표). 내 `code` 는 **우리가 만드는 `Error` 의 프로퍼티**다 —
헬퍼를 쓰면 그 자리에서 두 개가 섞이지 않는다.

### (e) 502 경로는 **한 번도 지나간 적이 없다** — 필터를 실측한다

`BadGatewayException` 사용례가 저장소에 0건이었다. `http-exception.filter` 가 502 를 표준
`{ error: { code, message } }` 봉투로 싸는지 **직접 확인**한다 — 안 싸면 응답 형태가 갈린다.

## 증거 — 이 PR 은 **동작을 바꾼다**. 캐너리가 뒤집히는 것이 의도다

`chat-channel-input-rules.spec.ts` 의 *"discord verify_key → 502"* 캐너리가 **RED 가 되어야**
한다. 그 자리를 다음으로 교체한다:

- verify_key 불일치 → **400** `BOT_TOKEN_INVALID`
- **Slack `invalid_auth` → 400** ← 이 PR 의 실질 동기
- `ECONNRESET` → **502**(status 단언 포함 — 지금 아무도 `getStatus()` 를 안 본다)
- `details.reason` **부재** 단언

> **인접 백로그 (d) 를 같은 커밋에서 처리한다** — 트래커의 *"`chat-channel-input-rules.spec.ts`
> 잔여 보강 5건"* 중 (d)(`translateSetupChannelError` 의 non-Error 입력 분기 + `details.reason`
> 값 단언)이 같은 블록이다. (d) 의 뜻은 이 결정으로 바뀌어 **원문이 아니라 부재**를 단언한다.

## 순서

1. `--impl-prep` BLOCK: NO
2. (e) 필터 502 실측 → 결과에 따라 (1) 설계 확정
3. 헬퍼 + 4파일 + 컨트롤러 → 4단계
4. 캐너리 교체 + 뮤테이션
5. `/ai-review` + `--impl-done` → push → PR

## 체크리스트

- [x] `/consistency-check --impl-prep` — `review/consistency/2026/09/12/12_54_15` BLOCK: NO
- [x] (e) `http-exception.filter` 의 502 처리 실측 — `exception.getStatus()` + `resp.code` 라
      **필터 변경 불요**. `getCodeFromStatus` 에 502 행이 없지만 `code` 를 항상 실으므로 도달
      불가 → 후속 등재
- [x] (1) `translateSetupChannelError` + 호출자 로깅
- [x] (2)(3)(4) adapter 3종 `code` 부착 (헬퍼 경유)
- [x] (5) `@ApiBadGatewayResponse` (+ `@ApiBadRequestResponse`)
- [x] 캐너리 뒤집기 + `getStatus()` 단언 + `details.reason` 부재 + 인접 백로그 (d)
- [x] 뮤테이션 8종 — 8/8 RED. **1종은 처음에 생존**했다(discord-client `status` 배선) →
      `discord-client.spec.ts` 신설 후 재측정 RED
- [x] `run-test-all.sh` (신규 도구 — `#1322`) — ALL PASS (lint·unit·build·e2e 305)
- [x] 타입체크 ratchet 2종 — `build` 단계에 포함. backend 197건/36파일 baseline 일치
      (경유 중 TS2322·TS2352 각 1건을 **이 게이트가 잡았다** — lint·jest 는 통과했다)
- [x] `/ai-review` — `review/code/2026/09/12/13_41_55` CRITICAL 0 · WARNING 7 → RESOLUTION
- [ ] `--impl-done` BLOCK: NO
- [ ] 트래커 항목 종결 + 잔여 등재
- [ ] `plan/complete/` 이동

> **완료 시 착수 신호가 켜지는 다른 항목** (`--impl-prep` WARNING 4): 트래커
> `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 **「CCA §1.1.2 의 401/403
> fallback 제거 판정」** 은 *"v1 provider 3종이 모두 `code` 를 부착하면"* 을 착수 신호로
> 적어 뒀고 이 PR 이 그 신호를 켠다. **판정 결과까지 미리 적지는 않는다** — 실측상 아직
> 제거하면 안 된다(그 근거는 트래커 항목 본문에 옮겼다).
