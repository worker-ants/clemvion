# 아키텍처(Architecture) 리뷰

대상 변경: `authentication/page.tsx` God Component → page(오케스트레이터) + 커스텀 훅(상태) + create/edit/fields 컴포넌트(프레젠테이션) 계층화 리팩토링

---

## 발견사항

### 1. [INFO] 레이어 책임 분리 — 성공적 3계층 확립

- 위치: 모듈 전반
- 상세: 이번 리팩토링으로 다음 3계층이 명확히 분리되었다.
  - **데이터/비즈니스 로직 계층**: `auth-config-form.ts` (순수 함수 — 페이로드 조립·검증·기본값). 변경 없음, 기존 계층 유지.
  - **상태/오케스트레이션 계층**: `use-auth-config-form.ts` (커스텀 훅 — 다이얼로그 상태·폼 필드·검증 흐름). 신규 추출.
  - **프레젠테이션 계층**: `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields` (렌더링 전용, 부작용 없음). 신규 추출.
  - `page.tsx`는 쿼리/뮤테이션 오케스트레이터로 축소(1066 → 621줄).
- 제안: 현재 구조 유지. 레이어 책임이 의도에 부합한다.

---

### 2. [WARNING] `useAuthConfigForm` 인터페이스 — ISP 위반(인터페이스 분리 원칙)

- 위치: `use-auth-config-form.ts`, `UseAuthConfigForm` 인터페이스 (라인 181~214)
- 상세: `UseAuthConfigForm` 인터페이스가 다이얼로그 제어(`mode`, `openCreate`, `openEdit`, `close`, `editTargetId`), 필드 상태 및 세터(11쌍), 비즈니스 메서드(`collectFormState`, `validateAndProceed`), 파생 값(`generatedKey`)을 하나의 인터페이스로 통합해 소비자에게 노출한다. `AuthConfigFormFields`는 다이얼로그 제어(`openCreate`/`openEdit`/`close`·`editTargetId`) 없이 필드 상태만 소비하면 충분하지만 전체 인터페이스를 prop 으로 받는다. `AuthConfigCreateForm`·`AuthConfigEditDialog` 역시 `collectFormState`·`validateAndProceed` 같은 호출 계층 메서드를 포함한 과도한 인터페이스를 수신한다.
- 제안: 인터페이스를 분리하거나 prop drilling 을 최소화한다. 단기 실용안은 `AuthConfigFormFieldsProps` 에서 필요한 필드만 명시적으로 열거해 실제 의존성을 문서화하는 것이다. 장기 개선안은 `UseAuthConfigFormFields`(필드 값+세터)와 `UseAuthConfigDialogControl`(mode·open/close·editTargetId)로 인터페이스를 분할하는 것이다. 현재 규모에서는 기능 저해는 없으나 신규 auth type 추가 시 변경 파급 범위가 불필요하게 넓다.

---

### 3. [WARNING] `useAuthConfigForm` — 검증 로직과 토스트 UI 혼재 (단일 책임 원칙 경계)

- 위치: `use-auth-config-form.ts`, `validateAndProceed` 함수 (라인 294~328)
- 상세: `validateAndProceed` 는 `validateAuthConfigForm`(순수 검증, `auth-config-form.ts` 계층) 을 호출한 뒤 `toast.error(...)` 부작용을 직접 발동한다. 커스텀 훅이 UI 토스트 표시 책임을 갖는 것은 레이어 경계를 모호하게 만든다. 훅은 상태 관리 계층이지 알림 계층이 아니다. 이전 `page.tsx` 의 위치보다는 개선되었으나, `use-auth-config-form.ts` → `sonner` 직접 의존이 훅을 UI 프레임워크에 결합시킨다.
- 제안: `validateAndProceed` 가 `{ valid: boolean; error?: AuthConfigFormError }` 를 반환하고, 토스트 발동은 `page.tsx` 의 `handleCreate`/`handleUpdate` 에서 수행하도록 책임을 올린다. 이렇게 하면 훅은 순수한 상태 관리 계층이 되고 테스트에서 sonner 를 목킹할 필요가 없어진다. 단, 기존 동작 보존 관점에서 이번 리팩토링 범위를 벗어나므로 후속 개선으로 처리해도 무방하다.

---

### 4. [INFO] `auth-config-types.ts` 책임 혼재 — 수용 가능 수준

- 위치: `auth-config-types.ts`
- 상세: 이 파일은 API 응답 도메인 타입(`AuthConfig`, `UsageRecentCall`, `AuthConfigUsage`), UI 표시 상수(`AUTH_TYPES`, `TYPE_LABEL_KEYS`, `STATUS_BADGE_VARIANT`), 프레젠테이션 헬퍼(`pickPlaintextSecret`)를 하나로 묶는다. 도메인 타입과 UI 상수를 분리하면 더 순수해지지만, 이 모듈이 모두 동일 인증 설정 화면 바운디드 컨텍스트에 속하고 현재 파일 크기(77줄)가 작으므로 허용 가능한 설계 결정이다.
- 제안: 향후 `AuthConfig` 등의 도메인 타입이 다른 화면에서 재사용된다면 `types/auth-config.ts` 같은 공유 타입 파일로 분리를 검토한다. 현재는 현 위치 유지가 적절하다.

---

### 5. [INFO] `AuthConfigFormFields` capability prop 패턴 — 개방-폐쇄 원칙 관점

- 위치: `auth-config-form-fields.tsx`, `AuthConfigFormFieldsProps` (라인 395~403)
- 상세: 이전 `dialogMode === "edit"` 분기를 `typeDisabled`/`showTypeLockedHint`/`showPassword` 세 개의 capability prop 으로 대체한 것은 올바른 방향이다. 각 prop 이 독립적으로 제어 가능해 모드 추가 시 기존 코드를 수정하지 않고 prop 조합으로 대응할 수 있다. 다만 세 prop 모두 create/edit 이진 의미에서 유래하므로 현재 두 소비자(`AuthConfigCreateForm`, `AuthConfigEditDialog`) 외 제3 모드가 생기지 않는 한 실질적 OCP 이득은 제한적이다.
- 제안: 현재 구조 유지. 향후 "view-only 모드" 같은 제3 모드 요구 시 prop 추가만으로 대응 가능한 구조임을 확인한다.

---

### 6. [INFO] 순환 의존성 부재 확인

- 위치: 모듈 의존 그래프 전반
- 상세: 의존 방향이 명확히 단방향으로 정립되어 있다.
  - `auth-config-form.ts` (순수, 외부 의존 없음)
  - `auth-config-types.ts` → `auth-config-form.ts` (타입만)
  - `use-auth-config-form.ts` → `auth-config-form.ts`, `auth-config-types.ts`
  - `auth-config-form-fields.tsx` → `use-auth-config-form.ts`(타입), `auth-config-form.ts`(타입), `auth-config-types.ts`
  - `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx` → `use-auth-config-form.ts`(타입), `auth-config-form-fields.tsx`
  - `page.tsx` → 모두
  - 순환 참조 없음. 단방향 의존 그래프가 유지된다.
- 제안: 현재 구조 유지.

---

### 7. [WARNING] `page.tsx` 잔여 다이얼로그 — 모듈 경계 일관성 부재 및 훅 책임 누출

- 위치: `page.tsx`, Regenerate/Reveal/Delete 확인 모달 및 Revealed Secret 표시 (라인 1683~1818); `use-auth-config-form.ts`, `generatedKey`/`setGeneratedKey` (라인 207~208)
- 상세: Create/Edit 다이얼로그는 전용 컴포넌트로 분리되었으나, Regenerate 확인·Reveal 비밀번호 입력·Revealed Secret 표시·Delete 확인 — 네 개의 다이얼로그가 `page.tsx` 내부 JSX 인라인으로 남아 있다. 더 중요한 문제는 `regenerateMutation.onSuccess` 에서 `form.setGeneratedKey(secret)` 를 호출하는 패턴이다. 이는 `useAuthConfigForm` 가 create 폼 전용 훅이 아닌 "비밀값 1회 표시 버스"로 겸용되고 있음을 뜻하며, regenerate 흐름과 create 폼 훅의 상태 도메인이 교차된다. `generatedKey` 가 create 완료 상태인지 regenerate 완료 상태인지 훅 내부에서 판별이 불가능하다.
- 제안: 단기: `generatedKey`/`setGeneratedKey` 상태를 `useAuthConfigForm` 에서 분리해 `page.tsx` 로 올리고, `AuthConfigCreateForm` 이 `generatedKey` 를 직접 prop 으로 수신하게 한다. 이렇게 하면 `useAuthConfigForm` 의 책임이 create/edit 폼 영역으로 한정된다. 이번 PR 범위를 벗어나므로 후속 작업으로 처리해도 무방하다.

---

### 8. [INFO] `openCreate` 상태 초기화 부재 — 잠재적 stale 상태

- 위치: `use-auth-config-form.ts`, `openCreate` 함수 (라인 2254~2256)
- 상세: `openCreate` 는 `setMode("create")` 만 호출하고 폼 필드를 초기화하지 않는다. 주석이 "다이얼로그를 닫을 때마다 폼이 초기화되므로" 라고 설명하지만, 이는 `close()` 를 반드시 거쳐야 한다는 전제에 의존한다. 현재 UI에서 `close()` 외에 다이얼로그를 닫는 경로가 없음을 확인했으나, `openCreate` 내에서 명시적으로 리셋을 수행하는 방어적 설계가 더 견고하다.
- 제안: `openCreate()` 내부에 필드 초기화 시퀀스를 포함하거나, 내부 공유 `resetFields()` 헬퍼를 추출해 `close()`와 `openCreate()` 양쪽에서 호출한다. 현재 동작에 버그는 없으나 향후 다이얼로그 닫기 경로 추가 시 회귀 위험이 있다.

---

### 9. [INFO] 확장성 — 신규 AuthConfigType 추가 파급 범위

- 위치: `auth-config-form-fields.tsx` (라인 449~522), `auth-config-types.ts` (라인 774~779)
- 상세: 새로운 auth type(예: `oauth2`, `jwt`)이 추가될 때 수정이 필요한 지점이 명확히 격리되어 있다. `AUTH_TYPES`/`TYPE_LABEL_KEYS` 상수(`auth-config-types.ts`), 타입별 조건부 필드 렌더링(`auth-config-form-fields.tsx`), 페이로드 조립(`auth-config-form.ts` `buildTypeConfig`), 초기 상태(`useAuthConfigForm` 필드 추가). 변경 지점이 분산되어 있으나 각 파일의 책임이 명확해 추적이 용이하다. God Component 상태보다 현저히 개선되었다.
- 제안: 향후 type 수가 늘어날 경우 `auth-config-form-fields.tsx` 의 type별 분기를 전략 패턴(type → 컴포넌트 맵)으로 교체하면 개방-폐쇄 원칙을 더 엄격히 적용할 수 있다. 현재 4종 범위에서는 과도한 추상화다.

---

## 요약

이번 리팩토링은 1066줄짜리 God Component를 page(오케스트레이터) + 커스텀 훅(상태 관리) + 3개의 프레젠테이션 컴포넌트 + 공유 타입/상수 모듈로 명확히 분리하는 데 성공했다. 레이어 경계와 단방향 의존성 그래프가 잘 정립되어 있고, 순환 참조가 없으며, `dialogMode` 분기 제거로 조건 로직이 명시적 capability prop 으로 대체된 점은 구조적으로 올바른 개선이다. 주요 잔여 아키텍처 리스크는 두 가지다. 첫째, `UseAuthConfigForm` 인터페이스가 다이얼로그 제어·필드 상태·비즈니스 메서드를 단일 객체로 통합해 인터페이스 분리 원칙에 위배되며, 필드 추가 시 모든 소비자가 영향을 받는다. 둘째, `regenerateMutation.onSuccess` 에서 `form.setGeneratedKey` 를 호출하는 설계가 `useAuthConfigForm` 을 create 폼 전용 훅이 아닌 "비밀값 표시 전역 버스"로 겸용하게 만들어 훅의 응집도를 낮춘다. 두 항목 모두 이번 PR 범위(동작 불변 구조 추출) 를 벗어나므로 후속 PR에서 처리하면 적절하다.

## 위험도

LOW
