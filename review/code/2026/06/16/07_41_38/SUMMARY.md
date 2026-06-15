# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — authentication God Component 분리 리팩터링은 구조적으로 양호하나, RBAC UI 가드 누락(Add/Regenerate/Delete 버튼 3건)과 신규 UI 컴포넌트 단위 테스트 부재가 핵심 리스크다. 백엔드가 최종 방어선으로 기능 보안은 유지되나 spec §3.2 RBAC 미충족이다.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY / RBAC | "Add Auth Method" 버튼에 `isAdmin` 가드 없음 — Editor/Viewer 가 create 폼을 열 수 있어 백엔드 403 혼란 유발. spec §3.2 RBAC(Auth Config CRUD = Admin+) 위반. God Component 분리로 `openCreate` 가 독립 핸들러로 확립됨에 따라 가드 추가 시점 | `codebase/frontend/src/app/(main)/authentication/page.tsx` L263 | `{isAdmin && <Button onClick={form.openCreate}>...</Button>}` 로 감싸 Reveal·Edit 버튼과 동일 패턴 적용 |
| 2 | SECURITY / RBAC | Regenerate 버튼에 `isAdmin` 가드 없음 (pre-existing) — spec §3.2·§4.1 `auth_config.regenerate` 는 Admin+ 전용이나 모든 역할에 노출 | `codebase/frontend/src/app/(main)/authentication/page.tsx` L540–548 | `{isAdmin && (...)}` 로 감싸 Reveal·Edit 버튼과 동일 패턴 적용 |
| 3 | SECURITY / RBAC | Delete 버튼에 `isAdmin` 가드 없음 (pre-existing) — spec §3.2 Auth Config DELETE = Admin+ 이나 모든 역할에 노출 | `codebase/frontend/src/app/(main)/authentication/page.tsx` L549–557 | `{isAdmin && (...)}` 로 감싸 RBAC 원칙을 UI 레벨에서 강제 |
| 4 | TESTING | `AuthConfigCreateForm` 단위 테스트 부재 — `generatedKey` 유/무 분기(폼 렌더 vs 1회 노출 UI)를 컴포넌트 경계에서 격리 검증 불가 | `codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx` (신규) | `auth-config-create-form.test.tsx` 추가: `generatedKey` 유/무 분기 렌더링 및 "Done" 버튼 동작 검증 |
| 5 | TESTING | `AuthConfigEditDialog` 단위 테스트 부재 — `typeDisabled=true`·`showPassword=false` prop 전달 계약이 통합 경로로만 간접 검증됨 | `codebase/frontend/src/app/(main)/authentication/auth-config-edit-dialog.tsx` (신규) | `auth-config-edit-dialog.test.tsx` 추가: (1) typeDisabled 전달 시 type select disabled, (2) showPassword=false 시 password 필드 미렌더 직접 어설션 |
| 6 | TESTING | `AuthConfigFormFields` capability props 조합 단위 테스트 부재 — `showPassword=false`·`typeDisabled=true`·`showTypeLockedHint` 세 prop의 spec R-2 핵심 invariant를 컴포넌트 단독으로 검증 불가 | `codebase/frontend/src/app/(main)/authentication/auth-config-form-fields.tsx` (신규) | `auth-config-form-fields.test.tsx` 추가: (1) showPassword=false → password 미렌더, (2) typeDisabled=true → type select disabled, (3) showTypeLockedHint=true → hint 텍스트 렌더 |
| 7 | MAINTAINABILITY | `page.tsx` 가 여전히 745줄 — mutation 6개·인라인 confirm 다이얼로그 4개·usage drawer·테이블이 단일 컴포넌트에 공존. God Component 분리가 form 흐름에만 적용됨 | `codebase/frontend/src/app/(main)/authentication/page.tsx` (전체) | 후속 PR: regenerate/reveal/delete confirm 다이얼로그를 별도 컴포넌트로 추출하거나 mutation을 `useAuthConfigMutations` 전용 훅으로 분리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | Toggle(isActive) 버튼에 `isAdmin` 가드 없음 — spec §3.2 에서 Admin+ 전용인지 확인 필요 | `page.tsx` L503–517 | spec §3.2에서 isActive toggle RBAC 범위 확인 후 Admin+ 전용이면 `{isAdmin && (...)}` 추가 |
| 2 | DOCUMENTATION / SPEC | `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 분리 5파일 미등재 — 구현 증거 추적 불완전 (cross-spec·convention-compliance·plan-coherence 3곳 수렴) | `spec/2-navigation/6-config.md` frontmatter | `codebase/frontend/src/app/(main)/authentication/**` glob 으로 교체하거나 5파일 개별 열거 |
| 3 | REQUIREMENT | plan `spec-sync-config-gaps.md` 의 RBAC 가드 항목이 미완료(`[ ]`) 상태로 현 PR과 병행 존재 — plan이 의도적으로 별도 PR 분리 명시. 후속 실행 필요 | `plan/in-progress/spec-sync-config-gaps.md` L62 | 해당 없음(추적 목적 INFO). 후속 PR 실행 확인 필요 |
| 4 | TESTING | `usage-drawer.test.tsx` 와 `authentication-form.test.tsx` 간 `/auth-configs` mock 응답 구조 불일치 (`{ data: [CONFIG] }` vs `{ data: { data: [] } }`) — 한쪽이 실제 API 파싱 경로와 다른 구조를 검증할 가능성 | `__tests__/usage-drawer.test.tsx` L95–98 | mock 반환 구조 통일 또는 apiClient 응답 파싱 경로 확인 후 일치 |
| 5 | TESTING | `pickPlaintextSecret` 테스트에 빈 문자열 경계 케이스 미포함 — `{ key: "" }` 입력 시 `""` vs null 반환 동작 미명확 | `__tests__/auth-config-types.test.ts` L9–36 | `pickPlaintextSecret({ key: "" })` 케이스 추가 또는 빈 문자열 처리 요건 명확화 |
| 6 | TESTING | `useAuthConfigForm` 에서 `mode=null` 상태의 `setGeneratedKey` 후 `close()` 경로 미검증 | `__tests__/use-auth-config-form.test.tsx` | `mode=null` 상태 → `setGeneratedKey("secret")` → `close()` 케이스 추가 |
| 7 | MAINTAINABILITY | `close()` 수동 필드 열거 초기화 — 새 필드 추가 시 리셋 누락 위험 | `use-auth-config-form.ts` L83–95 | 초기값 객체 상수 정의 후 `close()` 에서 일괄 스프레드 리셋 패턴 고려 |
| 8 | MAINTAINABILITY | `auth-config-form-fields.tsx` 의 `select` 인라인 Tailwind 클래스 2곳 중복 | `auth-config-form-fields.tsx` L46–51, L86–93 | 공용 `Select` UI 컴포넌트 도입 또는 클래스 상수 추출 (후속 개선) |
| 9 | MAINTAINABILITY | confirm 다이얼로그 4개의 backdrop+카드 JSX 구조 반복 | `page.tsx` L287–422 | 공용 `ConfirmDialog` 컴포넌트 추출 (후속 PR) |
| 10 | DOCUMENTATION | `UseAuthConfigForm` 인터페이스 `openCreate` 에 "초기화 없이 create 모드 전환 (close 가 초기화 담당)" 계약 주석 누락 | `use-auth-config-form.ts` L24–58 | `openCreate` 에 한 줄 JSDoc 주석 추가 |
| 11 | DOCUMENTATION | `page.tsx` 모듈 레벨 주석 없음 — 리팩터링 후 남은 역할(목록·query·mutation·usage drawer 조율)이 미명시 | `page.tsx` 최상단 | 파일 상단에 역할 명시 JSDoc 블록 추가 |
| 12 | SCOPE | 변경 파일 10개 모두 `review/consistency/**` 산출물 — `codebase/`, `spec/`, `plan/` 영역 변경 없음. `_retry_state.json` 은 중간 상태 스냅샷으로 커밋된 것 | `review/consistency/2026/06/16/` | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | UI RBAC 가드 누락 3건(Add/Regenerate/Delete 버튼). 백엔드 `@Roles('admin')` 최종 방어선 유지. 비밀값 생명주기(30초 자동 클리어, 편집 폼 비밀값 제외)는 적절 |
| requirement | MEDIUM | spec §3.2 RBAC UI 가드 미충족 3건(Add/Regenerate/Delete). plan이 의도적으로 별도 PR 분리 명시하여 예상된 미완성. spec frontmatter `code:` 5파일 미등재 |
| scope | NONE | 변경 파일 전체가 `review/consistency/**` 산출물. 코드베이스·spec·plan 영역 변경 없음 |
| side_effect | MEDIUM | "Add Auth Method" `isAdmin` 가드 누락으로 Editor/Viewer 가 create 폼 접근 가능(백엔드 403). `pickPlaintextSecret` export 승격·`UseAuthConfigForm` 인터페이스 공개는 의도된 개선 |
| maintainability | LOW | `page.tsx` 여전히 745줄(mutation 6개·confirm 4개 잔류). RBAC 가드 패턴 불일치로 향후 버튼 추가 시 실수 유발 가능. 폼 분리 자체는 명확한 개선 |
| testing | MEDIUM | 신규 UI 컴포넌트 3개(`AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`) 단위 테스트 부재. mock 응답 구조 불일치 1건. 기존 통합 테스트는 동작 간접 커버 |
| documentation | NONE | 신규 파일 5개 모두 파일 수준 JSDoc 양호. spec frontmatter `code:` 미갱신·`openCreate` 계약 주석 누락·`page.tsx` 모듈 주석 부재는 INFO 수준 |

## 발견 없는 에이전트

- **scope** — 변경 범위 전체가 `review/consistency/**` 정책 허용 산출물. Critical/Warning 없음.
- **documentation** — Critical/Warning 수준 문서화 결함 없음.

## 권장 조치사항

1. **[즉시 — 이번 PR 또는 후속 RBAC PR]** "Add Auth Method" 버튼에 `{isAdmin && ...}` 가드 추가 (`page.tsx` L263). plan `spec-sync-config-gaps.md` 가 미완료(`[ ]`)로 추적 중인 항목이므로 후속 PR 실행을 보장한다.
2. **[즉시 — 이번 PR 또는 후속 RBAC PR]** Regenerate 버튼(`page.tsx` L540–548) 및 Delete 버튼(`page.tsx` L549–557) 에 `{isAdmin && ...}` 가드 추가.
3. **[권장 — 이번 PR 포함]** 신규 UI 컴포넌트 3개(`AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`) 단위 테스트 추가: capability props 조합(showPassword/typeDisabled/showTypeLockedHint) 및 분기 렌더링 격리 검증.
4. **[권장 — 이번 PR 포함]** `spec/2-navigation/6-config.md` frontmatter `code:` 를 `authentication/**` glob 으로 갱신해 구현 증거 추적 완결성 확보.
5. **[참고 — 후속 PR]** `usage-drawer.test.tsx` 와 `authentication-form.test.tsx` 의 mock 응답 구조 통일.
6. **[참고 — 후속 PR]** `page.tsx` 745줄 추가 분리: mutation → `useAuthConfigMutations` 훅, confirm 다이얼로그 → 공용 `ConfirmDialog` 컴포넌트.

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing_status=done`).

- **실행 (7명, forced)**: security, requirement, scope, side_effect, maintainability, testing, documentation
- **제외 (7명)**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 순수 리팩터링 — 알고리즘·렌더 경로 변경 없음 |
| architecture | 컴포넌트 분리 범위 내 리팩터링, 시스템 아키텍처 변경 없음 |
| dependency | 신규 외부 의존성 추가 없음 |
| database | DB 스키마·쿼리·마이그레이션 변경 없음 |
| concurrency | 비동기 동시성 패턴 변경 없음 |
| api_contract | 백엔드 API 엔드포인트·계약 변경 없음 |
| user_guide_sync | 사용자 가이드·문서 동기화 변경 없음 |