# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] `auth.service.ts` 에서 `import * as bcrypt` 가 여전히 필요하며 의도적 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/auth/auth.service.ts` line 11
- 상세: 리팩터 목적은 `bcrypt.hash` 호출 경로를 `hashPassword`로 통일하는 것이다. `auth.service.ts` 에서 `import * as bcrypt` 는 `bcrypt.compare(dto.password, user.passwordHash)` (line 300) 에서 여전히 사용되므로 제거 대상이 아니다. 의도와 구현 일치.
- 제안: 해당 없음.

### [INFO] `users.service.ts` 에서 `import * as bcrypt` 가 여전히 필요하며 의도적 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/modules/users/users.service.ts` line 8
- 상세: `changePassword` 내 `bcrypt.compare(currentPassword, user.passwordHash)` (line 81) 가 남아 있어 import 가 필요하다. 해시 생성(write path) 만 `hashPassword` 로 위임되고 검증(read path) 은 직접 `bcrypt.compare` 를 쓰는 구조는 합리적이며, spec §1.1 비밀번호 검증 요건과 충돌하지 않는다.
- 제안: 해당 없음.

### [WARNING] [SPEC-DRIFT] `spec/2-navigation/13-user-guide.md` §2 IA 트리에 `password-and-sessions` 페이지 미등재
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/13-user-guide.md` line 72–75
- 상세: spec §2 IA 트리의 `07-workspace-and-team/` 항목은 `workspaces-and-members` 한 페이지만 나열한다. 이번 변경으로 `password-and-sessions` 페이지가 추가됐으나 spec IA 트리에는 반영되지 않았다. 코드(MDX 파일)는 올바른 추가이며 되돌릴 이유가 없다 — spec 갱신 누락이다.
- 제안: 코드 유지 + spec 반영. `spec/2-navigation/13-user-guide.md` §2 IA 트리 `07-workspace-and-team/` 블록에 `└── password-and-sessions  # 비밀번호 변경 및 세션 관리` 행 추가 필요. `project-planner` 경유 spec 갱신.

### [INFO] `DOCS` 딥링크 상수에 `passwordAndSessions` 항목 미등록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/frontend/src/lib/docs/links.ts`
- 상세: spec §6 딥링크 규약에 따르면 코드 상 딥링크 상수는 `lib/docs/links.ts` `DOCS` 에 canonical 경로로 등록한다. 현재 `DOCS` 객체에 `07-workspace-and-team` 섹션의 항목 자체가 없고 신규 `password-and-sessions` 페이지도 미등록이다. 다른 페이지에서 이 페이지로 딥링크할 때 타입 세이프 경로를 사용할 수 없다. 단, 현재 이 페이지로 링크하는 코드가 확인되지 않아 즉각 동작 장애는 없다.
- 제안: `DOCS` 에 `workspaceAndTeam: { passwordAndSessions: "/docs/07-workspace-and-team/password-and-sessions" }` 추가 권고 (강제 사항은 아니나 규약 일치를 위해).

### [INFO] `password-and-sessions.en.mdx` 에 frontmatter 없음 — 의도된 패턴으로 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.en.mdx`
- 상세: locale sibling 파일(`*.en.mdx`)은 `registry.ts` `isLocaleSibling()` 로 스캔에서 제외되며, 제목·요약 등 메타데이터는 canonical `.mdx`(한글) 의 frontmatter `title_en`/`summary_en` 에서 읽는다. `workspaces-and-members.en.mdx` 가 frontmatter 를 가진 것은 그 파일의 특수 케이스이며, 현행 `registry.ts` 로직 상 sibling frontmatter 는 읽히지 않는다 — 따라서 `password-and-sessions.en.mdx` 에 frontmatter 가 없어도 동작에 문제 없다.
- 제안: 해당 없음.

### [INFO] spec §1.1 bcrypt cost factor ≥ 12 — `BCRYPT_ROUNDS = 12` 정확히 일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-bcrypt-userguide-20c7ca/codebase/backend/src/common/utils/password.util.ts` line 13
- 상세: `spec/5-system/1-auth.md` §1.1 "비밀번호 저장: bcrypt (cost factor ≥ 12)" 요건을 `BCRYPT_ROUNDS = 12` 가 정확히 만족한다. 이전에 `auth.service.ts`, `users.service.ts` 두 곳에 각각 `const BCRYPT_ROUNDS = 12` 가 중복 정의되어 있던 것을 단일 SoT 로 통합한 리팩터이며 요구사항 일치.
- 제안: 해당 없음.

### [INFO] 사용자 가이드 — 비밀번호 정책 기술이 spec §1.1 과 정확히 일치
- 위치: `password-and-sessions.mdx` line 33–34 (Steps §3)
- 상세: 문서에 "최소 8자, 영문 소문자·영문 대문자·숫자·특수문자 중 3종 이상 포함" 으로 기술. spec §1.1 "최소 8자, 대소문자 + 숫자 + 특수문자 중 3가지 이상 조합" 과 동일 의미이며, `validatePasswordStrength` 구현(`password.util.ts` line 32–46)과도 일치한다.
- 제안: 해당 없음.

### [INFO] 세션 동작 기술 — 비밀번호 변경 후 "현재 브라우저 세션 유지" 가 spec §2.3 Rationale 2.3.C 와 일치
- 위치: `password-and-sessions.mdx` line 50 및 55
- 상세: 문서 "변경이 완료되면 현재 브라우저는 로그아웃 없이 그대로 유지", "다른 모든 기기·세션이 즉시 로그아웃" 기술이 spec §2.3 "비밀번호 변경 시 처리: 모든 활성 family revoke + 현재 디바이스에 새 세션 재발급" 과 정확히 일치한다. `rotateSessionAfterPasswordChange` 구현도 동일 동작을 수행한다.
- 제안: 해당 없음.

### [INFO] OAuth-only 계정 안내 기술이 spec §2.3 Rationale 2.3.C 마지막 단락과 일치
- 위치: `password-and-sessions.mdx` line 60–63
- 상세: 문서 "OAuth 전용 계정은 현재 비밀번호 확인 단계에서 실패" — spec Rationale 2.3.C "OAuth-only 사용자: `passwordHash` 가 없으면 `INVALID_PASSWORD` 로 차단" 과 일치. 구현도 `users.service.ts` `changePassword` 에서 `!user.passwordHash` → `INVALID_PASSWORD` throw 로 동일하게 처리한다.
- 제안: 해당 없음.

### [INFO] `hashPassword` 는 빈 문자열 입력에도 동작하나 상위 레이어에서 강도 검증으로 차단
- 위치: `password.util.ts` `hashPassword` 함수
- 상세: `hashPassword` 자체는 `plain` 에 대해 별도 null/empty 검증을 하지 않으나, 모든 호출처(`register`, `registerWithInvitation`, `resetPassword`, `changePassword`)가 사전에 `validatePasswordStrength` 를 호출해 최소 8자 정책(≥ 8자)을 강제한다. 따라서 빈 문자열·짧은 문자열은 `hashPassword` 에 도달하지 않는다. 설계 의도와 구현이 일치.
- 제안: 해당 없음.

---

## 요약

이번 변경은 두 가지 목적을 가진다: (1) bcrypt rounds 의 중복 정의 제거 — `auth.service.ts`, `users.service.ts` 각각에 있던 `const BCRYPT_ROUNDS = 12` 를 `password.util.ts` 의 단일 SoT `hashPassword`/`BCRYPT_ROUNDS` 로 통합. (2) 비밀번호 변경 및 세션 관리를 설명하는 사용자 가이드 페이지 추가. (1)은 spec §1.1 (cost factor ≥ 12) 요건을 정확히 충족하며 모든 해시 경로가 동일 rounds 를 쓰도록 보장한다. 검증 경로(`bcrypt.compare`)는 각 서비스에 직접 잔류해 의미상 적절하다. 테스트(`hashPassword` 두 케이스)도 단일 SoT 보장을 검증한다. (2) 사용자 가이드의 정책 기술·세션 동작·OAuth 안내는 모두 spec §1.1, §2.3, Rationale 2.3.C 와 line-level 로 일치한다. 주요 SPEC-DRIFT 는 `spec/2-navigation/13-user-guide.md` §2 IA 트리가 신규 페이지를 아직 반영하지 않은 것으로, 코드를 되돌릴 이유는 없고 spec 갱신만 필요하다.

---

## 위험도

LOW
