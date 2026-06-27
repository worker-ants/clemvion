# 유지보수성(Maintainability) 리뷰

리뷰 범위: ③ model-config polish (resolution 후 fresh review). 전회 W-1(import 순서)·W-3(spy 복원 누락)·I-7(as const)·I-9(toBe 통일)·I-13(JSDoc) 조치 확인 완료.

## 발견사항

- **[INFO]** `@ApiTooManyRequestsResponse` 설명 문자열 3곳 동기화 취약
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `previewModels`·`testConnection`·`listModels` 핸들러 각 `@ApiTooManyRequestsResponse({ description: '요청 빈도 초과 (분당 10회)' })`
  - 상세: `(분당 10회)` 가 3군데 하드코딩. `SENSITIVE_ACTION_THROTTLE.default.limit` 혹은 TTL 이 변경될 경우 상수 한 곳만 고쳐도 이 3개 description 은 자동 갱신되지 않는다. 컨트롤러 파일 내 모든 throttle 문서가 일치하는 동안은 문제 없으나 정책 조정 시 추적해야 할 위치가 는다.
  - 제안: `const THROTTLE_DESC = \`요청 빈도 초과 (분당 ${SENSITIVE_ACTION_THROTTLE.default.limit}회)\` as const;` 를 alias 옆에 추출해 3핸들러가 공유하면 limit 변경 시 자동 동기화. 단 현재 정책 변경 빈도가 낮고 3곳으로 제한되므로 강제성은 낮음.

- **[INFO]** `models` 변수 재할당 패턴
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm.service.ts` — `models = capModelList(models, this.logger);`
  - 상세: `models` 가 이미 `let` 선언(try 블록 외부에서 먼저 선언 후 내부 할당) 이므로 재할당 자체는 에러가 없다. 그러나 `const cappedModels = capModelList(models, this.logger);` 로 새 변수를 두면 cap 이전/이후 값이 명시적으로 분리되어 디버깅·독해가 쉬워진다. 현재 패턴도 즉시 `listModelsCache.set` 으로 이어져 독해에 실질 장벽은 없음.
  - 제안: `const cappedModels = capModelList(models, this.logger); this.listModelsCache.set(cacheKey, { models: cappedModels, fetchedAt: Date.now() });` 로 변수를 분리. 선택적 개선.

## 요약

이번 changeset 은 전회 리뷰에서 지적된 유지보수성 경고(import 순서, spy 복원, as const, 빈 배열 toBe, JSDoc 태그)를 모두 해소하였다. 신규 파일(`throttle.ts`, `list-models-cap.ts`, `model-type.ts`)은 단일 책임, 명확한 네이밍(`MAX_MODEL_LIST_SIZE`, `SENSITIVE_ACTION_THROTTLE`, `capModelList`), 충분한 JSDoc 을 갖추고 있으며 순환 복잡도가 낮다. 공유 상수 참조 별칭 패턴(`PROVIDER_PROBE_THROTTLE = SENSITIVE_ACTION_THROTTLE`, `INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE`)은 두 컨트롤러에서 일관되게 적용되어 도메인 의미와 단일 출처를 동시에 달성한다. 발견된 항목은 모두 INFO 수준이며 기능 정확성·가독성에 직접 영향이 없다.

## 위험도

NONE
