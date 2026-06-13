## 발견사항

- **[INFO]** `users.service.ts` 에 `import * as bcrypt from 'bcrypt'` 가 잔존
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/users/users.service.ts` (전체 파일 컨텍스트 기준 line 8)
  - 상세: 이번 변경의 목적이 `BCRYPT_ROUNDS` 중복 정의를 제거하고 `hashPassword` 단일 진입점으로 DRY화하는 것인데, `users.service.ts` 는 여전히 `import * as bcrypt from 'bcrypt'` 를 유지한다. `bcrypt.compare(currentPassword, user.passwordHash)` (line 1286) 를 위해 직접 import 를 남겨야 하는 것은 맞다 — `hashPassword` 로 compare 를 추상화하지 않았으므로 compile 오류를 막기 위해 필요하다. 따라서 임포트 자체는 의도적이며 범위를 벗어난 수정이 아니다. 단, `hashPassword` 가 `hash` 만 래핑하고 `compare` 는 포함하지 않으므로 향후 `comparePassword` 헬퍼로 추가 DRY화할 여지가 있다는 관찰이다.
  - 제안: 현재 변경 범위 내에서는 수정 불필요. 후속 작업으로 `comparePassword` 헬퍼 추출 고려 가능(이번 PR 범위 외).

- **[INFO]** `auth.service.ts` 에도 `import * as bcrypt from 'bcrypt'` 가 잔존
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/auth/auth.service.ts` line 281 (전체 파일 컨텍스트)
  - 상세: `auth.service.ts` 의 `login()` 에서 `bcrypt.compare(dto.password, user.passwordHash)` (line 570) 가 사용되어 import 가 필요하다. 로컬 `BCRYPT_ROUNDS` 상수 제거 + `hashPassword` 로 교체하는 이번 범위에서 `bcrypt` import 자체를 제거하지 않는 것은 올바른 판단이다. 범위 일탈 없음.
  - 제안: 수정 불필요.

## 요약

변경은 선행 PR(`refactor-04-followup-pwchange-userip.md`) 의 후속 항목으로 명시된 두 가지만 정확히 수행한다: (1) `BCRYPT_ROUNDS` 와 `bcrypt.hash` 호출을 `password.util.ts` 의 `hashPassword` + `BCRYPT_ROUNDS` export 로 단일화(B-3 DRY)하고, (2) 비밀번호 변경 흐름을 설명하는 사용자 가이드 페이지(`password-and-sessions.mdx` + `.en.mdx`)를 신설한다. 대상 파일은 `password.util.ts`, `password.util.spec.ts`, `auth.service.ts`, `users.service.ts`, 두 MDX 문서 6개로, 변경 의도에 정확히 대응한다. 관련 없는 파일, 불필요한 리팩토링, 포맷팅·공백 변경, 임포트 오염이 없으며 `bcrypt` import 잔존도 `compare` 사용처 때문에 의도적이다. 범위 일탈은 발견되지 않는다.

## 위험도

NONE
