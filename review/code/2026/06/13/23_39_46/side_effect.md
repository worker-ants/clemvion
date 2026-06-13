### 발견사항

- **[INFO]** `auth.service.ts` 에 `import * as bcrypt from 'bcrypt'` 가 잔존한다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/auth/auth.service.ts` line 11
  - 상세: `bcrypt.hash` 호출은 모두 `hashPassword` 로 교체됐지만 `bcrypt.compare` (line 300) 가 여전히 직접 사용 중이므로 import 자체는 필요하다. 부작용은 없으나 해당 import 가 `hash` 경로 제거 이후에도 남아 있다는 점을 명시한다.
  - 제안: 현재 상태 유지 가능 (`bcrypt.compare` 가 사용 중). 의도적 잔존임을 인라인 주석으로 명시하면 혼란을 줄일 수 있다.

- **[INFO]** `users.service.ts` 에 `import * as bcrypt from 'bcrypt'` 가 잔존한다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/users/users.service.ts` line 8
  - 상세: `bcrypt.compare` (line 81) 가 여전히 직접 호출되므로 import 는 필요하다. `bcrypt.hash` 만 제거된 것이며 부작용은 없다.
  - 제안: 현재 상태 유지 가능.

- **[INFO]** `BCRYPT_ROUNDS` 가 `export const` 로 공개 API 에 추가됐다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/common/utils/password.util.ts` line 8
  - 상세: 이전에 `auth.service.ts` 와 `users.service.ts` 에 각각 `const BCRYPT_ROUNDS = 12` 로 파일-로컬 상수였던 값이 공개 export 로 승격됐다. 현재 소비자는 테스트(`password.util.spec.ts`)뿐이므로 즉각적 부작용은 없다. 향후 외부 모듈이 이 값을 직접 import 해 `bcrypt.hash(x, BCRYPT_ROUNDS)` 를 bypass 경로로 사용할 가능성이 생긴다.
  - 제안: 허용 가능한 설계 선택. 단, 소비자가 `BCRYPT_ROUNDS` 를 직접 import 해 `bcrypt.hash` 를 호출하는 것을 막고 싶다면 상수를 unexported 로 유지하고 테스트도 hash 결과 검증으로만 대체하는 방안을 검토할 수 있다. 현재는 테스트 목적 외 추가 소비자가 없어 위험 낮음.

- **[INFO]** `hashPassword` 가 새로운 공개 함수로 export 됐다 — 시그니처 변경 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/common/utils/password.util.ts` line 14
  - 상세: 기존 파일에 없던 신규 export 추가. 기존 호출자(`validatePasswordStrength` import)에 영향 없음. 신규 함수는 순수 위임(`bcrypt.hash(plain, BCRYPT_ROUNDS)`)으로 전역 상태·파일시스템·환경 변수·네트워크 호출 없음.
  - 제안: 문제 없음.

- **[INFO]** MDX 문서 파일 2건 신규 생성 (`password-and-sessions.mdx`, `password-and-sessions.en.mdx`)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/frontend/src/content/docs/07-workspace-and-team/`
  - 상세: 정적 콘텐츠 파일 추가로, 런타임 부작용(상태 변경·네트워크 호출 등)은 없다. 프론트엔드 빌드 시 docs 라우팅 시스템이 자동으로 페이지를 생성하는 구조라면 신규 URL `/docs/07-workspace-and-team/password-and-sessions` 가 노출되는 부작용이 있으나 이는 의도된 동작이다.
  - 제안: 문제 없음. 빌드 시스템이 `order: 4` 메타데이터를 처리해 네비게이션에 자동 삽입하는지 확인 권장.

### 요약

이번 변경은 `auth.service.ts` 와 `users.service.ts` 에 각각 파일-로컬로 중복 선언되어 있던 `BCRYPT_ROUNDS = 12` 상수와 `bcrypt.hash` 직접 호출을 `password.util.ts` 의 단일 `hashPassword` 함수로 통합한 리팩터다. 의도치 않은 전역 상태 변경·환경 변수 접근·네트워크 호출·이벤트 발생은 없으며, 기존 공개 API(`validatePasswordStrength`)의 시그니처도 변경되지 않았다. `bcrypt.compare` 경로는 각 서비스에서 여전히 직접 호출되므로 기존 `bcrypt` import 가 잔존하지만 필요에 의한 것이다. `BCRYPT_ROUNDS` 의 공개 export 승격은 테스트 목적 이외의 우발적 소비 가능성을 열지만 현재 소비자가 없어 즉각적 위험은 없다. MDX 문서 신규 추가는 런타임 부작용이 없으며 의도된 파일시스템 변경이다.

### 위험도

NONE
