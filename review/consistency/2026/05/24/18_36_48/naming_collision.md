# 신규 식별자 충돌 검토 결과

검토 범위: `password-hash-format-guard` 구현 plan 이 도입하는 신규 식별자 vs 기존 `spec/5-system` 및 `codebase/backend/src` 전역

---

## 발견사항

### [INFO] 파일 경로·위치 컨벤션 불일치 — `shared/password-hash/` vs 기존 `common/utils/password.util.ts`

- **target 신규 식별자**: `codebase/backend/src/shared/password-hash/is-valid-bcrypt-hash.ts` (신규 서브폴더 + 파일)
- **기존 사용처**: `codebase/backend/src/common/utils/password.util.ts` — 비밀번호 정책 검증 헬퍼 `validatePasswordStrength()` 가 이미 `common/utils/` 계층에 위치. `password.util.spec.ts` 도 동일 폴더에 존재.
- **상세**: 기존 비밀번호 관련 유틸리티는 `common/utils/` 아래 `password.util.ts` 단일 파일 패턴을 따른다. plan 은 `shared/password-hash/` 라는 새로운 서브폴더를 `shared/` 하위에 신설하겠다고 명시하면서도 "또는 적절한 shared 위치" 라고 위치를 열어 두어 실제 구현 시 `common/utils/` 기존 패턴과 달라질 수 있다. `shared/` 는 현재 `conversation-thread/` 와 `utils/sanitize-error-message.ts` 두 항목만 보관하며, 인증 도메인 헬퍼를 이 계층에 두는 선례가 없다.
- **제안**: `codebase/backend/src/common/utils/password.util.ts` 에 `isValidBcryptHash()` 또는 `BCRYPT_HASH_REGEX` 를 추가(또는 같은 폴더에 `password-hash.util.ts` 신설)해 기존 `common/utils/` 패턴을 따른다. `shared/password-hash/` 신규 서브폴더 생성은 불필요.

---

### [INFO] `BCRYPT_ROUNDS` 상수 — 모듈 로컬 중복 가능성

- **target 신규 식별자**: plan 이 bcrypt 포맷 검증용 regex 상수(`BCRYPT_HASH_REGEX`)를 헬퍼 파일에 두기로 함.
- **기존 사용처**: `codebase/backend/src/modules/auth/auth.service.ts` 26번 줄 — `const BCRYPT_ROUNDS = 12` 가 모듈 로컬 상수로 선언됨. `users.controller.ts` 도 `bcrypt.hash(password, BCRYPT_ROUNDS)` 패턴을 동일하게 사용하며 각자 독립 선언함.
- **상세**: 의미 충돌은 아니지만, bcrypt 관련 상수가 두 모듈에 중복 선언되어 있는 상황에서 신규 헬퍼가 같은 파일에 정적 상수를 추가하면 산포가 더 늘어날 수 있다. 충돌(다른 의미로 재사용) 은 아니므로 INFO 로 분류.
- **제안**: `BCRYPT_ROUNDS` 와 `BCRYPT_HASH_REGEX` 를 동일 헬퍼 파일에 함께 두고, `auth.service.ts` / `users.controller.ts` 가 이를 import 해 공유하면 단일 진실이 확보된다. 이번 PR scope 에서 결정하면 추후 일관성 개선.

---

## 충돌 없음 확인 항목

| 점검 항목 | 결과 |
|-----------|------|
| `isValidBcryptHash` 함수명 중복 | 없음 — 기존 코드베이스에 해당 식별자 없음 |
| `validatePasswordHashFormat` 메서드명 중복 | 없음 — `User` entity 에 동명 메서드 없음 |
| `BCRYPT_HASH_REGEX` 상수명 중복 | 없음 — 기존 코드베이스에 해당 식별자 없음 |
| `@BeforeInsert` / `@BeforeUpdate` hook 기존 사용 | `user.entity.ts` 에 해당 데코레이터 미사용 — 신설 시 충돌 없음 |
| `user.entity.spec.ts` 파일명 중복 | 없음 — 해당 경로에 파일 미존재 |
| `is-valid-bcrypt-hash.spec.ts` 파일명 중복 | 없음 — 해당 경로에 파일 미존재 |
| 새 API endpoint / 환경변수 도입 | 없음 — plan 이 코드 전용 변경임을 명시 |
| 새 이벤트/메시지명 도입 | 없음 |

---

## 요약

`password-hash-format-guard` plan 이 도입하는 신규 식별자(`isValidBcryptHash`, `BCRYPT_HASH_REGEX`, `validatePasswordHashFormat`) 는 기존 코드베이스 어디에서도 다른 의미로 사용되지 않아 의미 충돌은 없다. 다만 비밀번호 관련 유틸리티의 정착 위치가 `common/utils/password.util.ts` 임에도 plan 이 `shared/password-hash/` 라는 새로운 폴더를 제안하고 있어 파일 경로 컨벤션 불일치가 발생한다. 이는 기능 정확성에는 영향이 없으나 이후 유지보수 시 비밀번호 관련 코드가 두 위치에 분산되는 결과를 낳을 수 있으므로 구현 전 위치를 `common/utils/` 로 통일하기를 권장한다.

---

## 위험도

LOW
