## 발견사항

---

### **[WARNING] `PROVIDERS_REQUIRING_BASE_URL` 도메인 규칙이 DTO 레이어에 내재**
- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts:10-13`
- **상세**: "azure/local은 baseUrl이 필수"라는 비즈니스 규칙이 DTO 계층에 `ReadonlyArray<LlmProvider>` 상수로 정의되어 있다. DTO는 입력 형식 검증을 담당해야 하며 도메인 정책을 소유하면 안 된다. 이 규칙이 `@ValidateIf` 조건에 직접 인라인되어 DTO가 "어떤 프로바이더가 어떤 필드를 요구하는가"를 알게 된다. 실제로 이 규칙은 프론트엔드 `ModelCombobox`(`PROVIDERS_REQUIRING_BASE_URL: new Set(...)`)와 서비스 레이어 각각에 중복 정의되어 단일 출처를 갖지 못한다.
- **제안**: provider capability 정의를 `create-llm-config.dto.ts`(이미 `LLM_PROVIDERS`가 있는 곳)나 별도 `llm-provider.constants.ts`로 올려 DTO·서비스·프론트엔드가 동일 상수를 참조하도록 한다.

---

### **[WARNING] `LlmConfigController`의 크로스모듈 직접 의존이 `previewModels`로 더 고착됨**
- **위치**: `backend/src/modules/llm-config/llm-config.controller.spec.ts:9-11`
- **상세**: spec의 `ServiceMethods = Pick<LlmService, ...>`가 이를 잘 드러낸다 — `llm-config` 모듈의 컨트롤러가 `llm` 모듈의 서비스 메서드 4개를 알아야 하며, `previewModels`는 그 중 `LlmConfigService`를 전혀 사용하지 않는다. 컨트롤러가 두 모듈의 오케스트레이터 역할을 떠안는 구조이고, spec이 이 의존성을 명시적으로 고정한다.
- **제안**: `previewModels` 엔드포인트를 `LlmController`(llm 모듈 소속)로 이관하거나, `LlmConfigService`에 위임 메서드를 두어 컨트롤러가 단일 서비스에만 의존하도록 정리한다.

---

### **[WARNING] 컨트롤러 spec이 `previewModels`만 커버 — 파일명과 범위 불일치**
- **위치**: `backend/src/modules/llm-config/llm-config.controller.spec.ts`
- **상세**: 파일명은 `llm-config.controller.spec.ts`로 컨트롤러 전체를 암시하지만, `findAll`·`create`·`update`·`setDefault`·`remove`·`testConnection`·`listModels` 7개 핸들러에 대한 테스트가 없다. `mockLlmService`에 `clearClientCache`가 포함되어 있으나 어떤 테스트도 이를 검증하지 않는다. 이 파일이 유일한 컨트롤러 단위 테스트라면 기존 엔드포인트 회귀를 감지할 수 없다.
- **제안**: 파일 상단에 `// Covers only previewModels; full CRUD handler coverage lives in integration tests` 주석을 추가하거나, 파일명을 `llm-config.controller.preview.spec.ts`로 변경해 범위를 명확히 한다. `clearClientCache` mock도 검증 대상이 아니면 제거한다.

---

### **[WARNING] `data?.data ?? data` 응답 언래핑 패턴을 계약으로 고착**
- **위치**: `frontend/src/lib/api/__tests__/llm-configs.test.ts:33-43`
- **상세**: `"falls back to the body itself when not enveloped (interim dual-shape contract)"` 테스트가 `TransformInterceptor` 래핑 불일치라는 일시적 버그 우회를 정식 API 계약으로 명세화하고 있다. 이 패턴이 `listModels`와 `previewModels` 양쪽에 중복(`llm-configs.ts:72, 80`)되어 있어 향후 인터셉터 중앙화 리팩터 시 제거해야 할 지점이 분산된다. `previewModels` describe에는 non-envelope fallback 테스트가 없어 두 함수 간 계약 대칭성도 깨져 있다.
- **제안**: 테스트 설명을 `"interim: accepts raw array until transform interceptor centralizes unwrapping"` 형태로 임시임을 명시하고 `// TODO: remove after interceptor centralization` 주석을 추가한다. `previewModels`에도 동일한 fallback 케이스를 추가해 대칭성을 맞춘다.

---

### **[INFO] `PreviewLlmModelsDto`의 `@ValidateIf` 로직 — 유연성과 가독성 트레이드오프**
- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts:28-38`
- **상세**: 하나의 `@ValidateIf` 조건으로 "필수 누락"과 "선택적 전달"을 동시에 처리하는 패턴은 영리하지만 처음 읽는 개발자에게 비자명하다. `PROVIDERS_REQUIRING_BASE_URL.includes(dto.provider) || dto.baseUrl !== undefined` 조건이 "baseUrl이 필수인 프로바이더이거나 사용자가 값을 전달한 경우에만 검증"이라는 의미를 한눈에 파악하기 어렵다. 인라인 주석이 이를 설명하고 있으나, 향후 provider 정책이 변경될 때 `@ValidateIf` 조건·`PROVIDERS_REQUIRING_BASE_URL`·서비스 레이어 3곳을 동기화해야 한다는 암묵적 의존이 생긴다.
- **제안**: 현재는 수용 가능. 프로바이더가 늘어날 경우 커스텀 class-validator 데코레이터(`@RequiresBaseUrlForProvider`)로 추출해 재사용성을 높인다.

---

### **[INFO] `LlmService` 추상화 레벨 혼재 (저장 설정 기반 vs 임시 자격증명 기반)**
- **위치**: `backend/src/modules/llm/llm.service.ts` (spec의 `ServiceMethods` 참조)
- **상세**: `testConnection`·`listModels`·`chat`·`embed`는 DB에서 조회한 `LlmConfig` 엔티티를 매개로 동작하는 반면, `previewModels`는 raw 자격증명(`{ provider, apiKey, baseUrl }`)을 직접 받는다. `Pick<LlmService, 'testConnection' | 'listModels' | 'previewModels' | 'clearClientCache'>`라는 타입이 이 혼재를 그대로 반영한다. 같은 서비스가 두 가지 다른 입력 계약을 갖는 선례가 생겨 인터페이스 일관성이 희석된다.
- **제안**: 즉각 분리는 불필요하지만, `previewModels` 계열 기능이 추가될 경우 `LlmPreviewService`나 `LlmCredentialProber`로 분리하는 기준점으로 삼는다.

---

## 요약

DTO·서비스·컨트롤러 레이어 분리 자체는 적절하며, `previewModels`가 per-config 캐시를 우회하고 API Key를 비영속화하는 설계는 아키텍처적으로 올바르다. 그러나 세 가지 구조적 문제가 중기 유지보수 부담을 높인다. 첫째, "어떤 프로바이더가 baseUrl을 요구하는가"라는 도메인 규칙이 백엔드 DTO·서비스·프론트엔드 컴포넌트에 각각 독립 정의되어 단일 출처를 갖지 못한다. 둘째, `LlmConfigController`가 `LlmService`를 직접 주입받는 크로스모듈 결합이 `previewModels`로 더 고착되면서 `llm-config` 모듈의 경계가 점진적으로 희석된다. 셋째, `data?.data ?? data` 임시 언래핑 패턴이 테스트에 의해 계약으로 고착되어 추후 인터셉터 중앙화 시 제거 지점이 분산된다. `LlmService`의 두 가지 입력 계약 혼재는 현재 규모에서 관리 가능하나 기준점을 명확히 해두어야 한다.

## 위험도

**LOW**