### 발견사항

**[WARNING] LlmService.previewModels 파라미터 타입이 DTO의 `LlmProvider` 유니온을 계승하지 않음**
- 위치: `backend/src/modules/llm/llm.service.ts` — `previewModels` 시그니처
- 상세: `PreviewLlmModelsDto.provider`는 `LlmProvider` (열거형 유니온)이나, 서비스 메서드는 `provider: string`을 받는다. 컨트롤러가 DTO를 그대로 넘기지만 서비스 경계에서 타입이 넓어지므로, 컨트롤러를 우회해 서비스를 직접 호출하는 미래 코드(테스트·내부 모듈)가 잘못된 provider 문자열을 런타임까지 탐지 없이 전달할 수 있다.
- 제안: `import { LlmProvider } from '../llm-config/dto/create-llm-config.dto'`를 가져와 `params: { provider: LlmProvider; apiKey: string; baseUrl?: string }` 로 변경. 또는 `PreviewLlmModelsDto`를 서비스 레이어에서 직접 import하여 중복 타입 정의를 제거.

---

**[WARNING] LlmConfigController가 LlmService에 직접 의존하는 크로스모듈 결합이 증가함**
- 위치: `backend/src/modules/llm-config/llm-config.controller.ts` — 생성자 및 `previewModels` 핸들러
- 상세: `llm-config` 모듈의 컨트롤러가 `llm` 모듈의 서비스를 직접 주입받아 사용하는 구조는 기존에도 존재했으나, `previewModels`는 `LlmConfigService`를 전혀 사용하지 않고 순수하게 `LlmService`만 호출한다. 이 패턴이 확장되면 `LlmConfigController`가 두 모듈의 오케스트레이터 역할을 계속 떠안게 된다.
- 제안: `previewModels` 엔드포인트를 `LlmController`(llm 모듈)로 이동하거나, `LlmConfigService`에 `previewModels` 위임 메서드를 두어 컨트롤러가 단일 서비스에만 의존하도록 정리.

---

**[WARNING] preview-models 엔드포인트에 WorkspaceId 컨텍스트 부재**
- 위치: `llm-config.controller.ts:186` — `previewModels` 핸들러
- 상세: 동일 컨트롤러의 모든 다른 핸들러는 `@WorkspaceId() workspaceId`를 수집하는데, `previewModels`만 수집하지 않는다. 현재는 stateless 호출이라 영향이 없지만, 향후 요청당 LLM 비용 추적이나 감사 로그가 추가될 때 workspace 귀속이 불가능하다.
- 제안: 지금 당장 비즈니스 로직에 사용하지 않더라도 `@WorkspaceId() workspaceId: string`을 수집해 서비스에 전달하는 시그니처를 예비로 확보할 것.

---

**[WARNING] ModelCombobox 상태 이중 관리 (useState + useMutation 데이터 중복)**
- 위치: `frontend/src/components/llm-config/model-combobox.tsx:27-31`
- 상세: `useState<ModelInfo[]>`와 `useState<string | null>`을 별도로 관리하고 있는데, `useMutation`의 `data`와 `error`가 같은 정보를 이미 제공한다. `onSuccess`/`onError`에서 별도 state를 갱신하는 구조는 렌더 사이클 내 일관성 문제(mutation 결과와 local state가 일시적으로 불일치할 가능성)를 만들며, 코드 경로가 이중화된다.
- 제안: `loadMutation.data`와 `loadMutation.error`를 직접 파생해서 쓰고 local state를 제거. `chatModels`는 `loadMutation.data`를 필터링하는 useMemo로 처리.

---

**[INFO] LlmService 클래스의 응집도 희석 경향**
- 위치: `backend/src/modules/llm/llm.service.ts`
- 상세: `chat`, `chatStream`, `embed`, `testConnection`, `listModels`, `resolveConfig`, `previewModels`, `withRetry`, `sanitizeErrorMessage`까지 늘어났다. 기존 메서드들은 모두 `LlmConfig` 엔티티(저장된 설정)를 매개로 동작하나, `previewModels`만 raw 자격증명을 받는 다른 추상화 레벨이다. 현 규모에서는 관리 가능하지만, "저장된 설정 기반 LLM 호출"과 "미저장 자격증명 임시 조회"가 같은 클래스에 섞이는 선례가 생긴다.
- 제안: 지금 당장 분리는 불필요하나, `previewModels` 계열 기능이 추가될 경우 `LlmPreviewService`로 분리하는 기준점으로 삼을 것.

---

**[INFO] previewModels 엔드포인트에 Rate Limiting 부재**
- 위치: `llm-config.controller.ts:167` — `@Post('preview-models')`
- 상세: 이 엔드포인트는 외부 LLM Provider API를 직접 호출한다. 인증된 사용자라도 대량 반복 호출로 외부 API 비용을 유발하거나 API 키 유효성 탐색에 활용될 수 있다. 다른 endpoint들은 DB I/O로 자연스럽게 제한되나 이 경로는 그렇지 않다.
- 제안: NestJS `ThrottlerGuard` 또는 `@Throttle` 데코레이터를 이 엔드포인트에 적용.

---

### 요약

전체 구조는 잘 설계되어 있다. `previewModels` 기능이 per-config 캐시를 우회하고, API Key를 로그/캐시에 저장하지 않으며, 에러를 sanitize해서 외부에 원본을 노출하지 않는 점은 아키텍처적으로 올바른 선택이다. DTO 유효성 검증과 서비스 레이어 비즈니스 검증(`local` 예외 처리 등)의 역할 분리도 적절하다. 다만 `LlmService.previewModels`의 `provider` 타입이 DTO 레이어의 `LlmProvider` 유니온을 계승하지 않아 타입 안전성의 단절이 생기며, `LlmConfigController`가 `LlmService`에 직접 의존하는 크로스모듈 결합이 이번 기능 추가로 더 고착되는 점이 중기적으로 모듈 경계를 흐릴 수 있다.

### 위험도

**LOW**