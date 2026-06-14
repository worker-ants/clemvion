### 발견사항

- **[INFO]** `hashPassword` 단위 테스트 — 적절한 커버리지 추가
  - 위치: `codebase/backend/src/common/utils/password.util.spec.ts` (lines 48–60)
  - 상세: `hashPassword`에 대해 두 개의 단위 테스트를 추가했다. (1) 실제 bcrypt 라이브러리로 생성된 해시가 평문과 일치하는지 검증하는 라운드트립 테스트, (2) `$`-분리 필드로 cost factor가 `BCRYPT_ROUNDS(12)`와 일치하는지 검증하는 테스트. 두 테스트 모두 독립적으로 실행 가능하고, 의도가 명확하다.
  - 제안: 없음

- **[INFO]** `auth.service.spec.ts` — `bcrypt.hash` 하드코딩 라운드(12)가 refactor 후에도 잔존
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts`, lines 416, 447, 493, 520, 864, 892
  - 상세: auth.service.ts에서 로컬 `BCRYPT_ROUNDS = 12`를 제거하고 공유 `hashPassword`로 마이그레이션했으나, auth.service.spec.ts의 테스트 fixture는 여전히 `bcrypt.hash('...', 12)`로 직접 해시를 생성한다. 이 숫자 `12`는 `password.util.ts`의 `BCRYPT_ROUNDS`와 별개로 하드코딩되어 있어, 향후 rounds 값이 바뀔 경우 테스트 fixture가 prod 코드와 불일치할 수 있다.
  - 제안: fixture 생성 시 `import { hashPassword } from '../../common/utils/password.util'`을 사용하거나, 최소한 `import { BCRYPT_ROUNDS } from '../../common/utils/password.util'`을 사용해 `bcrypt.hash('...', BCRYPT_ROUNDS)`로 바꾸면 rounds 변경에 안전하게 대응할 수 있다.

- **[INFO]** `users.service.spec.ts` — `changePassword` fixture도 낮은 rounds(4) 하드코딩
  - 위치: `codebase/backend/src/modules/users/users.service.spec.ts`, line 60
  - 상세: `userWithHash()` 헬퍼에서 `bcrypt.hash('OldP@ssw0rd1', 4)`로 테스트 속도를 위해 낮은 rounds를 사용하는 것은 관행상 허용되나, 이 값이 `BCRYPT_ROUNDS`와 무관하다는 점을 명시적 주석으로 표현하면 좋다. 현재 코드에는 주석이 없어 의도가 불분명하다.
  - 제안: `// rounds=4: 테스트 속도용 — prod의 BCRYPT_ROUNDS(12)와 의도적으로 다름` 형태의 주석 추가를 권장한다.

- **[WARNING]** `hashPassword`에 대한 엣지 케이스 테스트 부재 — 빈 문자열 처리
  - 위치: `codebase/backend/src/common/utils/password.util.spec.ts`, `hashPassword` describe 블록
  - 상세: 추가된 테스트 두 개는 유효한 강한 패스워드만 다룬다. `hashPassword`는 순수 래퍼(bcrypt.hash 위임)이므로 빈 문자열을 넣어도 예외 없이 해시를 반환한다. `validatePasswordStrength`를 통과하지 못한 입력이 `hashPassword`에 도달하는 경우는 비즈니스 로직 상 없도록 설계되어 있으나, 유틸 자체의 계약(공문서)을 테스트로 명시하지 않아 향후 오용 가능성이 있다. 단, 이 유틸은 내부 SoT 래퍼이므로 규모가 크지 않은 위험이다.
  - 제안: 필수는 아니지만, `it('delegates to bcrypt.hash without filtering — caller must pre-validate', ...)` 형태로 계약 명세 테스트를 추가하면 향후 오용 예방에 도움이 된다.

- **[INFO]** MDX 문서(파일 5, 6) — 테스트 대상 아님, 영향 없음
  - 위치: `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` 외
  - 상세: UI 문서 파일이므로 자동화 테스트 대상이 아니다. 콘텐츠 정확성은 spec 및 구현과 일관성 검토 대상이며, 테스트 관점에서는 이슈 없음.

### 요약

이번 리팩토링(refactor 04 B-3)의 핵심 변경인 `hashPassword` / `BCRYPT_ROUNDS` 추출은 `password.util.spec.ts`에 적절한 단위 테스트가 동반되었으며, `users.service.spec.ts`의 `changePassword` 경로도 충분히 커버되어 있다. 회귀 테스트(`auth.service.spec.ts`)는 기능 동작을 여전히 올바르게 검증하나, 다수의 테스트 fixture가 `bcrypt.hash(..., 12)`를 직접 하드코딩하고 있어 공유 `BCRYPT_ROUNDS` 상수를 사용하지 않는다는 구조적 일관성 갭이 남는다. 기능 정확성에는 즉각적인 영향이 없지만, rounds 값 변경 시 테스트 fixture가 암묵적으로 비어있는 불일치 상태가 될 수 있다. 전체적으로 테스트 커버리지와 격리, 가독성은 양호하다.

### 위험도

LOW
