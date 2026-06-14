# Code Review 통합 보고서

## 전체 위험도
**LOW** — bcrypt 해시 라운드 중앙화 리팩터 + 사용자 가이드 신설. 기능 퇴행·보안 결함 없음. 캡슐화 불완전(comparePassword 유틸 미추출)과 테스트 fixture 하드코딩이 개선 권장 사항으로 남음.

## Critical 발견사항

_(없음)_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `bcrypt.compare()` 직접 호출이 `users.service.ts`(L81)·`auth.service.ts`(L300) 두 곳에 잔존 — 해시 쓰기 경로만 유틸로 통합돼 캡슐화 절반 완성 | `users.service.ts` L8,L81 / `auth.service.ts` L11,L300 | `password.util.ts` 에 `export function comparePassword(plain, hash): Promise<boolean>` 추가 후 양 서비스의 `bcrypt.compare()` 직접 호출 교체. 향후 알고리즘 교체 시 변경 범위 `password.util.ts` 한 곳으로 축소됨 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/13-user-guide.md` §2 IA 트리에 신규 `password-and-sessions` 페이지 미등재 — 코드는 올바르고 spec 갱신 누락 | `spec/2-navigation/13-user-guide.md` L72–75 | 코드 유지, `project-planner` 경유 spec §2 `07-workspace-and-team/` 블록에 `└── password-and-sessions  # 비밀번호 변경 및 세션 관리` 행 추가 |
| 3 | Testing | `auth.service.spec.ts` 테스트 fixture 에서 `bcrypt.hash('...', 12)` 숫자 `12` 하드코딩 — 공유 `BCRYPT_ROUNDS` 상수 미사용으로 rounds 변경 시 fixture 불일치 발생 가능 | `auth.service.spec.ts` L416, L447, L493, L520, L864, L892 | `import { BCRYPT_ROUNDS } from '../../common/utils/password.util'` 후 `bcrypt.hash('...', BCRYPT_ROUNDS)` 로 교체. 또는 `hashPassword()` 직접 사용 |
| 4 | Documentation | `password-and-sessions.en.mdx` frontmatter 누락 — 프로젝트 `.en.mdx` 패턴에 따라 문제 여부 상이 | `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.en.mdx` | 인접 `.en.mdx` 파일(`security-2fa.en.mdx` 등) 패턴 확인. 타 파일도 frontmatter 없으면 현행 관례로 허용; 있으면 `title`·`section`·`order` 포함한 frontmatter 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `BCRYPT_ROUNDS = 12` SoT 정착 — OWASP 2023 권고(≥10) 충족, hash 경로 일관성 보장 | `password.util.ts` L5 | 현 구조 유지 |
| 2 | Security | `checkEmail` API 이메일 열거(enumeration) 가능성 — 설계상 허용된 엔드포인트이나 rate limit 적용 여부 확인 필요 | `auth.service.ts` `checkEmail()` | 컨트롤러/미들웨어 레이어에서 rate limit 적용 확인 |
| 3 | Security | 테스트에서 `BCRYPT_ROUNDS=12` 로 실제 해시 연산 수행 — CI 속도 영향 가능 | `password.util.spec.ts` L49–59 | 허용 가능; 필요 시 환경변수 오버라이드 또는 mock 검토 |
| 4 | Architecture | `AuthService` God Service 경향 (1163줄, 다수 책임) — 이번 변경 범위 외 기존 기술 부채 | `auth.service.ts` 전체 | 별도 리팩터 이슈로 추적(`PasswordResetService`, `RegistrationService` 분리) |
| 5 | Requirement | `DOCS` 딥링크 상수에 `passwordAndSessions` 항목 미등록 | `codebase/frontend/src/lib/docs/links.ts` | `DOCS.workspaceAndTeam.passwordAndSessions` 추가 권고 (즉각 동작 장애 없음) |
| 6 | Side Effect | `BCRYPT_ROUNDS` 가 `export const` 로 공개 API 승격 — 외부 모듈이 상수 직접 import 후 `bcrypt.hash` bypass 경로 사용 가능성 | `password.util.ts` L8 | 현재 소비자가 테스트뿐이므로 위험 낮음. 허용 가능 |
| 7 | Maintainability | `auth.service.ts` `login` 함수 복잡도(약 130줄, 다단계 로직) — 이번 변경 외 기존 기술 부채 | `auth.service.ts` `login` 메서드 | 별도 과제로 추적 |
| 8 | Maintainability | 매직 넘버 `300`(MFA challenge TTL) 상수화 미완 — `BCRYPT_ROUNDS` 패턴 확립 이후 일관성 측면에서 언급 | `auth.service.ts` L607 | `const MFA_CHALLENGE_TTL_SECONDS = 300` 상수화 또는 인라인 주석 추가. 이번 PR 범위 외 |
| 9 | Testing | `users.service.spec.ts` `userWithHash()` 에서 `bcrypt.hash('OldP@ssw0rd1', 4)` — rounds=4 의도 불명확 | `users.service.spec.ts` L60 | `// rounds=4: 테스트 속도용 — prod의 BCRYPT_ROUNDS(12)와 의도적으로 다름` 주석 추가 |
| 10 | Testing | `hashPassword` 빈 문자열 엣지 케이스 테스트 부재 — 유틸 계약 명시 없음 | `password.util.spec.ts` `hashPassword` describe 블록 | `it('delegates to bcrypt.hash without filtering — caller must pre-validate', ...)` 추가 권고 (필수 아님) |
| 11 | Documentation | `password.util.ts` JSDoc 에 `@param`·`@returns` 태그 생략 — 단순 래퍼라 허용 범위 | `password.util.ts` L7–14 | 선택적 추가 가능 |
| 12 | User Guide | auth-session-flow-change trigger 동반 갱신 완료 — `password-and-sessions.{mdx,en.mdx}` ko/en 양쪽 신설, ImplAnchor 실존 확인 | `07-workspace-and-team/` | 이상 없음 |
| 13 | Requirement | 사용자 가이드 비밀번호 정책·세션 동작·OAuth 안내 모두 spec §1.1·§2.3·Rationale 2.3.C 와 정확히 일치 | `password-and-sessions.mdx` | 이상 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | bcrypt SoT 정착, 보안 결함 없음. `checkEmail` rate limit 확인 INFO |
| architecture | LOW | comparePassword 유틸 미추출 — 캡슐화 절반 완성 (WARNING) |
| requirement | LOW | [SPEC-DRIFT] spec IA 트리 미갱신 (WARNING); 구현-spec 일치 |
| scope | NONE | 범위 일탈 없음 — 대상 6파일 정확히 대응 |
| side_effect | NONE | 전역 상태·네트워크 호출 없음, BCRYPT_ROUNDS export 승격 위험 낮음 |
| maintainability | LOW | bcrypt.compare 역할 분리 주석 부재, 매직 넘버 300 (INFO) |
| testing | LOW | auth.service.spec.ts fixture bcrypt.hash 하드코딩 12 (WARNING) |
| documentation | LOW | password-and-sessions.en.mdx frontmatter 누락 (WARNING) |
| user_guide_sync | NONE | 동반 갱신 매트릭스 전수 충족, 누락 0건 |

## 발견 없는 에이전트

- **scope**: 범위 일탈 발견 없음 (NONE)
- **side_effect**: 의도치 않은 부작용 발견 없음 (NONE)
- **user_guide_sync**: 동반 갱신 누락 발견 없음 (NONE)
- **security**: 보안 결함 발견 없음 (NONE, INFO만 존재)

## 권장 조치사항

1. **[SPEC-DRIFT 처리] spec IA 트리 갱신** — `spec/2-navigation/13-user-guide.md` §2 `07-workspace-and-team/` 블록에 `password-and-sessions` 행 추가. `project-planner` 경유 spec 갱신 필요. 코드 revert 불필요.
2. **[WARNING 처리] `auth.service.spec.ts` fixture 하드코딩 수정** — fixture 내 `bcrypt.hash('...', 12)` 를 `bcrypt.hash('...', BCRYPT_ROUNDS)` 로 교체해 rounds 변경 시 자동 동기화 보장.
3. **[WARNING 처리] `password-and-sessions.en.mdx` frontmatter 검토** — 인접 `.en.mdx` 파일 패턴 확인 후 frontmatter 추가 여부 결정.
4. **[후속 리팩터 권고] `comparePassword` 유틸 추출** — `password.util.ts` 에 `comparePassword(plain, hash)` 추가, `users.service.ts`·`auth.service.ts` 의 `bcrypt.compare()` 직접 호출 교체. 향후 알고리즘 교체 시 변경 범위 최소화.
5. **[후속 권고] DOCS 딥링크 상수 등록** — `lib/docs/links.ts` `DOCS` 객체에 `workspaceAndTeam.passwordAndSessions` 추가.
6. **[후속 권고] 테스트 주석 보강** — `users.service.spec.ts` rounds=4 의도 주석, `auth.service.ts`·`users.service.ts` bcrypt.compare 역할 분리 인라인 주석 추가.

## 라우터 결정

라우터 결정 상태: `done` (router 가 선별)

**실행** (9명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync`

**강제 포함(router_safety)** (6명): `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

**제외** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | bcrypt 해시 라운드 중앙화 리팩터 — 성능 특성 변경 없음 |
| dependency | 신규 외부 의존성 추가 없음 (bcrypt 기존 사용) |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 동시성 패턴 변경 없음 |
| api_contract | 공개 API endpoint·DTO 추가/변경 없음 (내부 리팩터) |
