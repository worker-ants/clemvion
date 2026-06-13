### 발견사항

- **[INFO]** `password.util.ts` — `BCRYPT_ROUNDS` 상수 및 `hashPassword` 함수에 JSDoc 존재, 품질 양호
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/common/utils/password.util.ts` L7–14
  - 상세: JSDoc 이 한국어로 작성되어 있으며 refactor 04 참조(B-3), SoT 역할 설명을 모두 포함. 함수 시그니처에 `@param`·`@returns` 태그가 생략되어 있으나 단순 래퍼라 허용 범위 내.
  - 제안: 선택적으로 `@param plain` 및 `@returns` 태그 추가 가능하나 필수는 아님.

- **[INFO]** `auth.service.ts` — 모듈 내 `import * as bcrypt` 구문이 `hashPassword` 위임 이후에도 잔류
  - 위치: `/Volumes/project/private/clemvion/.claire/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/auth/auth.service.ts` L9 (`import * as bcrypt from 'bcrypt'`)
  - 상세: `hashPassword` 를 통한 해시 경로는 모두 위임됐지만, `bcrypt.compare` 호출(login, changePassword 등)이 남아 있으므로 import 자체는 정당하다. 그러나 향후 `comparePassword` 유틸도 `password.util.ts` 로 통합하면 이 import 도 제거 가능함을 주석이나 TODO 로 표시하면 유지보수성이 높아진다.
  - 제안: 강제는 불필요. 필요시 `// bcrypt.compare — 추후 comparePassword 유틸 통합 시 제거 가능` 류의 TODO 추가.

- **[INFO]** `users.service.ts` — 동일하게 `import * as bcrypt` 잔류 (bcrypt.compare 사용 유지)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/users/users.service.ts` L6
  - 상세: `changePassword` 내 `bcrypt.compare` 가 직접 호출되어 import 가 필요한 상태. `hashPassword` 만 위임됐고 비교(compare) 경로는 아직 유틸로 통합되지 않았음. 문서화 불일치는 없으나, `changePassword` JSDoc 에서는 bcrypt 직접 의존 사실을 명시하지 않음 — 소비자가 해당 메서드를 이해하는 데 영향 없으므로 INFO 수준.
  - 제안: 현재 상태로 충분.

- **[INFO]** `password-and-sessions.mdx` — 새 사용자 가이드 문서 신규 추가, 구조·내용 적절
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx`
  - 상세: frontmatter 에 `title`, `title_en`, `section`, `order`, `summary`, `summary_en`, `spec`, `code` 필드 모두 포함. `spec/5-system/1-auth.md` 및 관련 구현 파일 3개 참조. 비밀번호 정책(8자, 3종 이상)과 세션 동작(타 기기 즉시 로그아웃)이 구현 코드와 일치.
  - 제안: 없음.

- **[WARNING]** `password-and-sessions.en.mdx` — 영어 버전에 frontmatter 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.en.mdx`
  - 상세: 동일 디렉터리의 다른 영어 MDX 쌍(`security-2fa.en.mdx`)이 frontmatter 를 보유하는지 확인이 필요하다. 한국어 원본(`.mdx`)에는 완전한 frontmatter 가 있으나, 영어 버전(`.en.mdx`)의 전체 파일에는 YAML frontmatter 블록이 전혀 없다. 사이트 메타데이터 파이프라인이 `.en.mdx` 에서도 frontmatter 를 요구하는 경우 제목/순서/요약이 누락된다.
  - 제안: 인접 파일(`security-2fa.en.mdx` 등)의 패턴을 확인하여 `.en.mdx` 에도 frontmatter 가 관례상 생략되는지 검토. 만약 타 `.en.mdx` 에도 frontmatter 없으면 현재 패턴이 프로젝트 관례이므로 무시. 그렇지 않으면 아래 형태로 추가 필요:
    ```yaml
    ---
    title: "Password change and session management"
    section: "07-workspace-and-team"
    order: 4
    ---
    ```

- **[INFO]** `password.util.spec.ts` — 테스트 내 인라인 주석이 bcrypt 포맷 설명을 제공하여 문서화 역할 수행
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/common/utils/password.util.spec.ts` L58
  - 상세: `// bcrypt encodes the cost as the second '$'-delimited field, e.g. $2b$12$...` 주석이 테스트 의도를 명확히 설명. 적절함.
  - 제안: 없음.

- **[INFO]** CHANGELOG — 이 변경 세트에 별도 CHANGELOG 파일이 없음
  - 상세: 프로젝트 루트 및 `codebase/backend/` 에 CHANGELOG 파일이 없거나 관리되지 않는 것으로 보인다. refactor 04 후속 리팩터(bcrypt SoT 통합, `hashPassword` 유틸 도입)는 breaking change 없는 내부 리팩터이므로 CHANGELOG 부재가 문제가 되지 않는다. plan 문서(`plan/in-progress/` 또는 `plan/complete/`)가 변경 이력을 대체하는 구조임.
  - 제안: 현재 프로젝트 관례상 CHANGELOG 관리를 하지 않으므로 조치 불필요.

- **[INFO]** 설정/환경변수 문서화 — 새 환경변수 없음
  - 상세: `BCRYPT_ROUNDS = 12` 는 코드 상수로 하드코딩되어 있고, 환경변수로 외부화되지 않음. 보안 요구사항 변경 시 배포 변경 없이 조정 불가하다는 점을 주석이 암묵적으로 수용하고 있다. 현재 구조에서 문서화 누락은 없음.
  - 제안: 없음 (설계 결정 범위).

### 요약

이번 변경은 bcrypt 해시 라운드 수(`BCRYPT_ROUNDS = 12`)와 `hashPassword` 함수를 `password.util.ts` 단일 SoT 로 통합하는 내부 리팩터와, 사용자용 비밀번호·세션 관리 가이드 신규 추가로 구성된다. `password.util.ts` 의 JSDoc 품질은 양호하며, 사용자 가이드(`.mdx`) 는 비밀번호 정책과 세션 동작을 구현 코드와 일치하게 기술하고 있다. 단 영어 버전(`password-and-sessions.en.mdx`)에 frontmatter 가 누락되어 있어, 프로젝트의 `.en.mdx` 파일 관례에 따라 추가 여부를 검토해야 한다. 나머지 코드 파일들은 기존 JSDoc 을 유지하면서 관련 import 를 정리하였으며, 오래된 주석이나 부정확한 설명은 발견되지 않았다.

### 위험도

LOW
