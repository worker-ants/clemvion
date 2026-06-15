# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] God Component 분리 — SOLID 단일 책임 원칙 준수 개선
- 위치: `page.tsx` 전체 diff (1066 → 621줄) + 신규 5파일
- 상세: 기존 `page.tsx` 는 형 상태 11개 + dialogMode 분기 + collectFormState/validateAndProceed + UI 렌더링을 단일 컴포넌트에 집중시켰다. 이번 변경으로 상태/검증 로직은 `useAuthConfigForm`, 생성 UI는 `AuthConfigCreateForm`, 편집 UI는 `AuthConfigEditDialog`, 공유 입력 필드는 `AuthConfigFormFields`, 공유 타입/상수는 `auth-config-types.ts` 로 분리됐다. SRP 관점에서 명확히 개선.

### [INFO] 의존성 방향 — 단방향 의존성 그래프 유지
- 위치: `auth-config-form-fields.tsx` → `use-auth-config-form.ts` / `auth-config-types.ts` → `auth-config-form.ts`
- 상세: 의존성 흐름이 `page.tsx` → 훅/컴포넌트 → 순수 로직(auth-config-form.ts) 단방향을 유지한다. 순환 참조 없음. `auth-config-types.ts` 가 `auth-config-form.ts` 에서 타입만 import 하고, `use-auth-config-form.ts` 도 `auth-config-form.ts` 에서 순수 함수/타입만 가져오는 구조로 레이어 경계가 명확.

### [WARNING] `UseAuthConfigForm` 인터페이스가 내부 setter를 전부 공개 노출
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` (`UseAuthConfigForm` 인터페이스, setName/setType/setHmacHeader 등 개별 setter)
- 상세: `setName`, `setType`, `setHmacHeader`, `setApiKeyHeader`, `setIpWhitelist`, `setUsername`, `setPassword`, `setGeneratedKey` 등 개별 setState가 인터페이스로 공개된다. 인터페이스 분리 원칙(ISP) 측면에서 소비자(`AuthConfigCreateForm`, `AuthConfigEditDialog`)가 자신이 실제로 필요하지 않은 setter에도 의존하게 만든다. 예를 들어 `AuthConfigEditDialog`는 `setGeneratedKey`, `setPassword` 를 직접 사용하지 않음에도 타입 계약상 이를 보유한다. 외부에서 임의로 `setGeneratedKey("secret")` 처럼 훅 내부 불변식을 우회하는 것을 막을 수 없다.
- 제안: 고수준 액션 메서드(`openCreate`, `openEdit`, `close`, `collectFormState`, `validateAndProceed`)와 UI 바인딩용 setter를 분리하거나, 컴포넌트별로 필요한 슬라이스만 props로 전달하는 방식을 검토. 단기적으로는 `setGeneratedKey`를 인터페이스 외부로 빼고 mutation onSuccess 처리를 훅 내부로 흡수하는 방식도 가능.

### [WARNING] `validateAndProceed` 가 toast 부수효과를 직접 수행 — 레이어 책임 혼재
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` (`validateAndProceed` 함수 내 `toast.error(...)` 호출)
- 상세: 검증 훅(`useAuthConfigForm`)이 검증 결과를 반환하는 대신 `toast.error(...)` 부수효과를 직접 실행한다. 프레젠테이션 레이어 관심사(사용자에게 오류 알림)가 비즈니스/상태 레이어에 해당하는 훅 내부로 들어온 구조다. 이로 인해 `validateAndProceed` 를 toast 없이 재사용하거나 다른 오류 표시 전략으로 교체하기 어렵다. 테스트에서도 `sonner` toast를 mock 처리해야 훅을 테스트할 수 있다.
- 제안: `validateAndProceed` 가 `{ valid: true } | { valid: false; errorKey: string; params?: Record<string, unknown> }` 형태의 결과를 반환하고, toast 호출은 소비자(page.tsx 또는 각 폼 컴포넌트)가 담당하도록 분리. 이렇게 하면 훅이 순수 검증 로직만 포함하게 되고 테스트 격리도 개선된다.

### [INFO] `auth-config-types.ts` 에 프레젠테이션 타입(UsageRecentCall, AuthConfigUsage 등)과 도메인 타입(AuthConfig)이 혼재
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` 전체
- 상세: `AuthConfig` 는 도메인 엔티티의 클라이언트 표현이고, `UsageRecentCall/AuthConfigUsage` 는 usage drawer 의 응답 DTO다. 이들이 단일 파일에 혼재하면 파일의 응집도가 낮아진다. `AUTH_TYPES` 상수도 셀렉트 UI 옵션이라 프레젠테이션 관심사에 가깝다.
- 제안: 현재 규모에서는 큰 문제가 아니나, 장기적으로 도메인 타입과 UI 상수를 분리하는 방향을 고려. 단기적으로는 현 구조가 God Component 분리로 이미 많이 개선됐으므로 INFO 수준으로 처리.

### [INFO] `AuthConfigCreateForm` 과 `AuthConfigEditDialog` 의 모달 렌더링 구조 중복
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-create-form.tsx` (오버레이 div), `auth-config-edit-dialog.tsx` (오버레이 div)
- 상세: 두 컴포넌트 모두 `fixed inset-0 z-50 flex items-center justify-center bg-black/50` 오버레이 + `w-full max-w-md rounded-lg` 내부 패널 구조를 그대로 복제한다. page.tsx에 남은 확인 모달(regenerate/reveal/delete)도 동일 패턴이다.
- 제안: 공통 `ModalShell` 또는 `DialogLayout` 컴포넌트를 `@/components/ui/` 에 추출하면 모달 외관 변경 시 단일 위치만 수정하면 된다. 이 이슈는 이번 PR 범위를 초과하므로 후속 개선 항목.

### [INFO] `openCreate` 가 필드 초기화를 수행하지 않는 암묵적 전제
- 위치: `codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts` (`openCreate` 함수)
- 상세: `openCreate` 는 `setMode("create")` 만 수행하고 필드를 초기화하지 않는다. "close 가 초기화 담당" 전제에 의존하는 구조다. 주석과 테스트에 명시돼 있어 의도는 명확하다. 하지만 `close` 를 거치지 않고 `openCreate` 를 두 번 연속 호출하는 시나리오에서 이전 draft가 잔류할 수 있다.
- 제안: 현재 사용 패턴에서는 문제없으나, `openCreate` 내에서도 방어적으로 필드를 초기화하거나 설계 전제를 주석으로 더 강하게 명시하는 것을 고려.

---

## 요약

이번 변경은 `authentication/page.tsx` God Component를 `useAuthConfigForm` 커스텀 훅 + `AuthConfigCreateForm` / `AuthConfigEditDialog` / `AuthConfigFormFields` 단일 목적 컴포넌트 + `auth-config-types.ts` 공유 타입 파일로 분리한 순수 구조 리팩토링이다. 아키텍처 관점에서 단일 책임 원칙과 관심사 분리가 크게 개선됐고, 의존성 방향이 단방향으로 유지되며 순환 참조가 없다. 다만 `UseAuthConfigForm` 인터페이스가 내부 setter 전부를 공개 노출해 인터페이스 분리 원칙을 위반하는 점, `validateAndProceed` 가 toast 부수효과를 훅 내부에서 직접 수행해 레이어 책임이 혼재하는 점은 향후 개선 여지가 있다. 전체적으로 기존 안티패턴(God Component, 분산된 `dialogMode === "edit"` 분기 4곳)을 제거했고 회귀 테스트 커버리지도 충분히 확보됐다는 점에서 아키텍처 방향은 적절하다.

## 위험도

LOW
