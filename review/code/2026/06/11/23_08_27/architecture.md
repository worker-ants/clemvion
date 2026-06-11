# 아키텍처(Architecture) 리뷰

## 발견사항

### [WARNING] LlmModule ↔ ModelConfigModule 순환 의존 — forwardRef 해소의 구조적 원인 지속
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` `testConnection`/`listModels`, `llm.module.ts`
- 상세: `LlmService.testConnection`과 `listModels`가 `ModelConfigService.findEntity`를 직접 호출함으로써 `LlmModule → ModelConfigModule` 단방향 의존이 형성되어 있다. 문제는 `ModelConfigController`(또는 `ModelConfigModule` 내 다른 구성 요소)가 `LlmService`를 역방향으로 사용해 `ModelConfigModule → LlmModule` 의존도 존재한다는 점이다. 이 양방향 의존을 `forwardRef()`로 해소하고 있다. `forwardRef`는 NestJS가 공식 제공하는 메커니즘이므로 즉각적인 런타임 오류는 없지만, 두 모듈의 책임 경계가 뒤섞인 아키텍처 부채 신호다. 이번 변경은 이 구조를 새로 만들지는 않았으나 `findEntity` 호출을 `kind=chat` 고정에서 kind-agnostic으로 교체하면서 `LlmService`가 `ModelConfigService`에 더 직접적으로 의존하는 방향으로 결합을 강화했다.
- 제안: `LlmService.testConnection(config: ModelConfig)` 형태로 시그니처를 변경해 조회된 설정 객체를 외부에서 주입받으면 `LlmService`가 `ModelConfigService`를 주입받을 필요가 없어진다. 설정 조회 책임을 컨트롤러 또는 별도 유스케이스 레이어로 이전하면 순환 의존 자체가 해소된다. 현재 kind 분기가 2개 수준이므로 당장 강제할 필요는 없으나 `plan/in-progress/unified-model-management.md §7 W4` 백로그에 이미 등재되어 있으므로 중기 추적이 적절하다.

### [WARNING] LlmService.testConnection 내 kind 분기 — OCP 위반 잠재성
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L263–271
- 상세: `if (config.kind === 'embedding')` early-return 분기가 서비스 메서드 내부에 직접 삽입되어 있다. 현재는 분기가 embedding/나머지 2가지뿐이라 허용 수준이다. 그러나 `kind='rerank'`의 연결 검증 방식이 추가되거나 다른 kind(예: multimodal)가 도입될 경우 동일 메서드 내에 `else if` 분기가 누적되는 개방-폐쇄 원칙 위반 구조로 진행된다. `LLMClient` 인터페이스에 `testConnection(): Promise<boolean>` 시그니처는 있지만, embedding 특화 probe 로직을 인터페이스 수준으로 끌어올리는 `probeConnection(): Promise<{ dimension?: number }>` 추상이 없어 서비스 레이어가 kind 판정을 직접 담당한다.
- 제안: `LLMClient` 인터페이스에 `probeConnection(): Promise<{ dimension?: number }>` 메서드를 추가하고 각 클라이언트 구현체(OpenAI embedding, Cohere rerank 등)가 각자의 probe 전략을 캡슐화하도록 위임한다. `LlmService.testConnection`은 단순 위임자가 되어 kind 분기를 제거할 수 있다. kind 분기가 3개 이상 되는 시점을 리팩터링 기준점으로 삼는 것이 적절하다.

### [INFO] 프레젠테이션 레이어(ModelConfigManager)에서 도메인 사이드이펙트 처리 — 레이어 책임 경계 혼재
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` L90–101 (`testMutation.onSuccess`)
- 상세: `testMutation.onSuccess` 내부에서 연결 테스트 성공 결과 표시(UI 책임)와 감지된 `dimension`을 `modelConfigsApi.update`로 서버에 persist하는 동작(비즈니스 로직)이 동일 컴포넌트에 혼재한다. 현재 규모에서는 이해 가능하지만, 동일 패턴이 반복되면 컴포넌트가 점차 fat component로 비대해진다. `async onSuccess` 핸들러가 TanStack Query에서 반환값이 무시되는 점도 향후 오류 처리 추가 시 의도치 않은 동작을 유발할 수 있다.
- 제안: (a) 단기: `useTestConnection` 커스텀 훅으로 사이드이펙트(update + invalidate + toast) 로직을 컴포넌트 밖으로 분리하여 테스트 가능성과 재사용성을 높인다. (b) 중기: 백엔드 `testConnection` 엔드포인트가 감지된 `dimension`을 서버 측에서 직접 persist하도록 이전하면 프론트엔드는 toast 표시 목적으로만 `dimension` 값을 읽으면 된다. 단, 이 경우 "연결 테스트와 저장을 분리하여 사용자가 확인 후 저장한다"는 UX 의도가 있다면 커스텀 훅 분리가 더 적합하다.

### [INFO] LlmService 반환 타입과 ModelTestConnectionResultDto 간 암묵적 필드 매핑
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L253, `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
- 상세: `LlmService.testConnection`의 반환 타입은 `{ success, error?, dimension? }`이고 `ModelTestConnectionResultDto`의 필드는 `{ success, message?, latencyMs?, dimension? }`다. `error` vs `message` 필드명이 불일치한다. 컨트롤러에서 변환이 이루어지고 있을 것이나, 명시적 DTO 매핑 함수 없이 암묵적으로 처리된다면 향후 필드 추가 시 매핑 누락 위험이 있다. 이번 변경에서 추가된 `dimension` 필드는 양쪽 모두에 동일하게 추가되어 일관성은 유지됐다.
- 제안: 서비스 반환 타입을 내부 인터페이스(`TestConnectionResult`)로 명명하고, 컨트롤러에서 DTO로의 명시적 매핑 함수(`toTestConnectionResultDto(result: TestConnectionResult): ModelTestConnectionResultDto`)를 두어 계약을 가시화할 것.

### [INFO] ModelConfigFormDialog의 dimensionAutoDetected 판정 기준 — editConfig 기준 적절
- 위치: `codebase/frontend/src/components/models/model-config-form-dialog.tsx` L373–374
- 상세: `dimensionAutoDetected = showDimension && editConfig?.dimension != null` 로직이 저장된 `editConfig` 기준으로 판정하여 생성 모드에서 첫 입력 시 필드가 잠기지 않도록 처리한 것은 단일 책임 측면에서 적절하다. 단, `dimension: 0`인 경우(`!= null` 통과 + falsy) 동작이 명세되어 있지 않다. 실제로는 0차원 임베딩이 무의미하므로 런타임 문제는 없으나, 추상화 수준에서 0을 "감지됨"으로 처리하는지 "미감지"로 처리하는지 명시가 없다.
- 제안: `editConfig?.dimension != null && editConfig.dimension > 0` 조건으로 명시적으로 유효 범위를 한정하거나, 인라인 주석에 "0은 유효한 차원값이 아니므로 실질적으로 미감지와 동일 처리"를 명시한다.

---

## 요약

이번 변경의 아키텍처적 핵심은 `LlmService.testConnection`과 `listModels`의 config 조회 경로를 `LlmConfigService`(kind=chat 고정)에서 `ModelConfigService`(kind-agnostic)로 교체하여 embedding/rerank 설정에서 연결 테스트가 실패하던 회귀를 수정한 것이다. 버그 수정 목적에는 부합하나 구조적으로 `LlmModule ↔ ModelConfigModule` 간 `forwardRef` 순환 의존을 강화하였고, `LlmService`가 설정 조회·클라이언트 생성·kind별 probe 분기까지 담당하는 넓은 책임 범위를 갖게 됐다. 프론트엔드 레이어에서도 연결 테스트 결과 표시와 dimension persist라는 두 책임이 단일 컴포넌트의 mutation 콜백에 혼재한다. 이들은 현재 기능 동작을 막는 결함은 아니며 `plan/in-progress/unified-model-management.md §7 W4` 백로그에서 이미 추적 중이나, 모델 kind 수가 늘어나면 kind 분기 누적·순환 의존 심화·fat component 패턴으로 확대될 위험이 있으므로 중기 리팩터링 기준점으로 관리할 것을 권장한다.

## 위험도

LOW

STATUS: SUCCESS
