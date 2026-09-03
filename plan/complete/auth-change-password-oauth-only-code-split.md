---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-02
owner: planner
status: complete
priority: P3
spec_impact:
  - spec/5-system/1-auth.md
  - spec/5-system/3-error-handling.md
  - spec/conventions/error-codes.md
  - spec/2-navigation/9-user-profile.md
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

## 왜 `#1268` 안에서 즉시 하지 않았나 (이력)

> 아래는 **분리 등재 시점의 판단**이다. 사용자 결정(2026-09-02)으로 착수가 승인됐으므로
> 지금은 진행 중이며, 1번(등급 B)은 그대로 유효해 `§5` 행의 근거로 이어진다.

1. **B 등급 표면이다.** `POST /users/me/change-password` 는 워크스페이스 JWT 로 호출 가능한
   내부 REST 라 저장소 밖 호출자를 원리적으로 배제할 수 없다 —
   [`error-codes.md §5`](../../spec/conventions/error-codes.md) 의 등급 B. wire 코드가 바뀌는
   변경은 **사용자 결정**을 요구하고, §5 는 *"B 는 예외로 세어야 하지 관행으로 굳혀선 안 된다"*
   고 적는다.
2. **developer 턴이 필요하다.** backend 분기·단위/e2e 테스트·FE 문구가 함께 움직인다.
   규약 문서 갭 해소(`#1267` 후속 PR)와 섞으면 둘 다 늦어진다.

## 선택지 — 검토한 4안 (D 채택)

> **표를 사후 재작성했다.** 초판은 A/B/C 만 담고 **B 를 권장**했는데, 착수 직전 실측이 그
> 권장을 뒤집어 D 가 나왔다. 표를 그대로 두면 다음 사람이 폐기된 권장(B)을 읽는다
> (`--spec` CRITICAL #1).

| 안 | 내용 | 처분 |
|---|---|---|
| A. 현상 유지 | `§3` 등재로 끝 | **기각** — OAuth-only 문구가 계속 틀리다 |
| B. `PASSWORD_NOT_SET` 신설 | 미설정 조건만 신규 401 코드로 분리 | **기각** (초판 권장 → 폐기, 아래 §결정 기록) |
| C. 메시지만 분기 | 코드는 그대로, `message` 만 조건별로 | **기각** — `message` 는 계약이 아니다(§1: 클라이언트는 **코드**로 분기). FE 가 분기할 다른 신호도 없다(`hasPassword` 미노출, 실측) |
| **D. 형제 코드 재사용 — 신규 코드 0** | 미설정→`PASSWORD_REQUIRED`, 불일치→`PASSWORD_INVALID`. `INVALID_PASSWORD` 는 wire 은퇴(§5 등급 B) | **채택** (사용자 결정 2026-09-02) |

## 결정 기록 (2026-09-02) — D. 형제와 완전 정렬

| 조건 | 현행 | 결정 |
|---|---|---|
| `passwordHash` 부재 (OAuth-only) | `INVALID_PASSWORD` 401 | **`PASSWORD_REQUIRED` 401** |
| 현재 비밀번호 불일치 | `INVALID_PASSWORD` 401 | **`PASSWORD_INVALID` 401** |
| 사용자 미존재 | `USER_NOT_FOUND` 404 | **변경 없음** — 정렬 대상은 비밀번호 두 분기뿐 |

`INVALID_PASSWORD` 는 wire 에서 은퇴해 `error-codes.md §5` **등급 B** 로 간다(사용자 결정이
그 등급의 요건). `login_history.failure_reason` 의 동명 감사값은 **레이어가 달라 존속**한다.

### 왜 초판 권장 B 를 거부했는가

착수 직전 두 가지를 실측했고 **둘 다 B 에 불리했다.**

1. **신설이 필요 없다.** `PASSWORD_REQUIRED` 가 카탈로그에 이미
   *"비밀번호 미설정(OAuth-only)·미입력"* 401 로 정의돼 있다. §1 이
   *"구현 세부·전이적 맥락을 이름에 박지 않는다"* 고 하므로 그 코드를
   `verifyPasswordForUser` 전용으로 묶어 둘 근거가 애초에 없었다. 신설하면 `PASSWORD_*`
   근접 명명이 3종→**4종**으로 늘어 이 작업이 없애려던 문제를 키운다.

2. **`PASSWORD_NOT_SET` 은 이미 쓰이고 있다.** `login_history.failure_reason` 감사값으로
   **존재한다**(`auth.service.ts:330`, 실측). 그 이름으로 wire 코드를 신설했다면
   `INVALID_PASSWORD` 가 지금 겪는 **wire/audit 동명 충돌을 그대로 재생산**했을 것이다 —
   고치려던 병을 새 코드에 옮겨 심는 셈이다.

> 2번은 `--spec` naming_collision(INFO#5)이 알려줬다. 나는 1번만 근거로 들고 있었다.

### `changePassword` 가 왜 이렇게 됐나

형제 헬퍼(`AuthService.verifyPasswordForUser`)를 **재사용하지 않고 중복 구현**했다 — 같은
`findById` + `passwordHash` 검사 + `comparePassword` 를 다시 쓰면서 두 조건을 한 코드로
합쳤다. 그래서 구현 단계에서 **두 발행 지점이 같은 상수를 쓰도록** 묶는다(리터럴 중복이
drift 의 원인이다).

> ~~`UsersService` 는 `AuthService` 를 주입할 수 없으므로(순환) 헬퍼 통합이 아니라 코드 상수
> 공유로 간다.~~ — **이 근거는 틀렸다** (`--impl-done` WARNING, 2026-09-03). `UsersModule` 은
> 이미 `forwardRef(() => AuthModule)` 을 import 하고 `UsersController` 가 그 방식으로
> `AuthService` 를 주입한다(refactor 04 A-1). 저장소 전체에서 `forwardRef` 를 쓰는 파일이
> **34개**다 — 주입은 **가능하다.**

헬퍼가 아니라 **코드 상수만** 공유하는 실제 이유는 셋이다:

1. **조회가 2회가 된다** — `verifyPasswordForUser` 는 `findById` 를 스스로 하는데
   (`auth.service.ts:71`) `changePassword` 는 이미 `user` 를 들고 있다(`users.service.ts:278`).
2. **`!user` 처방이 다르다** — 그 헬퍼는 `PASSWORD_REQUIRED` 로 접지만 변경 경로는
   `USER_NOT_FOUND`(404)를 유지한다(사용자 승인 범위 밖이라 건드리지 않는다).
3. **안내 문구가 흐름마다 다르다** — OAuth-only 에게는 비밀번호 추가 경로를 안내해야 한다.

**교훈**: "구조적으로 불가능하다" 는 검증 가능한 주장이고, 나는 그걸 확인 없이 세 곳
(spec·JSDoc·이 문서)에 썼다. 게이트가 한 번에 셋을 반증했다.

## 검증 — 뮤테이션 (2026-09-02, 구현 후)

**예측을 먼저 적고 실측했다.** 넷 다 예측대로 RED 다.

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M1 미설정 분기를 다시 `INVALID` 로 (= 종전 상태 복원) | RED | **RED 2** (전용 테스트 + 대조군) |
| M2 공용 상수 값 드리프트 (`PASSWORD_REQUIRED`→`PASSWORD_REQD`) | RED, **두 파일 모두** | **RED 3** — `users.service.spec` 1 · `auth.service.spec` 2 |
| M3 OAuth-only 메시지에서 재설정 안내 제거 | RED | **RED 1** |
| M4 반대 방향 — 불일치 분기를 `REQUIRED` 로 | RED | **RED 2** |

M2 가 양쪽에서 갈린 것이 요점이다 — 테스트가 상수를 **참조**했다면 값이 바뀌어도 테스트와
소스가 함께 움직여 GREEN 이었을 것이다. **리터럴로 단언했기 때문에** 값 드리프트가 세 지점에서
동시에 잡힌다.

뮤턴트 유효성은 `tsc --noEmit` 으로 선검증했다(M1·M2 둘 다 타입 오류 0 — 즉 "구문이 깨져서
RED" 가 아니다). 원복은 `cp` 로 했다(`git checkout` 은 미커밋 작업을 지운 전력이 있다).

## 할 일

- [x] 사용자 결정 — **형제와 완전 정렬** (2026-09-02). 원안 B(`PASSWORD_NOT_SET` 신설)는 폐기
- [x] `spec/5-system/1-auth.md` — `change-password` 실패 코드 서술을 두 조건으로 분리 (§339·§521·§750)
- [x] `spec/5-system/3-error-handling.md` — §1.2 `INVALID_PASSWORD` 행 제거 + §1.2.1 두 행에 발행처 추가 + 근접명명 주석 갱신
- [x] `spec/2-navigation/9-user-profile.md §2.2` — OAuth-only 안내 분기(단일 SoT) + `:94`·`:141`
      포인터. **`--spec` 2R W3 이 없었으면 이 항목은 추적 밖에 있었다** — 결정③으로 뒤늦게 붙은
      surface 라 frontmatter·체크리스트 어디에도 없었고, 이 plan 이 `complete/` 로 가는 순간
      조용히 사라질 자리였다.
- [x] `spec/conventions/error-codes.md` — §3 행 **제거**(더 이상 active 가 아니다) + §5 에
      **등급 B** 은퇴 행 추가. §5 머리말의 *"코드베이스에서 완전 제거"* 전제가 이 행에는
      성립하지 않는다는 사실(감사 사유값 존속)을 행에 명시
- [x] **후속 이월 완료** — `User.passwordHash` 타입 문제는 단독 사례가 아니라 **46건**의
      클래스임을 실측해 [`entity-nullable-column-type-mismatch.md`](../in-progress/entity-nullable-column-type-mismatch.md)
      로 분리했다. 이 plan 에 남겨 두면 결정이 끝난 문서가 무관한 항목 하나 때문에
      계속 열려 있게 된다.
- [x] **developer 턴 완료 (2026-09-03)** — backend 두 분기 + **공용 상수화**(`common/utils/password.util.ts`, 리터럴
      중복이 drift 의 원인이었다) + 단위/e2e + 유저 가이드 `password-and-sessions.mdx` ko/en
      `:80` 사실 오류 정정 (OAuth-only 도 forgot→reset 으로 비밀번호를 **설정할 수 있다** —
      `1-auth.md §1.1.A` 와 구현 양쪽이 그렇게 말한다)
