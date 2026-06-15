# Code Review 통합 보고서

## 전체 위험도
**LOW** — authentication/page.tsx God Component 분리 순수 리팩토링. Critical 발견 없음. WARNING 4건은 기능 회귀 아닌 코드 품질·UX 일관성 항목이며 일부는 이번 PR 이전부터 존재하던 기지 결함.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | Regenerate·Delete 버튼에 Admin RBAC UI 가드 누락 — 비-admin 에게 버튼 노출, 클릭 시 403 응답. 백엔드 `@Roles('admin')` 로 실제 권한상승은 차단되나 spec/5-system/1-auth.md §3.2 RBAC UI 정합성 위반. 이번 PR 이전 기지 결함이며 plan `spec-sync-config-gaps.md` 에 후속 추적 중. | `page.tsx` RefreshCw·Trash2 버튼 렌더링 섹션 | `{isAdmin && <Button …>}` 가드 추가 (후속 PR) |
| 2 | Security | `generatedKey` 평문 비밀값 자동 만료 타임아웃 없음 — `revealedSecret`은 30초 후 자동 클리어되나 `generatedKey`에는 동일 타임아웃 없어 평문이 무기한 state 에 잔존 가능. regenerate 성공 후 form.close() 미호출로 create 다이얼로그와 생명주기 분리 혼재. | `use-auth-config-form.ts` (generatedKey useState), `page.tsx` (regenerateMutation onSuccess) | `generatedKey` 세팅 후 30초 타임아웃으로 `setGeneratedKey(null)` 처리, 또는 regenerate 흐름에 별도 state 분리 |
| 3 | Maintainability / Architecture | `AuthConfigCreateForm`·`AuthConfigEditDialog` 의 다이얼로그 래퍼 DOM 중복 — `div.fixed.inset-0.z-50` 오버레이 + 카드 + 닫기 버튼 구조가 두 컴포넌트에 완전히 동일하게 복사. page.tsx 내 확인 모달 포함 시 5곳 이상 중복. 디자인 토큰 변경 시 다중 수정 필요. | `auth-config-create-form.tsx` 라인 813–870, `auth-config-edit-dialog.tsx` 라인 1009–1045 | `AuthConfigDialogShell` 공통 래퍼 컴포넌트 추출 (후속 PR) |
| 4 | Maintainability | `auth-config-form-fields.tsx` 내 `<select>` 인라인 className 이 두 곳에서 거의 동일하게 반복 — `"flex h-10 w-full rounded-md border …"` Tailwind 클래스 조합 중복. | `auth-config-form-fields.tsx` 라인 1346, 1387 | 공용 `SelectField` 컴포넌트 또는 `selectClassName` 상수 추출 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec frontmatter `code:` 목록에 신규 분리 5개 파일 미포함 — `spec/2-navigation/6-config.md` frontmatter 가 `authentication/page.tsx` 만 나열하고 신규 파일(`use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `auth-config-types.ts`)을 포함하지 않음. 코드가 올바르고 spec 이 낡은 상태. | `spec/2-navigation/6-config.md` frontmatter `code:` 섹션 | 코드 유지 + spec frontmatter `code:` 에 신규 5개 파일 경로 추가 (project-planner 경로) |
| 2 | Architecture | `UseAuthConfigForm` 인터페이스가 내부 setter 9개를 전부 공개 노출 — ISP 위반, 소비자가 불필요한 setter 에 의존, 외부에서 훅 내부 불변식 우회 가능. | `use-auth-config-form.ts` `UseAuthConfigForm` 인터페이스 | 고수준 액션 메서드와 setter 분리, 또는 컴포넌트별 필요 슬라이스만 props 전달 |
| 3 | Architecture | `validateAndProceed` 가 toast 부수효과를 직접 수행 — 프레젠테이션 관심사가 상태 레이어 훅 내부로 혼입. 재사용·테스트 격리 어려움. | `use-auth-config-form.ts` `validateAndProceed` 함수 | 검증 결과 객체 반환 후 toast 호출을 소비자가 담당하도록 분리 |
| 4 | Testing | `AuthConfigFormFields` hmac·bearer_token 타입별 조건부 렌더 테스트 없음 — 통합 테스트가 api_key 경로만 커버. hmac header/algorithm 렌더, showPassword/typeDisabled prop 조합 미검증. | `authentication-form.test.tsx` | `AuthConfigFormFields` 단위 렌더 테스트 추가 또는 hmac·basic_auth 타입 케이스 보완 |
| 5 | Testing | `openEdit → close → openCreate` 상태 시퀀스 미검증 — close 가 edit 데이터를 초기화하는 계약이 조합 시나리오에서 회귀 가드되지 않음. | `use-auth-config-form.test.tsx` | `openEdit → close() → openCreate()` 후 name === "" 확인 케이스 추가 |
| 6 | Testing | `authentication-form.test.tsx` `fireEvent.click` vs `userEvent.click` 혼재 — 이벤트 버블링·포커스 미재현으로 미래 disabled 상태 검증 등에서 결과 불일치 가능. | `authentication-form.test.tsx` 140·151·253행 등 | 클릭도 `await userEvent.click(…)` 으로 통일 |
| 7 | Testing | `use-auth-config-form.test.tsx` beforeEach 에서 `useLocaleStore.setState` 후 `afterEach` 복원 누락 — `authentication-form.test.tsx` 의 패턴과 불일치. | `use-auth-config-form.test.tsx` beforeEach | `afterEach(() => { useLocaleStore.setState({ locale: "en" }); })` 추가 |
| 8 | Testing | `authentication-form.test.tsx` `beforeEach`·`afterEach` 모두에서 `cleanup()` 중복 호출 — @testing-library/react 가 afterEach 에서 자동 cleanup 수행하므로 beforeEach 의 중복은 불필요. | `authentication-form.test.tsx` 225·234행 | `beforeEach` 의 `cleanup()` 제거 |
| 9 | Security | `pickPlaintextSecret` 서버 응답 config 객체 타입 검증 미흡 — `Record<string, unknown>` 수용으로 구조 변경 시 의도치 않은 필드를 비밀값으로 처리 가능. 프레젠테이션 레이어 전용이라 실제 위험 제한적. | `auth-config-types.ts` `pickPlaintextSecret` 함수 | 입력 타입을 명시적 필드로 한정하거나 zod 스키마 검증 적용 |
| 10 | Security | IP Whitelist 클라이언트 측 검증 단독 의존 가능성 — 공격자가 API 직접 호출 시 임의 문자열 전달 가능. 이번 변경 범위 외. | `use-auth-config-form.ts` `validateAndProceed` | 백엔드 DTO 에 `@IsIP()` 등 동일 검증 적용 여부 확인 |
| 11 | Maintainability | plan 문서의 `STATUS_BADGE_VARIANT` 산출 목록 기술이 실제 구현(`page.tsx` 에 위치)과 불일치 — 기능 문제 없으나 유지보수자 혼동 가능. | `plan/in-progress/spec-sync-config-gaps.md` / `page.tsx` | plan 산출 목록에서 해당 항목 제거 또는 "page 내 유지(의도적)" 주석 추가 |
| 12 | Documentation | `UsagePeriodCounts`·`AuthConfigUsage` 필드 JSDoc 누락 — `AuthConfig`·`UsageRecentCall`과 스타일 불일치. | `auth-config-types.ts` | `totalCalls`, `lastUsedAt`, `recentCalls` 필드에 짧은 인라인 JSDoc 추가 (선택 사항) |
| 13 | Scope / Architecture | `auth-config-types.ts` 에 도메인 타입(`AuthConfig`)과 usage 드로어 DTO(`UsageRecentCall`, `AuthConfigUsage`) 및 UI 상수(`AUTH_TYPES`) 혼재 — 응집도 저하. | `auth-config-types.ts` 전체 | 장기적으로 도메인 타입과 UI 상수 분리 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Regenerate·Delete RBAC UI 가드 누락(WARNING), generatedKey 자동 만료 없음(WARNING) |
| architecture | LOW | UseAuthConfigForm setter 전부 공개 노출(WARNING), validateAndProceed toast 부수효과 혼입(WARNING) |
| requirement | LOW | Regenerate·Delete RBAC UI 가드 누락(WARNING), SPEC-DRIFT: spec frontmatter code: 목록 미갱신(INFO) |
| scope | NONE | 모든 변경이 plan 명시 범위 내. 요청되지 않은 기능 추가 없음. |
| side_effect | NONE | 새로운 전역 상태·네트워크 부작용 없음. 모든 발견 INFO. |
| maintainability | LOW | 다이얼로그 래퍼 DOM 중복 5곳(WARNING), select className 중복(WARNING) |
| testing | LOW | 신규 컴포넌트 타입별 조건부 렌더 미검증(INFO 다수), 기능 차단 Critical 없음 |
| documentation | NONE | JSDoc 전반 양호. 선택적 개선 INFO 4건. |

## 발견 없는 에이전트

- **scope**: 모든 변경이 plan 명시 범위와 일치, 요청되지 않은 기능 추가 없음.
- **side_effect**: 새로운 전역 변수·파일시스템·네트워크 부작용 없음.
- **documentation**: Critical·Warning 없음. JSDoc 충실히 포함.

## 권장 조치사항

1. **(가장 우선) WARNING-2 — `generatedKey` 자동 만료 타임아웃 추가**: `generatedKey` 세팅 후 30초 등 타임아웃으로 `setGeneratedKey(null)` 처리. `revealedSecret` 30초 클리어 패턴과 일관성 확보.
2. **(후속 PR) WARNING-1 — Regenerate·Delete 버튼 RBAC UI 가드**: `{isAdmin && …}` 조건 추가. plan 에서 추적 중인 항목 완료 처리.
3. **(후속 PR) WARNING-3 — `AuthConfigDialogShell` 공통 래퍼 추출**: 5곳 이상 복사된 오버레이·카드 DOM 을 단일 SoT 컴포넌트로 통합.
4. **(후속 PR) WARNING-4 — `SelectField` 컴포넌트/상수 추출**: `auth-config-form-fields.tsx` 내 중복 className 통합.
5. **(SPEC-DRIFT) INFO-1 — spec frontmatter `code:` 목록 갱신**: `spec/2-navigation/6-config.md` 에 신규 5개 파일 경로 추가 (project-planner 경로).
6. **(테스트 보완) INFO-4,5 — 신규 컴포넌트 렌더 테스트 추가**: `AuthConfigFormFields` hmac·bearer_token 타입별 조건부 렌더, `openEdit → close → openCreate` 상태 시퀀스 회귀 가드.
7. **(테스트 정리) INFO-6,7,8 — 테스트 패턴 일관성**: `fireEvent` → `userEvent` 통일, `afterEach` Zustand 복원 추가, `beforeEach cleanup()` 중복 제거.

## 라우터 결정

라우터가 선별 실행 (`routing=done`):

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명, 전원 router_safety 강제 포함)
- **제외**: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 순수 구조 리팩토링으로 렌더링 경로·번들 크기 변경 없음 |
| dependency | 신규 외부 패키지 의존성 추가 없음 |
| database | 프론트엔드 전용 변경, DB 스키마/쿼리 변경 없음 |
| concurrency | 비동기 경쟁 조건 변경 없음 |
| api_contract | 백엔드 API 계약 변경 없음 |
| user_guide_sync | 사용자 대상 UI 동작 불변, 가이드 갱신 불필요 |