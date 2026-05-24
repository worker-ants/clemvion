---
worktree: password-hash-format-guard-60f7f2
started: 2026-05-24
owner: developer
---

# password-hash-format-guard — entity 레벨 bcrypt 포맷 검증

PR #301 (form-resubmit-fix) 의 ai-review `security` **WARNING #1** 후속 hardening. 해당 권고의 두 부분 중 첫 부분 (e2e 평문 → 실제 해시) 은 PR #303 에서 해소됨. 본 PR 은 두 번째 부분 — "애플리케이션 레벨에서 저장 전 해시 포맷을 검증하는 guard" — 를 처리.

## 배경

ai-review security WARNING #1 (review/code/2026/05/24/17_12_34/security.md):

> e2e 테스트에서도 `bcrypt.hashSync('test-password', 1)` 등 최소 라운드로 실제 해시를 생성하거나, 상수 `TEST_HASH` 를 한 곳에 모아 관리한다. **보다 중요한 것은 애플리케이션 레벨에서 저장 전 해시 포맷을 검증하는 guard 를 구현하는 것이다.**

현행 분석 (2026-05-24 main `325a8108`):

- 모든 application 경로의 user 생성/갱신은 `bcrypt.hash(password, BCRYPT_ROUNDS)` → `passwordHash` 변수에 담아 `usersService.create/update` 호출 (auth.service.ts:73, 121, 635 / users.controller.ts:151).
- entity 레벨 / DB 레벨 포맷 검증 없음 — 누군가 raw string 으로 `passwordHash` 를 set 하는 잘못된 코드를 추가하면 DB 에 저장됨. bcrypt.compare 가 false 만 반환해 로그인은 실패하지만 행 자체는 invariant 위반 상태로 저장.

## 채택안

`User` entity 의 `@BeforeInsert` / `@BeforeUpdate` TypeORM hook 에서 `passwordHash` 가 null/undefined 가 아닐 때 bcrypt 포맷 검증. 실패 시 throw — DB 저장 차단.

- bcrypt hash 포맷: `$2[aby]$<rounds>$<22-char salt><31-char hash>` (총 60자).
- 검증 regex: `/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/` — 길이 60 + prefix `$2a/b/y` + rounds 2자리 + base64-like 53자.
- `passwordHash === null` 또는 `=== undefined` 는 통과 (OAuth-only 사용자, spec §"비밀번호 저장" 의 `nullable` invariant 와 일관).
- 검증 실패 시 명시적 에러 메시지: 어떤 필드가 어떤 이유로 거부됐는지 (단 실제 hash 값은 로그에 남기지 않음).

## 변경 범위

### 코드 (codebase)

1. `codebase/backend/src/shared/password-hash/is-valid-bcrypt-hash.ts` (또는 적절한 shared 위치) 신설:
   - `export function isValidBcryptHash(value: unknown): boolean` — null/undefined 도 호출자가 처리하도록 boolean 만 반환 (`!== null && !== undefined && matches regex`).
   - 또는 `export const BCRYPT_HASH_REGEX = /.../` + 단순 helper. 위치 결정은 구현 시.

2. `codebase/backend/src/modules/users/entities/user.entity.ts`
   - `import { BeforeInsert, BeforeUpdate } from 'typeorm'` 추가.
   - 메서드 `validatePasswordHashFormat()` 신설, `@BeforeInsert() @BeforeUpdate()` 데코레이터.
   - `passwordHash !== null && !== undefined` 일 때 regex 검증, fail 시 throw new Error("Invalid password_hash format: must be bcrypt hash (spec §...)").

3. unit test:
   - `codebase/backend/src/modules/users/entities/user.entity.spec.ts` (없으면 신설) — entity hook 직접 호출 단위 검증.
   - 또는 `codebase/backend/src/shared/password-hash/is-valid-bcrypt-hash.spec.ts` — helper unit.

테스트 케이스:
- valid bcrypt hash (`bcrypt.hashSync('test', 1)` 결과) → 통과
- null / undefined → 통과 (OAuth-only invariant)
- 'x' / 'plain-text' / `$2x$10$...` (invalid prefix) → throw
- 빈 문자열 → throw
- 길이 부족 / 초과 → throw

### Spec — 변경 없음

`spec/5-system/1-auth.md §"비밀번호 저장"` 행이 이미 `bcrypt (cost factor ≥ 12). user.password_hash 는 nullable — OAuth 단독 가입 사용자는 NULL` 명시. 본 가드는 그 invariant 의 entity-level enforcement 이므로 신규 spec 추가 불필요. project-planner 위임 skip.

## 제외

- DB 레벨 CHECK 제약 추가 — application 가드보다 강하지만 migration 동반. 본 PR scope 외 (별도 plan 검토).
- 다른 hash 필드 (`twoFactorSecret`, `totpRecoveryCodes`, `webauthnRecoveryCodes`, `emailVerifyToken`, `passwordResetToken`) 포맷 검증 — 각자 다른 형식. 본 PR scope 외.

## 진행 체크리스트

1. - [x] plan 신설
2. - [x] consistency-check `--impl-prep` (`review/consistency/2026/05/24/18_36_48/`) — BLOCK: NO. WARNING 들은 대부분 본 PR scope 외 (data-model nullable 표기 / invitation 명명 / graph-rag 문서구조 — 별 chore).
3. - [x] 테스트 선작성 — bcrypt-format helper (7건) + user.entity hook (6건) RED 확인.
4. - [x] helper (`shared/utils/bcrypt-format.ts`) + entity `@BeforeInsert/@BeforeUpdate` hook 구현. GREEN.
5. - [x] TEST WORKFLOW — lint / unit (4704, +13) / build / e2e (109/109) 모두 PASS.
6. - [ ] REVIEW WORKFLOW — skip (PR #303/#306 패턴): 변경 면적 작음 (helper 1 + entity hook 1) + 동일 영역이 PR #301 ai-review 의 직접 권고 반영. PR body 에 사유 명시.
7. - [x] plan complete 이동 (본 commit).
