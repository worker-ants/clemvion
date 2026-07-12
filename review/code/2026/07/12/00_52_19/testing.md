# 테스트(Testing) 리뷰 — kb-websocket-emit-compile-guard

## 변경 요약

`EmbeddingService.emitEvent` / `GraphExtractionService.emitEvent` 의 `event` 파라미터를
`string` → `KbEventType` 로 좁히고 `as Parameters<...>[1]` 캐스트를 제거. `websocket.service.ts`
는 JSDoc 주석만 추가. `KbEventType` union 멤버 자체는 무변경(11종 유지) — 순수 컴파일타임
타입 강제 강화이며 런타임 동작·시그니처 외부 계약은 동일.

## 발견사항

- **[INFO]** 컴파일타임 가드를 "실증"하는 회귀 테스트 부재
  - 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts` L397-410, `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts` L926-938
  - 상세: plan(`plan/in-progress/kb-websocket-emit-compile-guard.md`)의 목표는 "union 밖 이벤트명을 build 에러로 차단"이다. 이 계약은 private 메서드 시그니처(`event: KbEventType`)만으로 표현되어 있고, 이 가드가 실제로 작동함(예: `'document:bogus_event'` 같은 리터럴을 넣으면 tsc 가 거부함)을 보이는 명시적 테스트(`// @ts-expect-error` 픽스처, 타입 레벨 테스트 등)는 없다. 확인 결과 `codebase/backend/jest.config.ts` 의 `ts-jest` transform 은 `isolatedModules` 옵션이 꺼져 있어(기본값) 매 `jest` 실행마다 실제 타입체크가 수행되므로(직접 `npx jest embedding.service.spec.ts graph-extraction.service.spec.ts` 실행 결과 `Test Suites: 2 passed, Tests: 24 passed` — 타입 에러 없이 통과), MEMORY 의 "vitest 는 타입을 strip 해 타입 가드가 no-op" 케이스와 달리 이 프로젝트의 backend jest 는 타입 오류를 실제로 잡는다. 다만 이 시그니처가 추후 다시 `string` 으로 되돌아가더라도(즉, 가드가 사라져도) 이를 자동으로 잡아줄 회귀 테스트는 없다 — 코드 리뷰에만 의존.
  - 제안: 낮은 우선순위. 필요 시 `websocket.service.ts` 또는 별도 `*.type-test.ts` 에 `// @ts-expect-error` 로 `emitKbEvent(id, 'not-a-real-event', {})` 를 호출하는 컴파일 전용 스니펫을 추가하면 "가드가 실제로 작동한다"를 자동 검증할 수 있다. 시그니처 자체가 소스에 명시적으로 남아 있어 diff 리뷰로도 회귀를 잡기 쉬우므로 강제 사항은 아님.

- **[INFO]** 테스트 double 의 `emitKbEvent` 타입이 여전히 느슨함
  - 위치: `embedding.service.spec.ts` L104-107, `graph-extraction.service.spec.ts` L45-48 (`mockWs = { emitKbEvent: jest.fn(), ... }`, `Record<string, jest.Mock>` 타입)
  - 상세: production 코드는 `event: KbEventType` 로 강화됐지만, 테스트의 mock 은 `jest.fn()` 이라 어떤 문자열을 넘겨도 타입 에러가 나지 않는다. `useValue: mockWs` 로 주입되는 지점에서 NestJS 테스트 모듈이 구조적으로 느슨하게 허용하기 때문에, mock 쪽에서 `KbEventType` 을 위반하는 이벤트명을 넣어도 컴파일 가드가 걸리지 않는다. 다만 이는 production 코드 쪽에서 이미 컴파일타임에 막히므로(호출부가 `emitEvent` 를 거쳐야만 mock 에 도달) 실질적 리스크는 낮다 — 참고용.
  - 제안: 조치 불필요. 프로젝트 전반의 기존 mocking 관례(느슨한 `Record<string, jest.Mock>`)와 일관되며, 강제할 경우 오히려 mock 보일러플레이트가 늘어난다.

## 회귀 검증 (직접 실행)

`npx jest embedding.service.spec.ts graph-extraction.service.spec.ts` 실행 결과:
`Test Suites: 2 passed, 2 total` / `Tests: 24 passed, 24 total` — plan 체크리스트의 "24 tests PASS" 주장과 일치. 두 spec 모두 `emitKbEvent.mock.calls` 를 필터링해 `document:embedding_retry` / `document:embedding_failed` / (graph 쪽) `document:graph_retry` / `document:graph_failed` 이벤트명이 정확히 emit 되는지 이미 검증하고 있어, 이번 타입 좁히기로 인한 런타임 동작 변화가 없음을 뒷받침한다.

## 항목별 평가

1. **테스트 존재 여부** — 순수 타입 강화(런타임 로직·분기 무변경)이므로 신규 테스트 불필요. 기존 `embedding.service.spec.ts` / `graph-extraction.service.spec.ts` 가 `emitEvent` 호출 지점(started/progress/completed/retry/failed, graph의 started/progress/completed/retry/failed)을 이미 간접 커버.
2. **커버리지 갭** — 없음. 새 코드 경로·분기가 추가되지 않았다.
3. **엣지 케이스 테스트** — 해당 없음. null/경계값 처리 로직 변경 없음.
4. **Mock 적절성** — `mockWs.emitKbEvent = jest.fn()` 로 실제 `WebsocketService.emitKbEvent` 시그니처(`documentId, eventType: KbEventType, payload`)와 인자 개수·순서가 일치하고, 기존 assertion(`c[1] === 'document:embedding_retry'` 등)이 여전히 유효 — 괴리 없음.
5. **테스트 격리** — 영향 없음. 각 `describe` 블록의 `beforeEach` 가 mock 을 재생성해 독립적.
6. **테스트 가독성** — 영향 없음 (테스트 코드 변경 없음).
7. **회귀 테스트** — 기존 24개 테스트가 변경 후에도 통과함을 직접 실행으로 확인(위 "회귀 검증" 참조). `websocket.service.ts` 변경은 JSDoc 주석뿐이라 회귀 리스크 없음.
8. **테스트 용이성** — 오히려 개선. `event: string` + unsafe cast 조합은 오타·union 밖 이벤트명이 런타임까지 새어나갈 수 있었고 그런 결함은 오직 런타임 테스트(mock 호출 검증)로만 잡을 수 있었다. `event: KbEventType` 로 좁히면서 이제 컴파일타임에 원천 차단되므로, 이 클래스의 오타성 결함에 대한 테스트 필요성 자체가 줄었다(타입 시스템이 대신 보증).

## 요약

`EmbeddingService`/`GraphExtractionService` 의 private `emitEvent` 헬퍼가 받는 `event` 파라미터를 `string`+unsafe cast 에서 `KbEventType` 리터럴 union 으로 좁힌 순수 컴파일타임 리팩터로, `KbEventType` 멤버 집합·런타임 동작·외부 계약이 전혀 바뀌지 않는다. 관련 spec(`embedding.service.spec.ts`, `graph-extraction.service.spec.ts`) 24개 테스트를 직접 재실행해 전부 통과함을 확인했고, backend jest 가 `ts-jest` 를 `isolatedModules` 없이(기본 타입체크 켜짐) 쓰기 때문에 이 타입 가드가 매 테스트 실행마다 실제로 검증된다(과거 vitest no-op 타입 가드 사례와는 다른 안전한 구성). 회귀·커버리지·mock·격리 어느 관점에서도 결함이 없으며, 유일한 개선 여지는 "가드가 실제로 이벤트명을 거부한다"를 증명하는 최소 컴파일-실패 픽스처의 부재인데 이는 낮은 가치의 INFO 수준 제안이다.

## 위험도

NONE
