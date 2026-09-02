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

> 착수 근거: `--impl-prep spec/5-system/` (`review/consistency/2026/09/02/17_13_02`) convention_compliance
> **W1·W2**. `#1266` 구현과 무관한 **선재 규약 갭**이라 그 PR 에 섞지 않고
> [`ws-token-expired-socket-lifetime-impl.md`](./ws-token-expired-socket-lifetime-impl.md) 에
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

### rename 하지 않는 근거

§2 가 *"이름 정확성 향상만을 위한 rename 은 하지 않는다"* 로 이미 결정해 뒀다. 실측 보강:

- **FE 는 이 코드로 분기하지 않는다** (`INVALID_PASSWORD`/`PASSWORD_INVALID`/`PASSWORD_REQUIRED`
  frontend 전수 grep **0건**) — 즉 사내 파급은 작다.
- 그러나 **공개 REST API** 라 외부 소비자의 분기를 관측할 수 없고, e2e 2곳이 값으로 단언한다
  (`users-change-password.e2e-spec.ts:96` · `users-email-change.e2e-spec.ts:101`).
- 이름 정확성 이득 < breaking 비용. §2 의 판단이 이 케이스에도 맞는다.

### 근접 명명은 **3중**이다

`PASSWORD_INVALID` 는 §3 에 등재하지 않는다 — 그 이름은 정확하다(불일치에만 난다). 혼동은
**쌍의 성질**이므로 `INVALID_PASSWORD` 행의 `진실` 칸에서 형제를 지목한다. 기존 행들이 쓰는
방식 그대로다(`already_a_member` 행이 `ALREADY_A_MEMBER` 를 지목하듯).

세 번째 동명이 있다 — `login_history.failure_reason = 'INVALID_PASSWORD'`
(`auth.service.ts:347`). 이것은 **wire 코드가 아니라 감사 사유값**이라 레이어가 다르다.
[`3-error-handling.md §1.2` 주석](../../spec/5-system/3-error-handling.md)이 이미 그렇게 적는다.

## 변경안 — spec **5곳**

> 위 실측을 **끝낸 뒤** 센 값이다. 직전 draft(`spec-draft-ws-badge-flip-tracker-close.md`)에서
> 세지 않고 쓴 숫자를 두 번 틀렸고, 그중 한 번은 **정정하는 편집 안에서** 다시 어긋났다.

| # | 위치 | 변경 |
|---|---|---|
| 1 | `2-api-convention.md` §6 표 | **`202 Accepted` 행 추가** — 비동기 수락(큐 적재). 13 엔드포인트/7 컨트롤러. 본문 §11.4 가 SoT 인 webhook 응답 포함 |
| 2 | 〃 §6 표 | **`410 Gone` 행 추가** — 리소스가 있었으나 소멸·비활성. 발행처 3모듈과 각 코드를 도메인 spec 링크로 지목 |
| 3 | 〃 §5.3 기본값 목록 | 목록 뒤에 **`410` 은 매핑이 없다**는 사실 + *"410 은 코드를 명시해야 한다"* 요구 한 줄. 기본값을 **만들지 않는다** |
| 4 | `conventions/error-codes.md` §3 | **`INVALID_PASSWORD` 행 추가** — 부정확 사유(미설정+불일치 통합), 진실(두 조건), 형제 3종 구분, 근거 링크 |
| 5 | `3-error-handling.md` §1.2 `INVALID_PASSWORD` 행 | 인입 참조 — §3 레지스트리 등재 사실을 한 구절로 추가 (`error-codes.md §1` 이 §1 카탈로그를 SoT 로 선언하는 것의 역방향 포인터) |

## Rationale (본 draft 의 결정 근거)

**왜 §6 에 "이 표는 대표 예시" 라고 적지 않는가** — W1 이 대안으로 제시했다. 채택하지 않는다:
§5.3 이 §6 을 "기본값 SoT" 로 참조하므로, 표를 예시로 격하하면 그 참조가 가리킬 대상이 사라진다.
빠진 두 행을 채우는 쪽이 참조 구조를 보존한다.

**왜 §5.3 에 410 기본값을 만들지 않는가** — 위 결정 ②. 구현에 없는 매핑을 문서가 약속하면,
다음 사람이 그 약속을 믿고 코드를 생략한다. 그 순간 410 이 `INTERNAL_ERROR` 를 싣는다.

**왜 `PASSWORD_INVALID` 는 등재하지 않는가** — §3 은 "부정확한 이름" 의 등록부다.
`PASSWORD_INVALID` 는 부정확하지 않다. 정확한 이름을 예외 레지스트리에 넣으면 레지스트리가
"헷갈리는 이름 모음" 으로 의미가 바뀐다.
