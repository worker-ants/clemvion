# Architecture Review

## 발견사항

- **[INFO]** `ModelInfoDto`의 `type` 필드와 `ModelInfo['type']`(llm-client.interface.ts) 간 형식적 타입 연결 부재
  - 위치: `/codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` line 374 / `/codebase/backend/src/modules/model-config/dto/model-type.ts`
  - 상세: `ModelTypeFilter`(`MODEL_TYPE_ENUM`)는 `ModelInfo['type']`(`'chat' | 'embedding'`)와 값이 동일하나, 타입 import 연결이 없다. `model-type.ts` JSDoc 이 "값은 `ModelInfo['type']`과 일치한다"고 명시하지만, 컴파일러 레벨에서 강제되지 않는다. 향후 `LLMClient.listModels()`가 새 타입(예: `'rerank'`)을 반환하도록 확장될 때 `MODEL_TYPE_ENUM` 업데이트 누락이 silent drift를 유발할 수 있다.
  - 제안: 수용 가능한 trade-off. `model-type.ts`에 `type _TypeCheck = ModelTypeFilter extends ModelInfo['type'] ? true : never` 수준의 컴파일-타임 assertion을 선택적으로 추가하면 drift를 즉시 감지할 수 있다. 단, 현재 두 정의가 완전히 일치하고 JSDoc이 관계를 문서화하므로 즉각 조치 불필요.

- **[INFO]** `ModelInfoDto`의 모듈 배치 — `model-config/dto/responses/`에 위치하나 개념 원점은 `llm/interfaces/ModelInfo`
  - 위치: `/codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
  - 상세: 이 DTO는 LLM 클라이언트 인터페이스에서 유래한 개념(`ModelInfo`)을 미러하지만 API 라우트가 `model-configs` 아래에 있어 `model-config` 모듈의 DTO 레이어에 배치되었다. `llm → model-config` 단방향 의존만 유지하는 아키텍처 결정(순환 제거)에 부합하므로 현 배치가 올바르다. 다만 `llm-client.interface.ts`를 탐색하는 개발자가 대응 DTO를 쉽게 발견하지 못할 수 있다.
  - 제안: 현 배치 유지. `llm-client.interface.ts`의 `ModelInfo` JSDoc에 "DTO 미러: `model-config/dto/responses/model-config-response.dto.ts#ModelInfoDto`" 한 줄 참조를 추가하면 탐색성이 향상된다(선택 사항).

## 요약

이번 변경은 swagger 문서와 실제 wire shape 간 구조적 불일치(`ModelListDto`의 `{models:[]}` 객체 래퍼 vs 런타임의 bare `ModelInfo[]` 배열)를 교정하는 순수 OpenAPI 메타데이터 수정이다. `ModelInfoDto`는 `ModelInfo` 인터페이스를 정확히 미러하고, `ApiOkWrappedArrayResponse` 데코레이터를 통해 기존 Decorator 패턴을 일관되게 활용한다. `LlmModelConfigController`가 `llm` 모듈에 위치하면서 `model-config` 모듈의 DTO를 단방향으로 참조하는 구조는 순환 의존 소멸을 명시적으로 유지하며, `MODEL_TYPE_ENUM` SOT 활용으로 enum 정의 중복이 없다. SOLID 관점에서 단일 책임(DTO-per-shape)과 의존성 역전(추상 인터페이스 미러)이 모두 충족된다. 발견된 사항은 모두 INFO 등급으로 런타임 동작이나 구조적 결함이 없다.

## 위험도

NONE
