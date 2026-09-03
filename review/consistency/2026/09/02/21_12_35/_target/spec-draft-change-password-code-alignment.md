---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-02
owner: planner
spec_impact:
  - spec/5-system/1-auth.md
  - spec/5-system/3-error-handling.md
  - spec/conventions/error-codes.md
  - spec/2-navigation/9-user-profile.md
---

# spec draft — `change-password` 실패 코드를 형제 흐름과 정렬

> 착수 근거: [`auth-change-password-oauth-only-code-split.md`](./auth-change-password-oauth-only-code-split.md)
> 의 사용자 결정(2026-09-02) — **선택지 1 "형제와 완전 정렬"**.
>
> `#1268` 이 `INVALID_PASSWORD` 를 `error-codes.md §3` 에 *"이름이 실제 조건보다 좁다"* 로
> 등재했다. 본 draft 는 **그 부정확의 원인 자체를 제거**한다.

## 배경 — 같은 검증이 두 곳에 있고 한쪽만 조건을 뭉갠다

| 흐름 | 미설정(OAuth-only) | 불일치 |
|---|---|---|
| `AuthService.verifyPasswordForUser` (2FA 비활성화·WebAuthn 관리) | `PASSWORD_REQUIRED` 401 | `PASSWORD_INVALID` 401 |
| `SessionsService.verifyReauth` (세션 재인증·이메일 변경) | `REAUTH_REQUIRED` 400 | `PASSWORD_INVALID` 401 |
| **`UsersService.changePassword`** | **`INVALID_PASSWORD` 401** | **`INVALID_PASSWORD` 401** |

`changePassword` 는 형제 헬퍼를 **재사용하지 않고 중복 구현**했고(같은 `findById` +
`passwordHash` 검사 + `comparePassword`), 그 과정에서 두 조건을 한 코드로 합쳤다.

## 왜 지금 고치나 — 사용자에게 보이는 결함이다 (실측)

| 실측 대상 | 값 |
|---|---|
| `GET /users/me` 등이 노출하는 "비밀번호 보유" 신호 | **없음** (backend·frontend 전수 grep 0건) |
| FE `change-password` 페이지의 진입 게이트 | **없음** — OAuth-only 사용자도 들어온다 |
| FE 의 에러 표시 | `toast.error(axiosMessage(err, …))` — 서버 `message` 그대로 |
| 그때 나오는 문구 | `"Current password is incorrect"` |

**비밀번호를 한 번도 설정한 적 없는 사용자에게 "현재 비밀번호가 틀렸다" 고 말한다.** 게다가
FE 가 분기할 다른 신호가 없으므로 **에러 코드가 유일한 신호**다 — 코드가 두 조건을 합치는 한
클라이언트는 원리적으로 이 둘을 구분할 수 없다.

## 결정 ① — 두 조건을 형제 코드로 정렬한다 (신규 코드 0)

| 조건 | 현행 | 변경 후 |
|---|---|---|
| `passwordHash` 부재 (OAuth-only) | `INVALID_PASSWORD` 401 | **`PASSWORD_REQUIRED` 401** |
| 현재 비밀번호 불일치 | `INVALID_PASSWORD` 401 | **`PASSWORD_INVALID` 401** |
| 사용자 미존재 | `USER_NOT_FOUND` 404 | **변경 없음** (아래) |

**새 코드를 만들지 않는다.** 원안은 `PASSWORD_NOT_SET` 신설이었는데, `PASSWORD_REQUIRED` 가
카탈로그에 이미 *"비밀번호 미설정(OAuth-only)·미입력"* 401 로 정의돼 있다. 신설하면
`PASSWORD_*` 근접 명명이 **3종에서 4종으로 늘어** — 이 작업이 없애려던 문제를 키운다.

§1 이 *"구현 세부·전이적 맥락(어느 코드 경로에서 났는지)을 이름에 박지 않는다"* 고 하므로,
`PASSWORD_REQUIRED` 를 `verifyPasswordForUser` 전용으로 묶어 둘 이유가 애초에 없다.

### `USER_NOT_FOUND`(404)는 건드리지 않는다

형제 헬퍼는 `!user` 를 `PASSWORD_REQUIRED` 로 접어 넣지만 `changePassword` 는 404 를 낸다.
**정렬 대상은 비밀번호 두 분기이지 그 바깥이 아니다** — 접으면 승인받지 않은 breaking 을 하나
더 만들고, 404 쪽이 정보량도 많다. 인증된 라우트라 `!user` 는 JWT 가 삭제된 사용자를 가리키는
경우뿐이다.

## 결정 ② — `INVALID_PASSWORD` 는 §3 에서 빼고 §5 로 은퇴시킨다 (등급 B)

§3 은 **"부정확한 이름이나 *유지*되는 active 코드"** 의 등록부다. 이 코드는 더 이상 wire 로
발행되지 않으므로 §3 대상이 아니다 — `#1268` 이 넣은 행을 **빼고** §5 로 옮긴다.

> **어제 넣은 행을 오늘 빼는 게 낭비가 아니다.** §3 등재는 *"부정확하지만 유지한다"* 는
> 판단이었고, 사용자 결정이 그 전제(유지)를 바꿨다. 판단의 이력은 §5 행이 이어받는다.

### 등급은 B — A 로 적을 수 없다

`POST /users/me/change-password` 는 워크스페이스 JWT 로 호출 가능한 내부 REST 라 저장소 밖
호출자를 원리적으로 배제할 수 없다. 저장소 grep 에서 client 분기가 안 나오는 것은
*"부재"* 가 아니라 *"미발견"* 이다. §5 는 그 상태를 **B(잔여 위험 인수)** 로 규정하고
**사용자 결정**을 요구하며, 그 결정은 2026-09-02 에 받았다.

> §5 는 *"B 는 예외로 세어야 하지 관행으로 굳혀선 안 된다"* 고 적는다. 이 행이 **두 번째
> B** 다(첫 사례 `INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`, `#1193`). 두 번째가 생겼다는
> 사실 자체를 §5 에 적어 다음 사람이 개수를 볼 수 있게 한다.

### §5 전제 하나가 이 행에서는 성립하지 않는다

§5 머리말은 *"구 코드는 더 이상 발행되지 않으며(**코드베이스에서 완전 제거**)"* 라고 적는다.
이 행에서는 **틀린다** — `INVALID_PASSWORD` 문자열은 `login_history.failure_reason` 의
**감사 사유값**으로 계속 살아 있다([1-data-model §2.18.2](../../spec/1-data-model.md) ·
[data-flow/2-auth](../../spec/data-flow/2-auth.md)). wire 코드와 **레이어가 다르다.**

그러니 §5 행에 그 사실을 명시한다. 안 적으면 다음 사람이 "은퇴했으니 전부 지우자" 며
감사값까지 건드린다 — 그건 `login_history` enum 변경이라 전혀 다른 작업이다.

## 결정 ③ — OAuth-only 사용자에게 **되는 경로**를 알려준다

새 문구는 "비밀번호가 없다" 로 끝나면 안 된다. §1.1.A 가 이미 경로를 문서화한다:

> OAuth 가입 (no password) → forgot-password 가 동일하게 토큰 발급 —
> **opt-in "비밀번호 추가" 경로로 작동** → reset-password 가 `password_hash` 를 NULL→신규로 채움

구현도 확인했다 — `forgotPassword`·`resetPassword` 어디에도 `passwordHash` 전제 검사가 없다.
따라서 안내는 **비밀번호 재설정(추가) 경로**를 가리킨다.

> **유저 가이드가 이와 반대로 적고 있다** — `password-and-sessions.mdx:80` 이
> *"소셜 로그인 계정의 비밀번호를 직접 설정하는 기능은 현재 제공되지 않아요"* 라고 한다.
> 같은 파일 `:139` 는 *"먼저 비밀번호를 설정하거나"* 라고 해 **자기 자신과도 어긋난다.**
> 이건 `codebase/` 라 developer 턴에서 ko/en 함께 정정한다.

## 변경안

**spec**

| # | 위치 | 변경 |
|---|---|---|
| 1 | `1-auth.md:339` 비밀번호 변경 실패 코드 note | 두 조건을 분리해 형제와 **같은 코드**임을 명시. "별개 wire 코드" 서술은 감사값에만 남긴다 |
| 2 | 〃 `:521` 민감 동작 재확인 코드 note | `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 의 발행처에 `changePassword` 추가 — 이제 `verifyPasswordForUser` 전용이 아니다 |
| 3 | 〃 `:750` OAuth-only 정책 note | `PASSWORD_REQUIRED` 로 차단 + **§1.1.A 비밀번호 추가 경로** 링크 |
| 4 | `3-error-handling.md:50` §1.2 `INVALID_PASSWORD` 행 | **제거** — wire 코드 은퇴. 감사 사유값 존속 사실은 `:70` 주석이 계속 소유 |
| 5 | 〃 `:66` `PASSWORD_INVALID` 행 | 발행처에 `changePassword` 추가 |
| 6 | 〃 `:67` `PASSWORD_REQUIRED` 행 | 발행처에 `changePassword` 추가 |
| 7 | 〃 `:70` 근접 명명 주석 | **4중 → wire 2종 + 감사값 1종**. `INVALID_PASSWORD` 는 wire 에서 사라지고 감사값으로만 남는다는 것이 요지 |
| 8 | 〃 `## Rationale` | 원문 이력 보존 + **후속 갱신 bullet** 신설 (#882/#887 계보가 `INVALID_PASSWORD` 등재로 끝났는데 그 등재가 본 PR 로 은퇴한다 — 계보를 끊지 않는다) |
| 9 | `error-codes.md §3` | `INVALID_PASSWORD` 행 **제거** (`#1268` 이 넣은 행) |
| 10 | 〃 §5 표 | **행 추가** — 구 `INVALID_PASSWORD` → 대체 `PASSWORD_REQUIRED`+`PASSWORD_INVALID`, **[등급 B]**, 감사값 존속 명시 |
| 11 | 〃 §5 등급 설명 | **두 번째 B 사례**임을 한 구절로 — §5 자신이 "예외로 세어야" 라고 요구하므로 개수가 보여야 한다 |
| 12 | `9-user-profile.md:147` 비밀번호 변경 행 | OAuth-only 진입 시 안내 분기 한 줄 (화면 흐름 서술) |

**plan**

| # | 대상 | 변경 |
|---|---|---|
| 13 | `auth-change-password-oauth-only-code-split.md` | 사용자 결정(선택지 1) 기록 + 체크박스 전환. 구현까지 끝나면 `complete/` 이동 |

**codebase** (developer 턴 — 본 draft 범위 밖, 인계 목록)

- `users.service.ts changePassword` 두 분기 코드·문구 + JSDoc
- 두 발행 지점이 **같은 상수**를 쓰도록 — 이 drift 가 처음 생긴 자리가 "각자 문자열 리터럴" 이다
- 단위·e2e 테스트 (`users-change-password.e2e-spec.ts:96` 이 옛 값을 단언 중)
- 유저 가이드 `password-and-sessions.mdx` ko/en `:80` 사실 오류 정정

## Rationale

**왜 §3 행을 지우고 §5 로 옮기는가** — 두 절의 목적 레이어가 다르다. §3 은 *유지되는* 부정확
이름, §5 는 *은퇴한* 코드. 같은 코드가 둘 다에 있으면 다음 사람은 "아직 발행되나" 를 표에서
읽어낼 수 없다. §3 머리말이 그 경계를 이미 못박고 있다.

**왜 감사 사유값을 함께 정리하지 않는가** — `login_history.failure_reason` 은 wire 계약이
아니라 저장된 감사 데이터이고, 값을 바꾸면 **기존 행의 의미가 소급으로 갈린다**. §1.2 카탈로그
주석도 둘을 이미 다른 레이어로 다룬다. 여기서 넓히지 않는다.

**왜 문구까지 이 draft 가 정하는가** — 코드만 갈라 놓고 문구를 두면 사용자가 보는 결함은
그대로다. FE 가 서버 `message` 를 그대로 노출한다는 것이 실측이므로, 문구는 구현 자유도가
아니라 **관측 가능한 계약**이다.
