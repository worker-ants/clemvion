# 아키텍처(Architecture) Review

## 발견사항

### **[INFO]** God Component 분리 — SOLID 단일 책임 원칙 적용 (긍정)
- 위치: `page.tsx` diff, 전체 변경
- 상세: 이전 `page.tsx` 는 폼 상태 11개(`useState`) + `dialogMode` + `collectFormState` + `validateAndProceed` + `resetForm` + `handleEditClick` 모두가 단일 컴포넌트에 혼재했다. 이번 변경으로 다음과 같이 책임이 명확하게 분리되었다:
  - `useAuthConfigForm` — 폼 상태·검증·다이얼로그 모드 전환 (Custom Hook)
  - `AuthConfigFormFields` — 공유 입력 UI (Presentational)
  - `AuthConfigCreateForm` — 생성 흐름 UI + 평문키 1회 표시 (Presentational)
  - `AuthConfigEditDialog` — 편집 흐름 UI (Presentational)
  - `auth-config-types.ts` — 공유 타입·상수·순수 헬퍼
  - `page.tsx` — 쿼리/뮤테이션 오케스트레이터로 슬림화
- 제안: 현재 방향 유지. 긍정적 개선.

### **[INFO]** `UseAuthConfigForm` 인터페이스 — 의존성 역전 및 인터페이스 분리 (긍정)
- 위치: `use-auth-config-form.ts` 32~65행
- 상세: `AuthConfigCreateForm` 와 `AuthConfigEditDialog` 가 `UseAuthConfigForm` 인터페이스 타입으로만 `form` prop 을 받는다 — 구체 구현이 아닌 인터페이스에 의존. 테스트에서 `renderHook` 으로 훅을 직접 테스트할 수 있고, 향후 다른 구현체로 교체가 가능하다.
- 제안: 현재 구조 유지.

### **[WARNING]** `UseAuthConfigForm` 인터페이스 — 인터페이스 분리 원칙(ISP) 위반 가능성
- 위치: `use-auth-config-form.ts` `UseAuthConfigForm` 인터페이스 전체 (32~65행)
- 상세: 인터페이스가 단일 파일에 16개 멤버(상태 8쌍 + 메서드 5개)를 나열한다. `AuthConfigEditDialog` 는 `generatedKey`/`setGeneratedKey`를 실제로 사용하지 않고, `AuthConfigCreateForm` 는 `editTargetId`를 사용하지 않는다. 즉 두 소비자 컴포넌트 모두 필요 이상으로 넓은 인터페이스에 묶여 있다. 현재 소비자가 2개뿐이고 필드 추가가 예상되어 현실적으로 감내 가능하지만, 더 큰 확장이 생기면 ISP 위반으로 인한 커플링이 문제가 된다.
- 제안: 단기에는 현상 유지 가능. 장기적으로 `Pick<UseAuthConfigForm, 'name' | 'setName' | ...>` 형태의 소비자별 서브타입 뷰를 도입하는 방향을 고려할 것.

### **[WARNING]** `validateAndProceed` 가 `toast`(UI 사이드이펙트)를 직접 호출 — 레이어 책임 혼재
- 위치: `use-auth-config-form.ts` `validateAndProceed` 함수 내 `toast.error(...)` 호출 (약 105~125행)
- 상세: 커스텀 훅은 상태 관리·검증 로직만 담당해야 한다. 그러나 `validateAndProceed` 내에서 `toast.error`를 직접 호출하여 UI 사이드이펙트까지 담당한다. 이는 검증 결과를 caller 에게 에러 객체/메시지로 반환하고 toast 표시를 호출자(`page.tsx`)에서 처리하는 패턴과 대비된다. 현재 `handleCreate`·`handleUpdate` 는 toast 에 관여할 수 없어 오류 처리 전략 확장이 어렵다. 또한 훅이 UI 라이브러리(`sonner`)에 직접 의존하게 된다.
- 제안: `validateAndProceed` 가 검증 오류를 `{ key: string, invalid?: string[] } | null` 형태로 반환하고, 호출자(`page.tsx`)에서 toast 를 표시하도록 책임 분리. 또는 최소한 `onError?: (msg: string) => void` 콜백을 옵션으로 받아 DI 처리할 것.

### **[INFO]** `auth-config-types.ts` 에 도메인 타입·상수·헬퍼 함수 혼재 — 응집도 적절
- 위치: `auth-config-types.ts` 전체
- 상세: `AuthConfig`, `UsageRecentCall`, `AUTH_TYPES` 상수, `TYPE_LABEL_KEYS`, `STATUS_BADGE_VARIANT`, `pickPlaintextSecret` 함수가 한 파일에 있다. 이 항목들은 "auth config 화면의 공유 표현 계층 artifacts" 라는 공통 목적으로 묶여 있어 응집도가 충분히 높다. 단일 page 스코프 내 모듈이므로 허용 가능.
- 제안: 현재 유지. 다만 `STATUS_BADGE_VARIANT` 는 usage drawer recent call 용으로 특화되어 있으므로, usage drawer 가 별도 파일로 분리될 경우 이동을 고려할 것.

### **[INFO]** `TYPE_LABEL_KEYS` 와 `AUTH_TYPES` 데이터 중복 — 단일 진실 원칙(DRY) 경미 위반
- 위치: `auth-config-types.ts` 55~68행 (`AUTH_TYPES` 배열 + `TYPE_LABEL_KEYS` Record)
- 상세: `AUTH_TYPES` 의 `{ value, labelKey }` 와 `TYPE_LABEL_KEYS[value] = labelKey` 는 동일 매핑 정보를 두 가지 형태로 중복 보유한다. 새 인증 타입 추가 시 두 곳을 수정해야 하는 유지보수 위험이 있다.
- 제안: `export const TYPE_LABEL_KEYS = Object.fromEntries(AUTH_TYPES.map(t => [t.value, t.labelKey])) as Record<string, TranslationKey>` 로 통합하여 `AUTH_TYPES` 를 단일 소스로 유지할 것.

### **[INFO]** `AuthConfigCreateForm` 와 `AuthConfigEditDialog` 의 다이얼로그 오버레이 마크업 중복
- 위치: `auth-config-create-form.tsx` 13~17행, `auth-config-edit-dialog.tsx` 10~14행
- 상세: 두 컴포넌트 모두 `fixed inset-0 z-50 ... bg-black/50` 오버레이와 `max-w-md rounded-lg border ... p-6 shadow-lg` 카드 구조를 동일하게 복사한다. `page.tsx` 에 남아 있는 regenerate/reveal/delete 확인 모달(`max-w-sm` 변형)까지 포함하면 동일 패턴이 5회 반복된다. 세 번째 다이얼로그 추가 시 3중 복사로 이어진다.
- 제안: 공통 `DialogShell` 컴포넌트(`title`, `onClose`, `children`)를 추출하거나, 프로젝트에 이미 존재하는 UI 다이얼로그 컴포넌트를 활용할 것. 즉각적인 차단 요인은 아님.

### **[INFO]** 순환 의존성 — 없음 (긍정)
- 위치: 모듈 의존 그래프 전체
- 상세: 의존 방향이 단방향이다. `auth-config-form.ts` → (외부 없음), `auth-config-types.ts` → `auth-config-form.ts`, `use-auth-config-form.ts` → `auth-config-form.ts` + `auth-config-types.ts`, `auth-config-form-fields.tsx` → `use-auth-config-form.ts` + `auth-config-form.ts` + `auth-config-types.ts`, `auth-config-create-form.tsx`/`auth-config-edit-dialog.tsx` → `auth-config-form-fields.tsx` + `use-auth-config-form.ts`, `page.tsx` → 모든 위. 역방향 참조 없음.
- 제안: 현재 유지.

---

## 요약

이번 변경은 God Component(`page.tsx` 1066줄)를 목적별 모듈로 분리한 구조 리팩토링으로, SOLID의 단일 책임 원칙 적용과 응집도 향상이 명확하다. `useAuthConfigForm` 커스텀 훅이 인터페이스를 명시(`UseAuthConfigForm`)하여 프레젠테이션 컴포넌트와 상태 관리를 깔끔하게 분리했고, 의존성 방향도 단방향으로 정리되어 순환 의존성이 없다. 주요 아키텍처 주의점은 두 가지다: (1) `validateAndProceed` 가 `toast.error` 를 직접 호출하여 검증 로직과 UI 사이드이펙트 경계가 흐려진 점(WARNING), (2) `UseAuthConfigForm` 인터페이스가 16멤버로 넓어 소비자들이 실제 필요 이상의 API 에 묶이는 ISP 위반 가능성(WARNING). `TYPE_LABEL_KEYS` 와 `AUTH_TYPES` 의 경미한 데이터 중복과 다이얼로그 오버레이 마크업 중복은 개선 여지가 있으나 즉각적인 차단 요인은 아니다.

## 위험도

LOW

STATUS: SUCCESS
