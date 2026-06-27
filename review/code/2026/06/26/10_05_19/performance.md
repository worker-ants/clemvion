# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `notifyInvalidated` 동기 리스너 순차 실행 — 타입 제약 부재
  - 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` — `notifyInvalidated` + `onConfigInvalidated` (신규 추가)
  - 상세: `notifyInvalidated`는 `for...of`로 리스너를 동기 순서 실행하며 반환값을 무시한다. 현재 유일 리스너인 `LlmService.clearClientCache`는 순수 동기 Map.delete이므로 문제 없다. 그러나 타입 시그니처가 `(configId: string) => void`이고 `await` 없이 호출하므로, 향후 비동기 리스너가 등록되면 그 Promise는 silently drop된다. 현재 코드는 L=1의 O(L) 순차 호출이므로 성능 비용 자체는 나노초 수준이다.
  - 제안: 비동기 사용 가능성을 미리 차단하거나 허용하도록 타입을 명시적으로 `() => void | Promise<void>`로 선언하고, 비동기 경로를 허용할 경우 `Promise.allSettled`로 수집. 현재 요건(cache delete)에서는 동기 타입 유지가 더 안전하다.

- **[INFO]** `clearClientCache` 내 `listModelsCache` 선형 스캔 — 기존 코드, 이번 PR 직접 수정 없음
  - 위치: `/codebase/backend/src/modules/llm/llm.service.ts` — `clearClientCache` (diff context, 미변경 섹션)
  - 상세: `listModelsCache`의 키 포맷이 `${workspaceId}|${configId}`이며, configId로 무효화할 때 전체 캐시 키를 O(N) 스캔해 `endsWith` 비교한다. 이번 PR이 `clearClientCache`를 직접 변경하지는 않았으나, 옵저버 경로로 동일 함수를 호출하므로 연계된 성능 특성이다. 워크스페이스·모델 설정 수가 소규모(통상 수십 개 이내)인 운영 조건에서는 허용 범위이나, 대규모 멀티테넌트 배포에서 캐시 엔트리가 수백 개 이상이 되면 매 update/remove마다 전체 스캔이 반복된다.
  - 제안: 즉각 수정 필요 없음. 향후 캐시 엔트리가 수백 개를 넘어설 가능성이 생기면 `Map<configId, Set<cacheKey>>` 역인덱스를 추가해 O(1) 무효화로 전환.

- **[INFO]** forwardRef 제거 — 양방향 모두 순(純) 성능 향상
  - 위치: `/codebase/backend/src/modules/llm/llm.module.ts`, `/codebase/backend/src/modules/model-config/model-config.module.ts`
  - 상세: NestJS `forwardRef`는 DI 토큰을 lazy-evaluate하는 프록시 객체를 생성하며, 모듈 초기화 시 추가 간접 참조 비용이 발생한다. 양측 `forwardRef(() => ...)` 제거로 이 오버헤드가 없어진다. 기능 측면이 주 목적이지만 초기화 성능도 소폭 개선된다.
  - 제안: 현행 유지.

- **[INFO]** `onModuleInit` 등록 비용 — O(1) Set.add, 1회 실행
  - 위치: `/codebase/backend/src/modules/llm/llm.service.ts` — `onModuleInit` (신규 추가)
  - 상세: `onModuleInit`는 NestJS 모듈 초기화 시 1회만 호출되며 `Set.add` 1회가 전부다. 런타임 경로(HTTP 요청)에는 영향 없다.
  - 제안: 현행 유지.

## 요약

이번 변경은 forwardRef 순환 제거를 위한 순수 아키텍처 리팩터이며 성능 측면에서의 실질 비용 증분은 극히 작다. 새로 추가된 `notifyInvalidated` 경로는 L=1 동기 리스너 1회 호출이고, `onModuleInit` 등록은 모듈 초기화 1회성 O(1) 연산이다. 오히려 양방향 forwardRef 제거로 DI 프록시 오버헤드가 줄어 초기화 성능은 소폭 개선된다. 지적할 잠재적 위험은 두 가지 INFO 수준이다: `notifyInvalidated`의 동기 타입 제약 부재(향후 비동기 리스너 silent-drop 위험)와 기존 `clearClientCache`의 O(N) 키 스캔(현 규모에서는 무해, 대규모 배포에서 모니터링 필요). 두 항목 모두 현재 운영 조건에서 즉각 수정이 필요한 수준이 아니다.

## 위험도

LOW
