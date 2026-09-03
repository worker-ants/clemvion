---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-02
owner: planner
spec_impact:
  - spec/5-system/2-api-convention.md
  - spec/conventions/error-codes.md
  - spec/5-system/3-error-handling.md
---

# spec draft — §6 상태 코드 표 누락 2종 · `INVALID_PASSWORD` 예외 등재

> ✅ **종결 (2026-09-02)** — 변경안 spec 6곳·plan 3건 전량 반영, `#1268` 머지.
> 후속: 결정③이 등재한 `INVALID_PASSWORD` §3 행은 그 직후 PR 에서 **§5 로 은퇴**했다
> (`changePassword` 가 두 조건을 갈라 부정확의 원인이 사라졌다) — 등재가 뒤집힌 것이 아니라
> 등재가 기록하던 원인이 제거된 것이다.

> 착수 근거: `--impl-prep spec/5-system/` (`review/consistency/2026/09/02/17_13_02`) convention_compliance
> **W1·W2**. `#1266` 구현과 무관한 **선재 규약 갭**이라 그 PR 에 섞지 않고
> [`ws-token-expired-socket-lifetime-impl.md`](../in-progress/ws-token-expired-socket-lifetime-impl.md) 에
> 등재해 뒀던 두 건이다. 둘 다 요구사항·계약 표라 **developer 자기-반증형 소정정 대상이 아니다**.

## 결정 ① — `2-api-convention.md` §6 표에 `202 Accepted`·`410 Gone` 추가

### 실측 — 표에 없는 코드는 정확히 이 둘뿐이다

"두 개가 빠졌다" 를 기억이 아니라 전수로 확인했다. 백엔드가 실제로 발행하는 상태를 **네 축**으로
셌다 (한 축만 보면 다른 축은 무증거로 남는다):

| 축 | 명령 | 결과 |
|---|---|---|
| enum 상수 | `HttpStatus.*` | OK·NO_CONTENT·CREATED·**ACCEPTED**·TOO_MANY_REQUESTS·CONFLICT·SERVICE_UNAVAILABLE·INTERNAL_SERVER_ERROR·BAD_REQUEST |
| 데코레이터 | `@HttpCode(...)` | 200 · **202** |
| 예외 클래스 | `new *Exception` | BadRequest·NotFound·Unauthorized·Conflict·Forbidden·**Gone**·InternalServerError·ServiceUnavailable·PayloadTooLarge·UnprocessableEntity |
| 동적 상태 | `new HttpException(_, status)` 3곳 | 429 ×2 · 캐시 재생(EIA idempotency, 원 응답의 status 를 그대로 replay) — **신규 코드 없음** |

교집합을 §6 표와 대조하면 **미등재는 `202`·`410` 둘뿐**이다. 나머지는 전부 표에 있다.

사용 규모도 "예외적 1회" 가 아니다:

| 코드 | 실측 |
|---|---|
| `202 Accepted` | 컨트롤러 엔드포인트 **13개** / **7개 컨트롤러** (workflows·executions·schedules·knowledge-base·graph·hooks·external-interaction) |
| `410 Gone` | `throw new GoneException` **6곳** / **3개 모듈** (external-interaction·workspaces·hooks) |

### 이 문서가 자기 자신과 어긋나 있다

결정적인 것은 사용량이 아니라 **같은 파일 안의 모순**이다. `2-api-convention.md` 본문이 이미
두 코드를 쓴다:

- `:351` (§11.3) — *"없으면 404, **비활성 410 Gone**"*
- `:355` (§11.3) · `:362` (§11.4) — *"즉시 **202** 응답 반환 (비동기 실행)"*

§6 은 다른 절(§5.3)이 "기본값 SoT" 로 참조하는 캐논 테이블인데, **그 표가 자기 문서 본문이
쓰는 코드를 안 싣고 있다.**

## 결정 ② — §5.3 기본값 목록에 "410 은 기본값이 없다" 를 명시

W1 은 §6 뿐 아니라 **§5.3 도** 지목했다. 처음에 나는 §6 만 고칠 생각이었다 — 지적을 한 칸 좁게
읽은 것이고, 그 좁힘이 아래 실측을 놓칠 뻔했다.

§5.3 의 목록(`400=VALIDATION_ERROR` … `5xx=INTERNAL_ERROR`)은 **`GlobalExceptionFilter.getCodeFromStatus`
의 매핑을 옮긴 것**이다. 그 함수를 열어 보면:

```ts
switch (status) {
  case 400: ... case 401: ... case 403: ... case 404: ...
  case 409: ... case 413: ... case 422: ... case 429: ...
  default:  return 'INTERNAL_ERROR';
}
```

**`case 410` 이 없다.** 즉 코드를 명시하지 않은 `GoneException` 은 `default` 로 떨어져
**410 응답에 `code: "INTERNAL_ERROR"`** 를 싣는다.

> **오늘 버그는 아니다** — 발행 6곳을 전부 열어 확인했고 **모두 코드를 명시**한다
> (`EXECUTION_TERMINATED` ×2 · `invitation_already_used` ×2 · `invitation_expired` · `TRIGGER_INACTIVE`).
> 그래서 이것은 결함 보고가 아니라 **다음 사람이 밟을 자리**의 표시다.

그러므로 §5.3 에 `410=<무언가>` 를 **추가하면 안 된다** — 구현에 없는 기본값을 문서가 약속하는
것이고, 이 저장소가 반복해 데인 "문서한 보장이 구현보다 넓다" 형태다. 대신 **없다는 사실**과
그로부터 나오는 요구("410 은 코드를 명시해야 한다")를 적는다.

## 결정 ③ — `error-codes.md` §3 에 `INVALID_PASSWORD` 등재

### 체커의 제안보다 좁게 간다 — §3 을 확장할 필요가 없다

W2 는 *"§3 를 lowercase 뿐 아니라 '부정확/혼동 소지 이름' 도 다룰 수 있게 **확장**"* 하자고
제안했다. **확장하지 않는다** — 실측해 보니 이 코드는 §3 의 **현행 기준(“이름이 부정확한”)에
이미 해당**한다.

`users.service.changePassword` 는 **두 조건**에 같은 코드를 던진다:

| 조건 | 코드 |
|---|---|
| `passwordHash` 부재 (OAuth-only — 비밀번호가 **아예 없다**) | `INVALID_PASSWORD` |
| 현재 비밀번호 불일치 | `INVALID_PASSWORD` |

이름은 *"입력한 비밀번호가 틀렸다"* 만 말하는데 **비밀번호가 없는 계정**에서도 난다. 그리고
형제 흐름 둘은 바로 그 구분을 **코드로 가른다**:

| 흐름 | 미설정·미입력 | 불일치 |
|---|---|---|
| 민감 동작 재확인 `verifyPasswordForUser` | `PASSWORD_REQUIRED` (401) | `PASSWORD_INVALID` (401) |
| 세션 재인증 `verifyReauth` | `REAUTH_REQUIRED` (400) | `PASSWORD_INVALID` (401) |
| **비밀번호 변경** `changePassword` | **`INVALID_PASSWORD`** (401) | **`INVALID_PASSWORD`** (401) |

즉 §1 위반의 실체는 "단어 순서가 헷갈린다" 가 아니라 **이름이 실제 조건보다 좁다**는 것이다.
그러면 §3 의 기존 컬럼(`이름이 부정확한 이유` / `진실(의미)`)에 그대로 들어간다.

> **왜 이 구분에 공을 들이나** — `#1193` 에서 나는 선례에 없는 근거를 소급 부여했다가 원칙문에
> 내 케이스가 들어갈 자리가 없어 절을 등급으로 쪼개야 했다. 규약을 **넓히는 편집**은 그 규약이
> 다음에 무엇을 막을지를 바꾼다. 넓히지 않고 들어갈 수 있으면 넓히지 않는다.

### rename 하지 않는가 — `--spec` W1 이 내 근거를 반증했다

초판은 *"FE 가 이 코드로 분기하지 않는다(grep 0건)"* 를 근거로 들었다. **그 논법이 틀렸다.**

`error-codes.md §5` 는 바로 그 논법을 등급으로 갈라 놨다. **A(영향 부재 확인)** 은 소비자가
자사 클라이언트뿐일 때만 쓸 수 있고, **B(잔여 위험 인수)** 는 *"저장소 밖 호출자를 원리적으로
배제할 수 없는 표면(워크스페이스 JWT 로 호출 가능한 내부 REST 등)"* 에 붙는다. §5 는 그 둘을
이렇게 못박는다:

> B 는 A 의 완화가 아니라 별개 등급이다. A 는 *"영향이 없다"* 를 주장하고 B 는 *"영향을
> 관측하지 못했다"* 를 주장한다 — 후자는 반증 가능성이 열려 있으므로 **사용자 결정**을 요구한다.

`POST /users/me/change-password` 는 **워크스페이스 JWT 로 호출 가능한 내부 REST 엔드포인트**다 —
정확히 B 등급 표면이다. 따라서 grep 0건은 *"분기가 없다"* 가 아니라 *"분기를 못 찾았다"* 이고,
그것으로 rename 을 정당화하면 `#1193` 이 만든 A/B 구분을 도로 뭉갠다. §5 자신이 *"B 는 예외로
세어야 하지 관행으로 굳혀선 안 된다"* 고 적는다.

> **같은 실수를 `#1193` 에서 이미 했다** — 선례가 "위험 부재 판정" 이었는데 "위험 인수" 로
> 읽었고, 정정하니 §5 를 A/B 로 갈라야 했다. 이번엔 그 갈래를 **내가 만들어 놓고 내 근거에
> 적용하지 않았다.**

정정된 근거는 이렇다:

- **§2 가 이미 결정했다** — *"이름 정확성 향상만을 위한 rename 은 하지 않는다."* 이 케이스의
  이득은 정확성뿐이다.
- **rename 하려면 B 등급 = 사용자 결정이 필요**하고, 그 비용을 정당화할 관측 이득이 없다.
- e2e 는 **1곳**(`users-change-password.e2e-spec.ts:96`)이 이 값을 단언한다.

> **초판은 e2e 를 "2곳" 이라 적었다.** 두 번째로 든 `users-email-change.e2e-spec.ts:101` 은
> 실제로 **`PASSWORD_INVALID`** 를 단언한다 — 내 grep 출력에 그렇게 찍혀 있었는데 반대로
> 옮겼다. 공교롭게도 그 줄은 **형제 코드가 살아 있다는 증거**라, 근거를 정정하니 오히려 두
> 코드가 실제로 갈라져 쓰인다는 사실이 또렷해졌다.

### §2 의 나머지 절반 — "새 코드를 신설한다" 는 왜 지금 적용하지 않는가

§2 는 rename 금지와 함께 *"의미가 분기되거나 새 조건이 생기면 **새 코드를 신설**한다"* 고도
적는다. 초판은 이 절반을 인용하지 않았다(W1).

**적용하지 않는 이유는 트리거가 안 왔기 때문이다** — 지금 의미가 갈라지는 것도, 새 조건이
생기는 것도 아니다. 통합은 **선존 상태**이고 이 draft 는 그것을 문서화할 뿐이다.

**다만 "신설이 옳은 자리" 이기는 하다.** 형제 흐름 둘은 같은 조건을 이미 코드로 가르고 있으니
(`PASSWORD_REQUIRED` · `REAUTH_REQUIRED`), 변경 경로만 그 선례에서 벗어나 있다. 실측한 사용자
영향도 있다:

| 실측 | 값 |
|---|---|
| FE change-password 페이지의 `hasPassword` 게이트 | **없음** — OAuth-only 사용자도 진입 가능 |
| FE 의 에러 표시 | `axiosMessage(err, …)` — **서버 `message` 를 그대로 노출** |
| OAuth-only 사용자가 보는 문구 | *"Current password is incorrect"* — **비밀번호가 없는데 틀렸다고 말한다** |

그래서 `PASSWORD_NOT_SET`(가칭) 신설은 **버려지는 안이 아니라 별개 결정**이다. 이 draft 에
넣지 않는 이유:

1. **B 등급 표면의 wire 코드 변경**이라 사용자 결정이 필요하다(위 §5 인용).
2. backend 코드·테스트·FE 문구가 함께 움직이는 **developer 턴**이다 — 규약 문서 갭 해소와
   섞으면 둘 다 늦어진다.

→ 신규 plan [`auth-change-password-oauth-only-code-split.md`](../in-progress/auth-change-password-oauth-only-code-split.md)
에 결정 항목으로 등재한다. 기존 auth plan(`spec-sync-auth-gaps.md`)에 얹지 않는 이유는
그 문서의 `worktree:` 가 **다른 워크트리**(`trigger-rotation-audit`)라 동시 편집 충돌을
만들기 때문이다.

### 근접 명명은 **3중**이다

`PASSWORD_INVALID` 는 §3 에 등재하지 않는다 — 그 이름은 정확하다(불일치에만 난다). 혼동은
**쌍의 성질**이므로 `INVALID_PASSWORD` 행의 `진실` 칸에서 형제를 지목한다. 기존 행들이 쓰는
방식 그대로다(`already_a_member` 행이 `ALREADY_A_MEMBER` 를 지목하듯).

세 번째 동명이 있다 — `login_history.failure_reason = 'INVALID_PASSWORD'`
(`auth.service.ts:347`). 이것은 **wire 코드가 아니라 감사 사유값**이라 레이어가 다르다.
[`3-error-handling.md §1.2` 주석](../../spec/5-system/3-error-handling.md)이 이미 그렇게 적는다.

## 변경안 — spec **6곳** · plan **3건**

> 위 실측을 **끝낸 뒤** 센 값이다. 직전 draft(`spec-draft-ws-badge-flip-tracker-close.md`)에서
> 세지 않고 쓴 숫자를 두 번 틀렸고, 그중 한 번은 **정정하는 편집 안에서** 다시 어긋났다.

| # | 위치 | 변경 |
|---|---|---|
| 1 | `2-api-convention.md` §6 표 | **`202 Accepted` 행 추가** — 비동기 수락(큐 적재). 13 엔드포인트/7 컨트롤러. 본문 §11.4 가 SoT 인 webhook 응답 포함 |
| 2 | 〃 §6 표 | **`410 Gone` 행 추가** — 리소스가 있었으나 소멸·비활성. 발행처 3모듈과 각 코드를 도메인 spec 링크로 지목한다. **chat-channel 트리거는 비활성이어도 `410` 이 아니라 `202`**(WH-EP-07 예외, R-CC-12)이므로 그 예외를 `15-chat-channel.md` 링크로 위임한다 — 요약이 예외를 복제하지 않는 §10.4 와 같은 방식 (cross_spec INFO#2) |
| 3 | 〃 §5.3 기본값 목록 | 목록 뒤에 **`410` 은 매핑이 없다**는 사실 + *"410 은 코드를 명시해야 한다"* 요구 한 줄. 기본값을 **만들지 않는다** |
| 4 | `conventions/error-codes.md` §3 | **`INVALID_PASSWORD` 행 추가** — 부정확 사유(미설정+불일치 통합), 진실(두 조건), 형제 3종 구분, 근거 링크 |
| 5 | `3-error-handling.md` §1.2 `INVALID_PASSWORD` 행 | 인입 참조 — §3 레지스트리 등재 사실을 한 구절로 추가. **선례**: 같은 문서 `:223` 이 `already_a_member` 쌍에 대해 동일한 §3 역참조를 이미 쓴다 (없는 패턴을 만드는 것이 아니다) |
| 6 | 〃 `## Overview` 문단 | *"외부 표면은 API 규약 기본 코드를 의도적으로 override"* 를 **기본값이 있는 코드에 한정** — `410` 처럼 매핑 자체가 없는 코드는 override 가 아니라 explicit-only 다 (cross_spec INFO#1). 결정②가 만든 인접 부정확이라 같은 PR 에서 닫는다 |

**plan** — 소스 체크박스 전환 (`--spec` W2, 자매 draft 가 정착시킨 관례)

| # | 대상 | 변경 |
|---|---|---|
| 7 | `ws-token-expired-socket-lifetime-impl.md:65` | §6 표 `202`/`410` 미등재 항목 `[x]` — 본 draft 결정①·②가 해소 |
| 8 | 〃 `:69` | `PASSWORD_INVALID`/`INVALID_PASSWORD` 항목 `[x]` — 결정③이 해소. **신설 여부는 미해결**이므로 신규 plan 으로 이월한다는 사실을 함께 적는다 |
| 9 | `auth-change-password-oauth-only-code-split.md` | **신규** — `PASSWORD_NOT_SET` 신설 결정 항목(B 등급 표면·FE 문구 실측 포함) |

## Rationale

본 draft 자체의 결정 근거다(위 §결정 1~3 은 spec 에 반영될 내용).

**왜 §6 에 "이 표는 대표 예시" 라고 적지 않는가** — W1 이 대안으로 제시했다. 채택하지 않는다:
§5.3 이 §6 을 "기본값 SoT" 로 참조하므로, 표를 예시로 격하하면 그 참조가 가리킬 대상이 사라진다.
빠진 두 행을 채우는 쪽이 참조 구조를 보존한다.

**왜 §5.3 에 410 기본값을 만들지 않는가** — 위 결정 ②. 구현에 없는 매핑을 문서가 약속하면,
다음 사람이 그 약속을 믿고 코드를 생략한다. 그 순간 410 이 `INTERNAL_ERROR` 를 싣는다.

**왜 `PASSWORD_INVALID` 는 등재하지 않는가** — §3 은 "부정확한 이름" 의 등록부다.
`PASSWORD_INVALID` 는 부정확하지 않다. 정확한 이름을 예외 레지스트리에 넣으면 레지스트리가
"헷갈리는 이름 모음" 으로 의미가 바뀐다.
