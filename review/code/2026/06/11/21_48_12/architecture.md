# Architecture Review

## 발견사항

### [WARNING] LlmService 가 ModelConfigService 에 직접 의존 — 순환 의존성 forwardRef 해소
- 위치: `codebase/backend/src/modules/llm/llm.module.ts` 전체, `llm.service.ts` 생성자
- 상세: `LlmModule`↔`ModelConfigModule` 이 `forwardRef()` 로 상호 순환 참조를 해소하고 있다. 원인은 `ModelConfigController` 가 `LlmService`를 사용하고, `LlmService.testConnection/listModels` 가 `ModelConfigService.findEntity` 를 역으로 필요로 하는 구조다. `forwardRef` 는 NestJS 가 공식 제공하는 메커니즘이므로 즉각적인 런타임 위험은 없지만, 순환 참조 자체는 두 모듈의 역할 경계가 뒤섞인 신호다. `LlmService` 는 "LLM 클라이언트 실행" 책임에 특화돼야 하는데, "설정 조회(kind 무관)" 책임까지 흡수해 SRP 위반 경향이 생겼다.
- 제안: `testConnection(config: ModelConfig)` 처럼 이미 조회된 설정 객체를 인자로 받는 인터페이스로 변경하면, `LlmService` 는 `ModelConfigService` 를 주입받을 필요가 없어져 순환 의존이 해소된다. 설정 조회 책임은 컨트롤러 또는 상위 유스케이스 레이어에서 수행하고 `LlmService` 로는 엔티티만 전달하는 구조가 더 명확하다.

### [WARNING] LlmService.testConnection 이 kind 분기 로직을 내부에 보유 — OCP 위반 가능성
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L526–534
- 상세: `if (config.kind === 'embedding')` 분기가 `testConnection` 내부에 있다. 향후 `rerank` 종류의 연결 테스트 방식이 추가되면 동일 메서드에 `else if (config.kind === 'rerank')` 를 계속 추가해야 하는 개방-폐쇄 원칙 위반 구조다. 현재는 분기가 2개(embedding / 나머지)뿐이어서 허용 가능한 수준이나, `LLMClient` 인터페이스 자체에 `testConnection` 의 기본 구현 또는 전략 패턴이 없기 때문에 서비스 레이어에서 분기가 누적될 위험이 있다.
- 제안: `LLMClient` 인터페이스에 `probeConnection(): Promise<{ dimension?: number }>` 메서드를 추가하고, 각 클라이언트(OpenAI, Cohere 등)가 embedding/chat 특성에 맞게 구현하도록 위임하면 `LlmService.testConnection` 은 단순 위임자가 된다. 당장 강제할 필요는 없으나 kind 분기가 3개 이상 될 경우 리팩터링 기준점으로 삼을 것.

### [INFO] 프레젠테이션 레이어(ModelConfigManager) 에서 도메인 사이드이펙트 실행
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` L954–959
- 상세: `testMutation.onSuccess` 내부에서 `modelConfigsApi.update(config.id, { dimension: dim })` 를 직접 호출한다. 연결 테스트 결과를 화면에 표시하는 UI 책임과 "감지된 차원을 서버에 persist 한다" 는 비즈니스 로직이 컴포넌트에 혼재한다. 현재 규모에서는 이해 가능하지만, 같은 패턴이 반복될 경우 컴포넌트가 점차 "fat component" 로 비대해진다.
- 제안: `testConnection` API 호출 자체가 서버 측에서 감지된 차원을 자동으로 persist 하도록 백엔드 책임으로 이동하는 것이 더 깔끔하다. 프론트엔드는 toast 표시 목적으로만 `dimension` 을 읽으면 된다. 단, 현재 설계에서 연결 테스트와 저장을 분리한 의도(연결 테스트 결과를 사용자가 확인 후 저장)가 있다면 커스텀 훅(`useTestConnection`)으로 사이드이펙트를 캡슐화하는 것을 권장한다.

### [INFO] LlmService.createClient 가 LlmConfig(=ModelConfig) 타입을 인자로 받으나 내부에서 LlmConfigService.getDecryptedApiKey 를 호출
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L1357
- 상세: `createClient(config: LlmConfig)` 는 `ModelConfig`(= re-exported `LlmConfig`) 를 받으면서도 `LlmConfigService.getDecryptedApiKey(config)` 를 통해 복호화한다. `LlmConfigService` 는 deprecated alias 레이어 위에 있는데, 복호화 책임이 구 서비스에 남아 있어 레이어 책임 분리가 완전하지 않다. `ModelConfigService` 가 복호화까지 담당하거나, 복호화 유틸이 별도 추출되어야 일관성이 유지된다.
- 제안: 복호화 로직을 `ModelConfigService` 또는 공통 `EncryptionService` 로 이전하고 `LlmConfigService` 의 복호화 책임을 제거하면 deprecated alias 레이어의 의존 방향이 단순해진다.

### [INFO] ModelTestConnectionResultDto 와 LlmService 반환 타입 사이에 암묵적 매핑
- 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` L1816–1821, `llm.service.ts` L1516
- 상세: `LlmService.testConnection` 의 반환 타입 `{ success, error?, dimension? }` 과 `ModelTestConnectionResultDto` 의 `{ success, message?, latencyMs?, dimension? }` 필드명이 `error` vs `message` 로 불일치한다. 컨트롤러 어딘가에서 `error` → `message` 변환이 이뤄지고 있을 것이나, 이 매핑이 명시적 DTO 변환 레이어 없이 암묵적으로 처리된다면 향후 필드 추가 시 매핑 누락 위험이 있다.
- 제안: 서비스 반환 타입을 내부 인터페이스(`TestConnectionResult`)로 명명하고, 컨트롤러에서 DTO 로의 명시적 매핑 함수를 두어 계약을 가시화할 것.

---

## 요약

이번 변경은 embedding 종류의 설정에서 연결 테스트가 `MODEL_CONFIG_NOT_FOUND` 로 실패하던 회귀를 수정하기 위해 `LlmService.testConnection/listModels` 를 `LlmConfigService`(kind=chat 고정) 대신 `ModelConfigService`(kind 무관)로 교체한 것이다. 버그 수정 목적에는 부합하나, 이 과정에서 `LlmModule`↔`ModelConfigModule` 간 `forwardRef` 순환 의존이 형성되었고, `LlmService` 가 설정 조회·클라이언트 생성·kind 별 probe 분기까지 담당하는 다소 넓은 책임 범위를 갖게 됐다. 레이어 구조상 비즈니스 로직이 프레젠테이션 컴포넌트(ModelConfigManager)로 일부 유출된 점도 향후 확장 시 부채가 될 수 있다. 이들은 당장의 기능 동작을 막는 결함은 아니지만, 모델 종류가 늘어날 때 분기 누적과 순환 의존 심화로 이어질 수 있으므로 중기 리팩터링 대상으로 추적할 것을 권장한다.

## 위험도

LOW
