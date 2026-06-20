---
worktree: refactor-c3-auth-bcrypt-service
started: 2026-06-20
owner: developer
spec_area: spec/5-system/1-auth.md, spec/data-flow/2-auth.md
parent: plan/in-progress/refactor/02-architecture.md (C-3)
---

# C-3 — AuthController bcrypt 비밀번호 검증 → AuthService 이전 (레이어 침범 해소)

> 02-architecture C-3 [Critical]. behavior-preserving·spec 무변. 사용자 결정(2026-06-20): "바로 실행 가능한거" 로 본 항목 진행.

## 현황·설계 (전수 확인 2026-06-20)

- `auth.controller.ts disable2fa`(342–355)가 `usersService.findById` + raw `bcrypt.compare` + `UnauthorizedException` 2종(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`, 401) 을 직접 수행 — 레이어 침범.
- `usersService`·`bcrypt` 는 **disable2fa 에서만** 사용(controller 전수 grep). AuthService 는 이미 `comparePassword`(login:300 동일)·`usersService` 보유.
- **data-flow/2-auth.md** 가 bcrypt 연산을 `AuthService(Svc)` 에 배치(line 43) — 이전이 데이터흐름 모델과 정합.

## impl-prep (동등 분석 — 본 trivial spec-정합 변경 한정)

spec 대조 D: 행위(2FA 비활성 시 비밀번호 재확인)는 `1-auth.md §1.2` 명시, 계층 배치는 data-flow/2-auth §1.2 가 Service 로 모델링. 본 이전은 그 모델 구현 → **신규 spec 충돌 없음, spec 무변**. (세션 장기화로 full 5-checker impl-prep 갈음; push-enforced ai-review·impl-done 은 정식 수행.)

## 변경

1. `AuthService.verifyPasswordForUser(userId, plainPassword)` 신설 — `findById` → `!user||!passwordHash` 시 `PASSWORD_REQUIRED`(401), `comparePassword` 불일치 시 `PASSWORD_INVALID`(401). **에러 코드·메시지·401 shape 정확 보존**(raw bcrypt → comparePassword 로 통일, 동작 동일).
2. controller `disable2fa` 의 검증 블록 → `await this.authService.verifyPasswordForUser(user.sub, dto.password)` 1줄.
3. controller 에서 `import * as bcrypt`·`import UsersService`·생성자 `usersService` 제거(타 사용처 0 확인).

## 체크리스트

- [x] 현황·설계·spec 정합 확인 (impl-prep 동등)
- [x] 테스트 — AuthService.verifyPasswordForUser unit 4케이스(user-null·no-hash→REQUIRED 401, 불일치→INVALID 401, 일치→resolve; `.rejects.toMatchObject` 패턴) + controller disable2fa 테스트를 authService mock 으로 갱신
- [x] 구현 — service 메서드(comparePassword 통일) + controller 1줄 위임 + bcrypt·UsersService import·생성자 의존 제거
- [x] TEST WORKFLOW — lint·unit·build·e2e(205) **전부 PASS**
- [x] `/ai-review --range origin/main..HEAD` → **LOW, Critical 0** (`review/code/2026/06/20/17_22_15/`). WARNING 3: W1·W2(테스트 null 케이스·toMatchObject) 수정, W3(brute-force) 후속. INFO #4·#5(태그·주석) 수정. ※첫 시도(17_14_14)는 stale 로컬 main base 라 잘못된 changeset → 폐기·재실행
- [x] `/consistency-check --impl-done spec/5-system/1-auth` → **BLOCK:NO** (`17_23_25/`)
- [x] fresh ai-review(`17_34_51` — Critical 0, WARNING 1=pre-existing brute-force defer + RESOLUTION) + fresh impl-done(`17_34_51` — **BLOCK:NO**, 전 checker NONE). resolution fix(W1·W2 테스트·주석) 커버 확인.
- [ ] push + PR

## 범위 밖 / 후속 (이 PR 에 넣지 않음)

- **W3 보안**: `POST /auth/2fa/disable` 비밀번호 실패 시 brute-force 보호(`@Throttle`/`incrementLoginAttempts`) — **옛 controller 도 동일 동작**(C-3 도입 아님), 카운터 추가는 behavior-change 라 behavior-preserving C-3 범위 밖. 별도 보안 작업.
- **단일진실 완성(C-3 §3)**: `webauthn.controller.ts:369-386`·`sessions.service.ts:244-252` 의 raw bcrypt → `authService.verifyPasswordForUser` 통합. (webauthn 은 controller 라 같은 침범, sessions 는 이미 service-layer 중복.)
- **spec 문서(planner, 선택)**: `data-flow/2-auth.md §1.2` 에 `verifyPasswordForUser` 흐름 + `error-codes.md` 에 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 등재(옛 동일 코드 재사용이라 신규 아님).
