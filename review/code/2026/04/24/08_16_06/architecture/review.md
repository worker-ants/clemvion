### 발견사항

---

**[WARNING] `ModelCombobox`가 API 라우팅 전략을 직접 보유 (SRP 위반)**
- 위치: `model-combobox.tsx:60-68` — `mutationFn` 내 `useSavedConfig` 분기
- 상세: "저장된 `configId` + 빈 `apiKey` → `listModels`, 그 외 → `previewModels`"는 도메인 규칙이다. 이 분기가 UI 컴포넌트의 `mutationFn` 안에 박혀 있어, 컴포넌트가 어떤 엔드포인트를 호출할지 스스로 결정한다. 플로우가 3개 이상으로 확장될 경우 컴포넌트 내부가 비대해지고 전략을 재사용하거나 단위 테스트하기 어려워진다.
- 제안: `useModelLoader(provider, apiKey, baseUrl, configId)` 커스텀 훅으로 추출. 컴포넌트는 `load()` 함수만 호출하고 어떤 엔드포인트를 쓰는지는 모른다.

---

**[WARNING] 프로바이더 도메인 규칙이 프론트·백엔드에 이중 표현**
- 위치: `model-combobox.tsx:34-39` (`PROVIDERS_REQUIRING_BASE_URL`, `providerRequiresApiKey`) vs `backend/src/modules/llm-config/dto/create-llm-config.dto.ts` (`LLM_PROVIDERS`)
- 상세: 백엔드는 `LLM_PROVIDERS`, `LlmProvider` 유니온으로 단일 출처를 유지하는데, 프론트엔드는 `LOCAL_PROVIDER = "local"`, `PROVIDERS_REQUIRING_BASE_URL = new Set(["azure", "local"])` 등 동일 규칙을 독립 하드코딩한다. `azure`가 `baseUrl` 필수 목록에 포함된다는 사실이 백엔드와 동기화되어 있는지 컴파일 타임에 검증할 방법이 없다. 프로바이더 추가·제거 시 두 곳을 별도 수정해야 하는 암묵적 의존성이 생긴다.
- 제안: 단기적으로 `@/lib/llm-providers.ts`에 상수를 모아 프론트엔드 전역에서 재사용. 중기적으로 OpenAPI 스키마 또는 공유 패키지(`/packages/shared`)로 단일 출처를 확보한다.

---

**[WARNING] `useSavedConfig && configId` — 불변식 중복으로 분기 단일 진입점 파괴**
- 위치: `model-combobox.tsx:65-68`
- 상세:
  ```ts
  const useSavedConfig = Boolean(configId) && !trimmedKey; // configId truthy 보장
  if (useSavedConfig && configId) {                        // configId 재검사 — 항상 참
  ```
  `useSavedConfig`가 `true`이면 `configId`는 이미 truthy다. `&& configId`는 TypeScript narrowing을 위한 방어적 코딩이지만, `useSavedConfig`라는 변수가 있음에도 `configId`를 다시 참조해 분기 결정의 단일 출처가 깨진다. 조건이 복잡해질수록 이 불일치가 버그를 낳는다.
- 제안: `if (useSavedConfig)` 로 단순화. narrowing이 필요하면 `if (useSavedConfig && configId != null)`처럼 타입 의도를 명시.

---

**[WARNING] `as never` 타입 단언이 컨트롤러 서비스 계약 검증을 완전 포기**
- 위치: `llm-config.controller.spec.ts:24-26`
- 상세:
  ```ts
  controller = new LlmConfigController(
    mockLlmConfigService as never,
    mockLlmService as never,
  );
  ```
  `as never`는 TypeScript 타입 시스템을 무력화한다. `LlmService.previewModels` 시그니처가 변경되어도 이 테스트는 타입 오류 없이 통과한다. `Record<string, jest.Mock>` 선언도 실제 서비스 인터페이스와의 드리프트를 컴파일 단계에서 잡을 수 없다.
- 제안:
  ```ts
  const mockLlmService: jest.Mocked<Pick<LlmService, 'previewModels' | 'listModels' | 'testConnection' | 'clearClientCache'>> = { ... };
  ```
  이렇게 명시하면 서비스 시그니처 변경 시 테스트가 컴파일 오류로 즉시 알린다.

---

**[WARNING] `data?.data ?? data` fallback이 API 레이어 불일치를 계약으로 고착**
- 위치: `llm-configs.test.ts:34-43` ("falls back to the body itself when not enveloped")
- 상세: 이 테스트는 두 가지 다른 응답 구조(envelope 있음/없음)를 모두 "정상 동작"으로 확정한다. 인터셉터 적용 범위 불일치라는 아키텍처 문제를 수정하는 대신 영속화한다. 향후 인터셉터를 중앙화하려 할 때 이 테스트가 걸림돌이 된다.
- 제안: 해당 케이스에 `// TODO: remove after transform interceptor centralization (W-12)` 주석으로 임시임을 명확히 한다. 장기적으로 axios 인터셉터에서 envelope을 일관되게 벗겨내면 분기와 테스트 모두 제거된다.

---

**[INFO] `LlmService`의 추상화 레벨 혼재 — 저장 설정 기반 vs. 임시 자격증명**
- 위치: `backend/src/modules/llm/llm.service.ts` — `previewModels` 메서드
- 상세: 기존 메서드(`chat`, `embed`, `testConnection`, `listModels`)는 DB에 저장된 `LlmConfig` 엔티티를 매개로 동작하지만, `previewModels`는 raw 자격증명을 직접 받는다. 서비스 클래스의 입력 계약이 두 가지 추상화 레벨을 혼재한다. 현재 규모에서는 관리 가능하나 `previewModels` 계열 기능이 추가될 경우 클래스 응집도가 희석된다.
- 제안: 이번 범위는 아니나, 계열 기능 추가 시 `LlmPreviewService`로 분리하는 기준점으로 삼을 것.

---

**[INFO] `model-combobox.tsx`가 axios를 직접 임포트 — 레이어 경계 약화**
- 위치: `model-combobox.tsx:5` — `import axios from "axios"`
- 상세: `axios.isAxiosError` 1회 호출을 위해 UI 컴포넌트가 HTTP 클라이언트 구현에 직접 결합된다. API 레이어(`llm-configs.ts`)가 에러를 domain 에러로 정규화하는 것이 레이어 책임 분리에 맞다.
- 제안: `llm-configs.ts`에서 axios 에러를 `ApiError` 형태로 변환 후 throw하거나, `@/lib/api/client`에서 `isApiError()` 유틸리티를 export해 UI 컴포넌트가 HTTP 클라이언트를 직접 알지 않도록 한다.

---

**[INFO] `LlmConfigController.previewModels`가 `LlmConfigService`를 전혀 사용하지 않음**
- 위치: `llm-config.controller.spec.ts:7-12` — `mockLlmConfigService` mock 포함, 하지만 `previewModels` 테스트에서 미호출
- 상세: `previewModels` 핸들러는 `LlmService`만 호출하고 `LlmConfigService`를 전혀 사용하지 않는다. 이 패턴이 확장되면 `LlmConfigController`가 두 모듈의 오케스트레이터 역할을 계속 떠안는다. 컨트롤러의 응집도가 낮아진다.
- 제안: 이번 범위 밖이나, `previewModels` 엔드포인트를 `llm` 모듈의 별도 컨트롤러로 이동하거나 `LlmConfigService`에 위임 메서드를 두는 방향을 중기 리팩터 후보로 기록.

---

### 요약

코드의 레이어 분리(DTO 검증 → Service 비즈니스 로직 → Controller 라우팅)와 보안 설계(per-config 캐시 우회, API Key 비영속화, 에러 sanitize)는 아키텍처적으로 올바른 선택이다. 그러나 세 가지 구조적 문제가 잔존한다: ① `ModelCombobox`가 어떤 API를 호출할지 결정하는 플로우 라우팅 로직을 직접 보유해 SRP를 위반하고 있으며(커스텀 훅 분리 권장), ② 프로바이더 도메인 규칙(`azure`/`local` baseUrl 필수 등)이 백엔드와 프론트엔드에 중복 하드코딩되어 컴파일 타임 동기화 보장이 없고, ③ 컨트롤러 테스트의 `as never` 단언과 `data?.data ?? data` fallback 계약화가 각각 서비스 계약 드리프트와 API 레이어 불일치를 감지하지 못하게 한다.

### 위험도

**LOW**