# Side Effect Review

## 발견사항

### [INFO] 공유 상수 객체 참조 (두 컨트롤러가 동일 객체를 참조)
- 위치: `codebase/backend/src/common/constants/throttle.ts` / `llm-model-config.controller.ts` L380 / `workspaces.controller.ts` L1805
- 상세: `PROVIDER_PROBE_THROTTLE = SENSITIVE_ACTION_THROTTLE` 와 `INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE` 는 동일 객체 참조를 공유한다. TypeScript `as const` 없이 선언된 객체이므로 런타임에서 이론상 mutate 가능하다. 그러나 NestJS `@Throttle(options)` 데코레이터는 `Reflect.defineMetadata` 로 옵션을 저장하며 객체를 직접 변경하지 않는다. 실질적 mutate 경로 없음.
- 제안: 명시적 불변성을 원한다면 `export const SENSITIVE_ACTION_THROTTLE = { default: { ttl: 60_000, limit: 10 } } as const;` 로 선언. 현재 상태도 동작 문제는 없다.

### [INFO] `workspaces.controller.ts` — import 순서 역전
- 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` L1805~L1806 (diff 기준 `const INVITATION_THROTTLE = ...` 뒤에 `import { WorkspacesService }` 위치)
- 상세: `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 선언 이후에 `import { WorkspacesService }` 문이 위치한다. ECMAScript `import` 문은 호이스팅되므로 런타임 참조 순서 문제는 없다. 단, ESLint `import/first` 규칙이 활성화된 경우 린트 에러 발생 가능성이 있으며, 코드 가독성에서 비표준 위치다.
- 제안: `import` 블록을 파일 최상단으로 이동하고 `const INVITATION_THROTTLE` 선언은 그 뒤에 배치한다.

### [INFO] `LlmService.listModels` opts.type 시그니처 변경
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L336 (diff 기준)
- 상세: `opts?: { type?: 'chat' | 'embedding' }` 에서 `opts?: { type?: ModelTypeFilter }` 로 변경됐다. `ModelTypeFilter` 는 `'chat' | 'embedding'` 과 정확히 동일한 유니온 타입이므로 컴파일 타임·런타임 모두 기존 호출자와 완전 호환된다. 브레이킹 변경 아님.
- 제안: 없음. 의도된 SOT 통합이며 런타임 영향 없다.

### [INFO] `capModelList` — 상한 이하 시 원본 배열 참조 반환
- 위치: `codebase/backend/src/modules/llm/list-models-cap.ts` L243 / `llm.service.ts` L1548~L1549
- 상세: `models.length <= MAX_MODEL_LIST_SIZE` 조건에서 `return models` (복사 없이 동일 참조 반환). `listModelsCache` 에 이 참조가 저장되어 client 반환 배열과 캐시 배열이 동일 객체를 가리킨다. 만약 호출 측 코드가 반환된 배열을 in-place mutate 할 경우 캐시가 오염된다. 단, 기존 코드에서도 `withTimeout` 결과를 복사 없이 직접 캐시에 저장하던 동일 패턴이며, 이번 변경이 새로운 위험을 추가한 것은 아니다.
- 제안: 방어적으로 `return models.slice()` 로 항상 복사본을 반환하도록 변경할 수 있으나, 현재 호출 패턴에서는 배열 mutate가 없으므로 우선순위 낮음.

## 요약

전체 변경 세트는 인라인 상수(`PROVIDER_PROBE_THROTTLE`·`INVITATION_THROTTLE`)와 로컬 타입(`MODEL_TYPE_ENUM`/`ModelTypeFilter`)을 공유 상수·DTO 파일로 추출하고, `capModelList`를 통해 provider 모델 목록 응답에 방어적 상한(500건)을 적용하는 리팩터링이다. 시그니처 변경(`opts.type` 타입 교체)은 런타임 동등 타입으로 호출자에 영향이 없으며, `capModelList`는 원본 배열을 mutate하지 않는 순수 함수다. `workspaces.controller.ts` 의 import 순서 역전이 코드 스타일상 비표준이지만 ECMAScript 호이스팅에 의해 런타임 문제는 없다. 공유 객체 참조(`SENSITIVE_ACTION_THROTTLE`)는 NestJS 데코레이터가 객체를 mutate하지 않으므로 안전하다. 의도치 않은 전역 상태 변경·파일시스템 부작용·환경 변수 읽기/쓰기·네트워크 호출·이벤트 변경은 없다.

## 위험도

LOW
