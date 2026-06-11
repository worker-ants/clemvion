# Testing Review — embedding dimension auto-detect

## 발견사항

### [INFO] testConnection 컨트롤러 레벨 테스트 — dimension 필드 전달 미검증
- 위치: `/codebase/backend/src/modules/model-config/model-config.controller.spec.ts`
- 상세: `testConnection` 엔드포인트(`POST :id/test`)에 대한 컨트롤러 스펙이 없다. 기존 컨트롤러 스펙에는 `findAll`, `update`, `remove`, `previewModels`, Roles 메타데이터 검사만 있고, `testConnection`/`listModels` 경로는 완전히 빠져 있다. `LlmService.testConnection`이 `{ success, dimension }` 를 반환할 때 컨트롤러가 이를 그대로 직렬화하는지 단위로 확인되지 않는다. 실제 직렬화는 NestJS가 담당하지만 DTO(`ModelTestConnectionResultDto`)와 실제 반환값의 정합성을 컨트롤러 수준 스펙으로 잠그지 않으면, DTO에서 `dimension` 필드를 실수로 제거해도 테스트가 잡지 못한다.
- 제안: `controller.testConnection('emb-1', 'ws-1')` → `mockLlmService.testConnection.mockResolvedValue({ success: true, dimension: 1536 })` 케이스를 컨트롤러 스펙에 추가해 반환값이 그대로 노출되는지 확인한다.

### [INFO] `listModels` 컨트롤러 스펙 부재 — kind-agnostic 경로 미검증
- 위치: `/codebase/backend/src/modules/model-config/model-config.controller.spec.ts`
- 상세: `LlmService.listModels`도 이번 변경에서 `modelConfigService.findEntity`(kind 무관)로 교체됐으나 컨트롤러 스펙이 없다. `testConnection`과 동일한 이유로 컨트롤러-서비스 위임이 단위 테스트 없이 통합 경로에만 의존한다.
- 제안: `controller.listModels` 위임 케이스(정상 반환, 서비스 오류 전파) 스펙 추가.

### [WARNING] `testConnection` 서비스 스펙 — `kind='rerank'` 경로 미검증
- 위치: `/codebase/backend/src/modules/llm/llm.service.spec.ts`, `testConnection` describe 블록
- 상세: 추가된 스펙은 `kind='embedding'` 3개 케이스와 기존 `kind='chat'` 케이스만 다룬다. `kind='rerank'`는 `client.testConnection()`을 호출하는 일반 경로를 타야 하는데(embedding 분기가 없으므로), 이 케이스에 대한 명시적 검증이 없다. `ModelConfigService.findEntity`가 rerank 설정을 반환할 때 `config.kind === 'embedding'` 분기에 빠지지 않고 `client.testConnection()`을 호출하는지 확인해야 한다.
- 제안: `kind='rerank'` 케이스에서 `mockModelConfigService.findEntity`가 `{ kind: 'rerank', ... }`를 반환하고, `mockClient.testConnection`이 호출됨을 검증하는 테스트를 추가한다.

### [INFO] probe embed에서 `vectors[0]` 길이를 dimension으로 쓰는 로직 — 벡터 구조 전제 미검증
- 위치: `/codebase/backend/src/modules/llm/llm.service.ts` L1532, `llm.service.spec.ts`
- 상세: `client.embed(['connection test'], config.defaultModel)` 가 2차원 배열(`number[][]`)을 반환한다고 가정한다. 스펙에서는 `mockClient.embed.mockResolvedValue([new Array(1536).fill(0)])` 로 `[[0,0,...]]` 구조를 가정하는데, 일부 provider client가 실수로 `number[]` 를 반환하면 `vectors[0]?.length`가 의미 없는 값이 된다. 타입 계약은 `number[][]`이므로 런타임 오류는 없지만, 예상치 못한 1차원 반환을 잡는 방어 테스트가 없다.
- 제안: INFO 수준이므로 강제는 아니지만, `embed` mock이 `[[]]` (빈 내부 배열)을 반환할 때 `dimension`이 `0`이 되어 falsy 판정으로 `{ success: true }` 를 반환하는 케이스를 추가 검토. 현재 `vectors[0]?.length`가 0이면 falsy이므로 "empty vector" 케이스 테스트(spec L626)와 동일 경로이나, 내부 배열이 비어 있는(`[[]]`) 경우가 외부 배열이 비어 있는(`[]`) 경우와 동일하게 처리되는지 명시적 테스트가 없다.

### [INFO] 프론트엔드 — 연결 테스트 성공 시 `dimension` 없는 embedding 케이스 미검증
- 위치: `/codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx`, `embedding connection test dimension auto-detect` describe
- 상세: `kind='embedding'`이지만 서버가 `dimension`을 반환하지 않는 경우(`{ success: true }`, dim 없음)에 `toast.success`가 일반 메시지("Connection succeeded.")로 표시되는지 검증하는 케이스가 없다. `model-config-manager.tsx` L2953 코드를 보면 `if (config.kind === "embedding" && dim)` 분기에서 `dim`이 falsy이면 `toast.success(t("models.connectionSucceeded"))`를 탄다. 이 경로가 테스트되지 않는다.
- 제안: `testConnectionMock.mockResolvedValue({ success: true })` (dimension 없음)로 embedding 테스트를 눌렀을 때 `connectionSucceeded` 토스트가 나오는 케이스 추가.

### [INFO] 프론트엔드 — `dimensionAutoDetected` 로직의 신규 생성 모드 분기 테스트 부재
- 위치: `/codebase/frontend/src/components/models/model-config-form-dialog.tsx` + 테스트 파일
- 상세: `dimensionAutoDetected = showDimension && editConfig?.dimension != null` 로직에서 `editConfig === null` (신규 생성 모드)일 때 필드가 편집 가능한지, `editConfig.dimension === 0` (falsy지만 `!= null` 통과)일 때 read-only가 되는지 테스트가 없다. 기존 테스트는 `dimension: 1536` (truthy)인 편집 케이스만 다룬다.
- 제안: `editConfig=null` 상태에서 폼을 열면 dimension input이 writable인지 확인하는 케이스 추가. `dimension: 0` 엣지 케이스(의미 없는 값이지만 `!= null` 통과)도 검토 대상.

### [INFO] Mock 구조 — `mockModelConfigService`와 `mockLlmConfigService` 의 findEntity 동시 노출
- 위치: `/codebase/backend/src/modules/llm/llm.service.spec.ts` beforeEach
- 상세: `mockLlmConfigService`에도 `findEntity`가 있고 `mockModelConfigService`에도 `findEntity`가 있다. `testConnection`은 이제 `mockModelConfigService.findEntity`를 사용하지만, 기존 테스트 케이스(L544 "should return success")에서 `mockLlmConfigService.findEntity`가 아닌 `mockModelConfigService.findEntity`가 호출됨을 명시적으로 `toHaveBeenCalledWith`로 검증하지 않는다. `testConnection`이 실수로 `llmConfigService.findEntity`를 다시 호출해도 chat kind의 기존 성공 케이스는 그대로 통과할 수 있다.
- 제안: `testConnection` 성공 케이스 (L544)에도 `expect(mockModelConfigService.findEntity).toHaveBeenCalledWith('config-1', 'ws-1')` 검증 추가.

## 요약

이번 변경의 핵심인 `testConnection`의 kind-agnostic 경로 전환과 embedding probe embed 차원 감지 로직은 백엔드 서비스 레벨에서 3개의 신규 단위 테스트로 명확히 커버된다(정상 감지, 빈 벡터, 에러 처리). 프론트엔드도 4개의 통합 테스트로 dimension 자동 저장, 중복 저장 방지, 저장 실패 격리, read-only 필드 렌더링을 검증한다. 전반적으로 회귀 방지 의도가 테스트에 잘 반영되어 있다. 다만 컨트롤러 레벨의 `testConnection`/`listModels` 스펙이 전혀 없어 DTO-서비스 계약의 단위 보증이 빠져 있으며, `kind='rerank'` 경로와 embedding kind이지만 dimension이 없는 응답 케이스가 테스트되지 않는다. 이 갭들은 실제 동작상 버그 가능성보다는 회귀 검출력의 약화로 이어지는 수준이다.

## 위험도

LOW
