# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 6: auth-config-form.ts

- **[WARNING]** `buildAuthConfigPayload`와 `buildAuthConfigUpdatePayload` 간 config 조립 로직 중복
  - 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` 라인 2417–2429, 2453–2465
  - 상세: 두 함수 모두 `hmac`, `api_key`, `basic_auth` 타입별로 동일한 config 객체를 조립한다. 유일한 차이는 `api_key` 의 `headerName` 처리 방식(create: 빈 값이면 미포함 / update: 빈 값이면 default 값 사용)과, create 에 `password` 포함 여부다. 이 차이를 위해 함수 전체 본문을 복제하고 있어, 타입이 추가되거나 필드가 변경될 때 두 곳을 동시에 수정해야 한다.
  - 제안: 공통 config 조립을 헬퍼 함수 `buildTypeConfig(state, mode: 'create' | 'edit'): Record<string, unknown>` 로 추출하고, 두 함수가 이를 호출하는 구조로 리팩토링. 차이점(빈 headerName 처리, password 포함 여부)은 `mode` 파라미터로 분기.

- **[WARNING]** `formStateFromAuthConfig`의 `algorithm` 필드 처리가 hardcoded 값 `"sha512"` 에 의존
  - 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` 라인 2481–2482
  - 상세: `cfg.algorithm === "sha512" ? "sha512" : AUTH_CONFIG_DEFAULTS.hmacAlgorithm` 로직은 `AuthConfigFormState.hmacAlgorithm` 타입이 `"sha256" | "sha512"` 유니언임을 감안하면 의도는 이해되나, 허용 알고리즘이 추가될 경우(예: `sha384`) 이 코드를 명시적으로 수정해야 함을 알기 어렵다. 타입 가드 또는 허용 집합 방식이 더 안전하다.
  - 제안: `const VALID_HMAC_ALGORITHMS = new Set(["sha256", "sha512"] as const)` 를 정의하고 `VALID_HMAC_ALGORITHMS.has(cfg.algorithm) ? cfg.algorithm : AUTH_CONFIG_DEFAULTS.hmacAlgorithm` 패턴을 사용. 백엔드의 `HMAC_ALLOWED_ALGORITHMS` 와 동기화 주석 추가.

- **[INFO]** `formStateFromAuthConfig` 함수 내 `typeof cfg.X === "string"` 가드가 반복
  - 위치: `/codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` 라인 2486–2495
  - 상세: `apiKeyHeader`, `hmacHeader`, `username` 세 필드 모두 `typeof cfg.X === "string" && cfg.X ? cfg.X : DEFAULT` 패턴을 반복한다. 가독성은 나쁘지 않으나, 패턴이 미세하게 다른 부분(truthy 체크 포함 여부)이 섞여 있어 일관성 파악에 주의가 필요하다.
  - 제안: `function asString(v: unknown, fallback: string): string { return typeof v === "string" && v ? v : fallback; }` 내부 헬퍼로 중복 제거.

---

### 파일 2: auth-configs.service.ts

- **[INFO]** `update` 메서드의 config shallow-merge 루프가 서비스 메서드 본문에 인라인으로 구현됨
  - 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 라인 1102–1110
  - 상세: SECRET_CONFIG_KEYS 필터링 + shallow-merge 로직이 `update` 안에 직접 삽입되어 있다. 주석이 충분해 의도는 명확하나, 향후 `regenerate` 또는 다른 경로에서 유사한 merge가 필요해질 경우 재사용이 어렵다.
  - 제안: `private mergeNonSecretConfig(existing: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>` 로 추출하면 단위 테스트도 독립적으로 작성 가능해진다. 현 수준에서 크리티컬하진 않으나 메서드가 길어지면 추출 시점.

- **[INFO]** `create` 메서드의 타입별 비밀값 자동 발급 블록이 `if`/`if`/`if` 로 나열
  - 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 라인 1060–1070
  - 상세: `if (data.type === 'api_key')`, `if (data.type === 'bearer_token')`, `if (data.type === 'hmac')` 가 독립적인 `if` 블록으로 나열된다. 상호 배타적이지만 `else if` 를 쓰지 않아 읽는 사람이 "나머지도 평가되는가?" 를 잠깐 확인해야 한다. `regenerate` 는 `else if` 를 사용하는 반면 일관성이 없다.
  - 제안: `create` 의 타입 분기도 `if / else if / else if / else` 또는 `switch` 로 통일해 `regenerate` 패턴과 일관성을 맞춤.

---

### 파일 7: page.tsx (AuthenticationPage)

- **[WARNING]** 다수의 개별 `useState` 가 단일 폼 상태를 분산 관리
  - 위치: `/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 2916–2944
  - 상세: `formName`, `formType`, `formHmacHeader`, `formHmacAlgorithm`, `formUsername`, `formPassword`, `formApiKeyHeader`, `formIpWhitelist`, `generatedKey`, `dialogMode`, `editTargetId` 총 11개의 `useState` 가 폼 상태를 표현한다. 이 중 `formName`~`formIpWhitelist`는 `AuthConfigFormState` 타입이 이미 정의하는 구조와 1:1 대응한다. 상태가 많아질수록 `handleEditClick`(라인 2626–2639)에서 7회의 setter를 개별 호출해야 하고, 필드 추가 시 여러 곳을 동시에 수정해야 한다.
  - 제안: 폼 필드를 `const [formState, setFormState] = useState<AuthConfigFormState>(defaultFormState)` 로 통합. `handleEditClick` 에서 `formStateFromAuthConfig` 결과를 `setFormState` 한 번에 적용. `collectFormState` 함수가 이미 이 구조를 조립하고 있어 반전 방향(분산→통합)이 자연스럽다.

- **[WARNING]** `handleCreate`와 `handleUpdate` 의 유효성 검증 로직이 거의 동일하게 중복
  - 위치: `/codebase/frontend/src/app/(main)/authentication/page.tsx` `handleCreate` (미표시), `handleUpdate` (라인 2642–2666)
  - 상세: 두 함수 모두 `formName` 공백 검사, `basic_auth` 시 `username` 필수 검사, `validateAuthConfigForm` 호출, 에러 메시지 toast 처리를 동일하게 수행한다. `handleUpdate` 에는 `formType` 검사가 없지만 edit 모드에서 type 이 고정되므로 실질적으로 동일한 로직이다.
  - 제안: `function validateAndProceed(onValid: () => void): void` 로 공통 검증 추출 후 각 핸들러에서 호출.

- **[INFO]** `dialogMode === "edit"` 분기가 JSX 여러 곳에 분산
  - 위치: `/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 2695–2697, 2706–2710, 2742–2756, 2773–2793
  - 상세: 다이얼로그 타이틀, 타입 select `disabled`, 타입 잠금 안내 문구, 비밀번호 필드 조건부 렌더링, 버튼 분기 등 `dialogMode` 체크가 JSX 전반에 흩어져 있다. 기능 추가 시 누락 위험이 있다.
  - 제안: 단기적으로는 현 구조가 허용 가능하나, 다이얼로그 본문을 `CreateDialogContent` / `EditDialogContent` 또는 공통 `AuthConfigDialogForm` 컴포넌트로 분리하면 각 모드의 렌더링 책임이 명확해진다.

---

### 파일 1: auth-configs.service.spec.ts

- **[INFO]** 신규 update 테스트 4개가 두 개의 `describe` 블록에 나뉘어 삽입됨
  - 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` 라인 356–432
  - 상세: update config 관련 4개 테스트가 `describe('CRUD audit 기록 ...')` 블록 안에 삽입되어 있다. 이 블록의 제목("CRUD audit 기록")과 새로운 테스트들의 의도("config shallow-merge 동작 검증")가 일치하지 않아, 테스트 파일을 처음 보는 사람이 "audit 검증 블록에 왜 merge 검증이 있는가?" 라고 혼란스러울 수 있다. 동일 테스트가 diff 의 라인 35–111 에도 있고 라인 356–432 에도 있어 중복처럼 보이지만, 실제로는 전자가 `describe('CRUD audit ...')` 안에 추가된 것이고 후자는 해당 블록의 기존 content 다. 즉 `update` 의 config-merge 관련 테스트가 audit 블록 안에 배치된 것이 구조적 불일치다.
  - 제안: `describe('update — config shallow-merge / secret 보존')` 블록을 별도로 추출해 관련 테스트 4개를 이동. `describe('CRUD audit 기록')` 블록은 audit 기록 검증에만 집중.

---

### 파일 3: update-auth-config.dto.ts

- **[INFO]** API 문서 설명 문자열이 `+` 연산자로 분리된 긴 문자열 리터럴로 작성됨
  - 위치: `/codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` 라인 1531–1533
  - 상세: 다른 `@ApiPropertyOptional` 설명은 단일 문자열인데, 이 필드만 세 줄 `+` 연결을 사용한다. 기능적 문제는 아니나 패턴이 다르다.
  - 제안: 템플릿 리터럴(backtick)을 사용하거나, 팀 컨벤션에 따라 단일 긴 문자열로 처리.

---

### 파일 4, 5 (테스트 파일)

- **[INFO]** `authentication-form.test.tsx` 의 `openEditDialog` 헬퍼가 describe 블록 내부에 정의됨
  - 위치: `/codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` 라인 2190–2198
  - 상세: `openEditDialog`는 현재 단일 describe 블록에서만 사용되므로 내부 정의가 적절하다. 향후 다른 테스트에서도 동일 패턴이 필요해지면 `openDialogAsApiKey`처럼 상위로 이동 고려. 현재는 INFO 수준.

---

## 요약

이번 변경은 인증 설정 편집 폼 신설이라는 명확한 목표하에 백엔드 service의 config shallow-merge fix, 프론트엔드 payload 빌더 함수 추가, 편집 UI 연동을 일관성 있게 구현했다. 핵심 보안 로직(SECRET_CONFIG_KEYS 필터, 마스킹 값 역류 차단)은 주석이 충실하고 테스트 커버리지도 갖추었다. 유지보수성 관점에서 주요 위험은 두 가지다: (1) `buildAuthConfigPayload`와 `buildAuthConfigUpdatePayload` 의 config 조립 로직 중복으로, 인증 타입 추가 시 두 곳을 동시에 수정해야 하는 취약점 — 향후 회귀 원인이 될 수 있어 경고 수준으로 분류했다. (2) `page.tsx` 의 폼 상태를 11개의 개별 `useState`로 관리하는 패턴은 `AuthConfigFormState` 타입이 이미 존재함에도 이를 활용하지 않아 필드 추가 시 여러 setter를 산재해 수정해야 하며, `handleEditClick`의 setter 호출 누락 버그에 취약하다. 나머지 발견사항은 INFO 수준으로, 즉각적인 수정보다는 리팩토링 기회로 기록한다.

## 위험도

MEDIUM
