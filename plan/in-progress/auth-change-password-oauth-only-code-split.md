---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-02
owner: planner
status: in-progress
priority: P3
spec_impact:
  - spec/5-system/1-auth.md
  - spec/5-system/3-error-handling.md
  - spec/conventions/error-codes.md
---

# `change-password` 의 OAuth-only 조건에 별도 코드를 신설할 것인가 (`PASSWORD_NOT_SET`)

> 출처: `--spec` W1 (`review/consistency/2026/09/02/20_43_54`). 그 라운드의 target 이었던
> [`spec-draft-api-convention-status-and-password-codes.md`](./spec-draft-api-convention-status-and-password-codes.md)
> 는 `INVALID_PASSWORD` 를 `error-codes.md §3` 에 **등재**하는 데까지만 갔고,
> **신설 여부는 열어 둔 채** 여기로 이월한다.

## 무엇이 문제인가

`users.service.changePassword` 는 **서로 다른 두 조건**에 같은 코드를 던진다.

| 조건 | 발행 코드 |
|---|---|
| `passwordHash` 부재 — OAuth-only, **비밀번호가 아예 없다** | `INVALID_PASSWORD` |
| 현재 비밀번호 불일치 | `INVALID_PASSWORD` |

형제 흐름 둘은 **같은 구분을 이미 코드로 가른다**:

| 흐름 | 미설정·미입력 | 불일치 |
|---|---|---|
| `AuthService.verifyPasswordForUser` (민감 동작 재확인) | `PASSWORD_REQUIRED` (401) | `PASSWORD_INVALID` (401) |
| `SessionsService.verifyReauth` (세션 재인증) | `REAUTH_REQUIRED` (400) | `PASSWORD_INVALID` (401) |
| **`UsersService.changePassword`** | **`INVALID_PASSWORD`** (401) | **`INVALID_PASSWORD`** (401) |

## 사용자 영향 — 실측 (2026-09-02)

이 항목이 "이론상 정합성" 이 아니라는 근거다.

| 실측 대상 | 값 |
|---|---|
| FE `change-password` 페이지의 `hasPassword`/`passwordHash` 게이트 | **없음** (grep 0건) — OAuth-only 사용자도 진입한다 |
| FE 의 에러 표시 경로 | `toast.error(axiosMessage(err, …))` — **서버 `message` 를 그대로 노출** |
| 그때 OAuth-only 사용자가 보는 문구 | `"Current password is incorrect"` |

즉 **비밀번호를 한 번도 설정한 적 없는 사용자에게 "현재 비밀번호가 틀렸다"** 고 말한다.

## 왜 즉시 하지 않는가

1. **B 등급 표면이다.** `POST /users/me/change-password` 는 워크스페이스 JWT 로 호출 가능한
   내부 REST 라 저장소 밖 호출자를 원리적으로 배제할 수 없다 —
   [`error-codes.md §5`](../../spec/conventions/error-codes.md) 의 등급 B. wire 코드가 바뀌는
   변경은 **사용자 결정**을 요구하고, §5 는 *"B 는 예외로 세어야 하지 관행으로 굳혀선 안 된다"*
   고 적는다.
2. **developer 턴이 필요하다.** backend 분기·단위/e2e 테스트·FE 문구가 함께 움직인다.
   규약 문서 갭 해소(`#1267` 후속 PR)와 섞으면 둘 다 늦어진다.

## 선택지

| 안 | 내용 | 비용 | 남는 문제 |
|---|---|---|---|
| **A. 현상 유지** | `§3` 등재로 끝 (이미 반영됨) | 0 | OAuth-only 문구가 계속 틀리다 |
| **B. `PASSWORD_NOT_SET` 신설** | 미설정 조건만 신규 401 코드로 분리. 형제 `PASSWORD_REQUIRED` 와 대칭 | backend 분기 + 테스트 + FE 문구 + spec 3곳 | wire 변경 = B 등급, 사용자 결정 필요 |
| **C. 메시지만 분기** | 코드는 그대로, `message` 만 조건별로 다르게 | 작다 | `message` 는 계약이 아니다(§1 — 클라이언트는 **코드**로 분기). i18n 도 FE 가 아니라 서버 문구에 갇힌다 |

**권장: B.** 형제 두 흐름이 이미 같은 구분을 코드로 가르고 있어 **선례가 있고**, 신설은 rename
이 아니라 **추가**라 §2 의 "이름 정확성만을 위한 rename 금지" 에 걸리지 않는다. 다만 OAuth-only
케이스에 한해 응답 코드가 바뀌므로 **사용자 승인 후** 착수한다.

## 할 일

- [ ] 사용자 결정 — A / B / C 택일 (B 권장)
- [ ] (B 인 경우) `spec/5-system/1-auth.md` — `change-password` 실패 코드 서술을 두 조건으로 분리
- [ ] (B 인 경우) `spec/5-system/3-error-handling.md §1.2` — `PASSWORD_NOT_SET` 등재
- [ ] (B 인 경우) `spec/conventions/error-codes.md §3` — `INVALID_PASSWORD` 행의 "부정확 사유" 를
      *"미설정 조건이 분리돼 해소됨"* 으로 갱신 (행을 지우지 않는다 — 불일치 케이스는 그대로 남는다)
- [ ] (B 인 경우) developer 턴 — backend 분기·테스트·FE 문구
