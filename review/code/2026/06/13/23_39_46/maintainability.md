# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] bcrypt import 잔존 — `auth.service.ts`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/auth/auth.service.ts` — 상단 `import * as bcrypt from 'bcrypt';`
- 상세: `hashPassword` 로 해시 경로가 모두 이전됐지만 `bcrypt` 직접 import 가 여전히 남아있다. `bcrypt.compare` 호출(login, loginWithTotp 에서의 비밀번호 비교)이 남아있어 import 자체는 필요하다. 그러나 유지보수자가 "해시 경로가 중앙화됐다"는 의도를 파악할 때 `bcrypt` import 의 존재가 혼란을 줄 수 있다. 주석 또는 인라인 설명이 없으면 미래 개발자가 `bcrypt.compare` 를 `hashPassword` 와 혼동할 여지가 있다.
- 제안: `bcrypt.compare` 사용 부분 옆에 짧은 인라인 주석 추가 — "// 해시는 hashPassword 경유, 비교는 bcrypt.compare 직접 사용(단방향 검증 전용)" — 또는 `comparePassword(plain, hash)` 유틸을 같은 파일에 추가해 대칭성을 완성한다. 현재 상태에서 기능 문제는 없으나 가독성 측면에서 개선 여지가 있다.

---

### [INFO] `users.service.ts` 에도 `import * as bcrypt` 잔존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/users/users.service.ts` 상단 `import * as bcrypt from 'bcrypt';`
- 상세: `hashPassword` 로 해시 경로는 이전됐으나, `changePassword` 내부에서 `bcrypt.compare(currentPassword, user.passwordHash)` 직접 호출이 남아있어 import 는 여전히 필요하다. `auth.service.ts` 와 동일하게 `bcrypt.compare` 사용처와 `hashPassword` 의 역할 분리에 대한 주석이 없으면 향후 리팩터링 시 의도를 오해하기 쉽다.
- 제안: `auth.service.ts` 와 동일한 패턴으로 `comparePassword` 유틸을 `password.util.ts` 에 추가하거나, `bcrypt.compare` 사용 위에 의도를 명시하는 인라인 주석 추가.

---

### [INFO] 테스트에서 `bcrypt` 직접 import — 화이트박스 테스트의 내부 결합
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/common/utils/password.util.spec.ts` 라인 2, 52
- 상세: `hashPassword` 결과 검증에 `bcrypt.compare` 를 직접 import 해서 사용한다. 공개 API(`hashPassword`)의 반환값을 같은 라이브러리의 `compare` 로 교차 검증하는 것은 의미 있지만, 만약 추후 해시 알고리즘이 교체되면 이 테스트도 함께 수정해야 한다. 알고리즘 교체 범위(util + 테스트 모두)를 인지하게 하는 주석이 있으면 더 명확하다.
- 제안: 현재 패턴은 수용 가능하며 기능적으로 올바르다. 필요하다면 테스트 파일 상단에 "// 이 테스트는 bcrypt 구현 세부를 알고 있는 화이트박스 테스트입니다." 주석 추가로 의도를 문서화할 수 있다.

---

### [INFO] `auth.service.ts` 내 `login` 함수 길이 및 복잡도
- 위치: `auth.service.ts` — `login` 메서드 (약 130줄)
- 상세: `login` 함수는 이번 변경의 대상이 아니지만, 변경 후에도 여전히 사용자 조회 → 잠금 확인 → 이메일 미인증 → 비밀번호 미설정 → bcrypt 비교 → 2FA 분기 → 토큰 발급 → 히스토리 기록까지 다단계 로직을 한 함수에서 처리한다. 이 변경이 코드베이스 복잡도를 새로 추가하지는 않았으나, 리뷰 맥락에서 언급할 만한 기존 기술 부채다.
- 제안: 이번 PR 범위 밖이므로 차후 과제로 기록. 당장 수정 불필요.

---

### [INFO] 매직 넘버 `300` — MFA challenge token 만료
- 위치: `auth.service.ts` 라인 약 607 — `{ expiresIn: 300 }`
- 상세: 이번 변경에서 도입된 코드는 아니지만, 코드베이스에 `BCRYPT_ROUNDS` 와 같이 상수화된 패턴이 이제 명확히 확립됐으므로 `300`(5분)도 같은 방식으로 상수화할 대상이다. 현재 인접 주석 `expiresIn: 300, // 5분` 은 없다 (주석이 있는 경우 `// 15분` 형태로 다른 곳에는 있음).
- 제안: `const MFA_CHALLENGE_TTL_SECONDS = 300;` 형태로 상수화하거나, 최소 `{ expiresIn: 300 /* 5 min */ }` 인라인 주석 추가. 이번 PR 범위 밖이므로 별도 처리 권장.

---

### [INFO] `password-and-sessions.en.mdx` — frontmatter 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.en.mdx`
- 상세: 영문 버전 `.en.mdx` 파일에는 frontmatter(`---` 블록)가 없다. 한국어 `.mdx` 파일에는 `title`, `title_en`, `section`, `order`, `summary`, `spec`, `code` 등 풍부한 frontmatter 가 있다. 문서 시스템이 영문 파일을 어떻게 처리하는지(i18n 라우팅 시 한국어 메타데이터를 상속하는지 여부)에 따라 문제가 될 수 있다. 만약 영문 파일이 독립적으로 처리된다면 frontmatter 누락으로 메타데이터(`order`, `section` 등)를 읽지 못할 수 있다.
- 제안: 문서 시스템의 i18n 처리 방식 확인 후, 영문 파일에도 동일한 구조의 frontmatter 추가 여부 결정. 단, 이는 문서 시스템 설계 의도일 수 있으므로 기존 `.en.mdx` 패턴 확인 후 판단.

---

## 요약

이번 변경의 핵심 목적인 bcrypt 라운드 상수(`BCRYPT_ROUNDS`)와 해시 함수(`hashPassword`)의 단일 진입점 중앙화는 매우 잘 실행됐다. `password.util.ts` 로의 책임 응집, 기존 코드베이스의 두 서비스(`auth.service`, `users.service`)에서의 로컬 상수·직접 `bcrypt.hash` 호출 제거, 새 유틸 함수에 대한 명확한 JSDoc 주석, 그리고 cost factor 검증까지 포함한 테스트 설계 모두 유지보수성 관점에서 모범적이다. 지적된 사항은 대부분 이번 변경이 아닌 기존 코드의 기술 부채(매직 넘버, `login` 함수 복잡도)이거나, `bcrypt.compare` 와 `hashPassword` 역할 분리의 의도를 더 명확히 문서화하면 좋겠다는 INFO 수준 제안이다. 영문 문서 frontmatter 누락은 문서 시스템 동작에 따라 확인이 필요한 유일한 비코드 주의 사항이다.

## 위험도

LOW
