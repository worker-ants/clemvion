# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] TYPE_LABEL_KEYS 상수 파생 방식 변경
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (diff +2711~+2713)
- 상세: 기존 `page.tsx`에서 `TYPE_LABEL_KEYS`는 명시적 객체 리터럴로 정의됐으나, 이번 변경에서 `Object.fromEntries(AUTH_TYPES.map(…))` 로 AUTH_TYPES에서 동적 파생하도록 변경됐다. 이는 God Component 분리(AUTH_TYPES를 auth-config-types.ts로 이전)의 직접 결과로, 중복 정의를 제거하기 위한 필연적 변경이다. 기능·값 집합은 동일하므로 범위 초과로 보기 어렵다.
- 제안: 해당 없음 (범위 내 정당한 변경).

### [INFO] STATUS_BADGE_VARIANT 주석 추가
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (diff +2715~+2716)
- 상세: 기존에 없던 설명 주석 2줄이 `STATUS_BADGE_VARIANT` 상수 위에 추가됐다. 이동하지 않은 상수에 분리 경계를 명문화한 것으로 실질 로직 변경 없다. 무관한 주석 추가에 해당하나 분리 결정의 근거를 남기는 목적이 명확하다.
- 제안: 수용 가능.

### [INFO] plan 파일에 후속 미구현 항목 신규 추가
- 위치: `plan/in-progress/spec-sync-config-gaps.md` (diff +3397~+3401)
- 상세: God Component 분리 완료 기록 외에 `## 후속 — Regenerate·Delete 버튼 Admin(RBAC) UI 가드` 신규 섹션이 추가됐다. 이 항목은 이번 PR에서 구현하지 않는 별도 작업 계획이다. plan 파일은 developer 쓰기 권한 영역이며 살아있는 문서로서 다음 작업을 기록하는 것은 관행이다. 코드 동작에 영향이 없다.
- 제안: 수용 가능.

### [INFO] usage 드로어 전용 타입을 공유 types 파일로 이동
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` (라인 1500~1523)
- 상세: `UsageRecentCall`, `UsagePeriodCounts`, `AuthConfigUsage`는 usage 드로어에서 사용하는 타입으로 create/edit 폼과 직접 관련 없다. usage 드로어 자체는 이번 분리 범위에서 page.tsx에 유지하기로 결정됐으나 해당 타입들은 공유 파일로 이동됐다. 다만 plan 문서에서 `auth-config-types.ts`가 `공유 타입(AuthConfig·UsageRecentCall·…)`을 담는다고 명시적으로 기술하고 있어 의도된 범위 결정이다. 또한 usage 드로어 코드 자체는 page.tsx에 유지되어 있어 실제 동작 범위 초과는 아니다.
- 제안: 수용 가능. 향후 usage 드로어가 별도 컴포넌트로 추출될 때 재사용 가능한 위치에 타입이 이미 배치된다는 장점이 있다.

## 요약

이번 변경은 `authentication/page.tsx` God Component를 `useAuthConfigForm` 훅, `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`, `auth-config-types.ts` 5개 파일로 추출하는 순수 구조 리팩토링이다. plan 문서(`plan/in-progress/spec-sync-config-gaps.md`)에 명시된 범위(create/edit 폼 WARNING 1·4 해소)와 실제 변경이 일치하며, 동작·UI·API 호출·i18n 키는 불변이다. `UsageRecentCall`/`AuthConfigUsage` 등 usage 드로어 타입의 공유 파일 이동은 plan에서 명시적으로 의도된 결정이고, `TYPE_LABEL_KEYS` 파생 방식 변경은 중복 제거를 위한 필연적 조정이다. 요청되지 않은 기능 추가, 무관한 파일 수정, 의미 없는 포맷팅 변경은 확인되지 않는다. plan 파일에 후속 작업(Regenerate·Delete RBAC 가드)을 기록한 것은 해당 PR에서 구현하지 않는 항목이나 plan의 성격상 수용 가능한 범위다.

## 위험도

NONE
