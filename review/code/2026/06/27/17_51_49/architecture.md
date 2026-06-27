### 발견사항

- **[INFO]** LlmService(서비스 레이어)가 model-config/dto/model-type.ts(DTO 레이어) 에서 ModelTypeFilter 를 import
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` 상단 `import type { ModelTypeFilter }` 라인
  - 상세: 서비스 레이어가 인접 모듈의 DTO 레이어를 type-only 로 참조한다. 방향은 `llm → model-config` 단방향이며 순환은 없다. 그러나 llm 서비스 도메인이 model-config DTO 스키마에 정적으로 의존하는 구조이므로, 두 모듈이 독립 패키지로 분리될 경우 의존 방향이 노출된다. RESOLUTION.md I-6 항목(ModelTypeFilter extends ModelInfo['type'] 단언)이 의도적으로 model-type.ts 에 두지 않은 이유도 동일 아키텍처 비대칭 우려다.
  - 제안: 현 규모에서는 수용 가능하다. 장기적으로 llm/interfaces/llm-client.interface.ts 의 ModelInfo['type'] 에서 ModelTypeFilter 를 직접 파생(`type ModelTypeFilter = ModelInfo['type'] & ('chat' | 'embedding')`)하거나, 두 모듈 공통 상위의 shared-types 위치로 이전하는 방안을 별 트랙 tech-debt 으로 기록한다.

- **[INFO]** `const PROVIDER_PROBE_THROTTLE = SENSITIVE_ACTION_THROTTLE` 알리아싱 패턴 — 얕은 객체 참조
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 및 `codebase/backend/src/modules/workspaces/workspaces.controller.ts`
  - 상세: 두 알리아스는 공유 상수의 참조 복사(값 복사 아님)다. `SENSITIVE_ACTION_THROTTLE` 에 `as const` 가 적용되어 있으므로 변형 위험은 없다. `@Throttle` 데코레이터는 이 객체를 런타임에 읽기 전용으로 소비하므로 실질 부작용이 없다.
  - 제안: 현재 패턴 유지. 추후 throttle 설정이 증가할 경우 `throttle.ts` 를 enum-object 패턴 대신 named export 함수로 전환하는 것도 고려할 수 있다.

- **[INFO]** `capModelList` 의 선택적 logger 파라미터 — 생산 경로 누락 위험
  - 위치: `codebase/backend/src/modules/llm/list-models-cap.ts` 함수 시그니처
  - 상세: logger 를 생략하면 절단이 발생해도 경고가 기록되지 않는다. 현재 두 생산 호출 경로(`LlmService.listModels`, `LlmPreviewService.previewModels`) 모두 `this.logger` 를 전달하므로 실질 누락은 없다. 그러나 미래 호출자가 logger 없이 호출할 경우 무음 절단이 된다.
  - 제안: 문서 수준에서 주의 사항을 명시하거나, 패키지 내 유틸 성격임을 감안해 현행 유지. 필요 시 기본 Logger 인스턴스를 내부에서 생성하는 방향도 가능하다.

### 요약

이번 변경은 아키텍처 관점에서 전체적으로 건전하다. SENSITIVE_ACTION_THROTTLE 의 `common/constants` 추출은 정책 SoT 를 단일화하고 분산 리터럴을 제거한다. MODEL_TYPE_ENUM/ModelTypeFilter 의 `model-config/dto/model-type.ts` 분리는 ParseEnumPipe·ApiQuery·LlmService.listModels 간 타입 정합을 단일 출처에서 유지하게 한다. list-models-cap.ts 는 단일 책임 원칙을 잘 준수하는 순수 유틸리티로, 선택적 로거 파라미터를 통한 의존성 주입 패턴이 테스트 격리에 기여한다. 모듈 의존 방향(llm → model-config, 공통 constants 수평)은 기존 C-2 cluster 4 순환 제거 원칙을 위반하지 않는다. LlmService 의 model-config/dto 에 대한 type-only 의존은 현재 규모에서 수용 가능하지만, 모듈 경계 분리가 강화될 경우 공유 타입 위치 재검토가 필요하다.

### 위험도

LOW
