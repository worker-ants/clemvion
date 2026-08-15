# 유지보수성(Maintainability) 리뷰

## 검토 방법

이번 diff(`origin/main`..HEAD)는 `websocket.service.ts` 의 값/타입 선언을 의존성-프리 모듈
`websocket-events.types.ts` 로 분리하는 리팩터(`aedea7d63`)와, 이미 세 차례(`19_27_37`,
`20_05_17`, `20_27_08`) 진행된 코드 리뷰 라운드가 지적한 항목을 반영한 수정 커밋(`65da1a9d7`,
`dc565afbf`, `a6d764ac6`, `e8585b574`)의 누적이다. 최신 커밋 `e8585b574` 는 직전 라운드
(`20_27_08`)의 W1(`import type` 4곳 누락)·W2(가드가 로컬 별칭으로 예외를 판정해 미검출)를
반영한다.

`review/**`·`plan/**` 문서는 프로세스 산출물이라 이전 라운드들과 동일하게 소스 코드 유지보수성
관점 밖으로 판단해 제외했다.

이전 라운드가 지적한 항목(클래스 JSDoc 고아화, `NotificationEventType` 이중 JSDoc, WARN #10
고아 주석, `websocket.gateway.ts` 순환 노드 누락, 회귀 가드 부재, `ExecutionChannelEvent` 등
7개 파일의 `import type` 누락)은 현재 소스(`websocket-events.types.ts`,
`execution-event-emitter.service.ts`, `websocket.service.ts`, `websocket.gateway.ts`,
`websocket-events.types.spec.ts`, `execution-engine.service.ts`, `ai-turn-executor.ts`,
`execution-event-emitter.service.spec.ts`, `websocket.service.spec.ts`)를 직접 `Read` 하여
전부 실제로 반영됐음을 재확인했다. 이번 라운드는 그 위에서 새로 남은 것만 찾는다.

## 발견사항

- **[INFO]** `websocket-events.types.spec.ts` 안에 "원 export 식별자 추출" 로직이 두 곳에 중복돼 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:126-127`(`originalName` 헬퍼 선언) 및 같은 파일 `:272`(`(el.propertyName ?? el.name).text` 인라인 중복)
  - 상세: 직전 라운드(`20_27_08` W2)가 고친 `originalName = (el) => (el.propertyName ?? el.name).text` 는 `{A as B}` 형태에서 로컬 별칭이 아니라 원 export 식별자를 봐야 한다는, 이 가드의 핵심 불변식을 담은 헬퍼다. 그런데 5번째 테스트("타입 전용 심볼을 `type` 표시 없이 import 하는 곳이 없다", `:241-284`)는 같은 판별이 필요한 지점(`:272`)에서 이 헬퍼를 재사용하지 않고 동일 표현식을 손으로 다시 썼다. `originalName` 이 `valueEdgeToWebsocketService` 함수 스코프 안에 지역 선언(`:112-173`)돼 있어 다른 `it()` 블록에서 import 할 수 없는 구조이기 때문이다. 지금은 두 곳이 우연히 같은 로직이지만, `originalName` 이 향후 다시 수정되면(예: 별칭 처리 로직이 한 번 더 틀렸던 이 저장소의 이력을 감안하면 가능성이 낮지 않다) 이 두 번째 자리는 자동으로 따라가지 않는다 — 정확히 이 PR 이 반복 겪은 "한 곳만 고치고 자매 지점을 놓친다" 패턴의 재료가 될 수 있다.
  - 제안: `originalName` 을 파일 최상단 모듈 스코프(다른 헬퍼 `parse`/`allTsFiles` 와 같은 레벨)로 끌어올려 두 지점 모두에서 import 없이 공유. 기능 변화 없는 순수 리팩터라 리스크 없음.

- **[INFO]** 파일 전수 파싱·순회 boilerplate 가 3번째·5번째 테스트에 거의 동일하게 반복된다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:213-222`(3번째 테스트의 `for (const file of allTsFiles(SRC_ROOT)) { const sf = parse(file); for (const st of sf.statements) {...} }`)와 `:253-281`(5번째 테스트의 동형 이중 루프)
  - 상세: 두 테스트 모두 "전체 소스 트리를 파싱해 각 statement 를 판별 함수에 넣고 위반을 모은다"는 동일한 골격이다. 판별 조건(값 간선 여부 vs 타입 미표시 여부)만 다르고 순회·오프더 수집 패턴은 동일해, 저장소 전체(1,200+ 파일)를 두 번 독립적으로 파싱한다. 향후 유사한 회귀 가드(이 파일이 이미 라운드마다 테스트를 하나씩 추가해 온 이력을 보면 가능성이 낮지 않다)가 추가될 때마다 같은 골격이 또 복제될 수 있다.
  - 제안: `collectOffenders(predicate: (file, statement) => string | null): string[]` 형태의 공용 순회 헬퍼로 추출하면 향후 6번째 가드를 추가할 때도 판별 함수만 넘기면 된다. 테스트 실행 시간·가독성 모두에 이득이 있으나, 현재 스위트가 통과하고 있고 기능적 결함이 아니므로 우선순위는 낮음.

- **[INFO]** 공허(vacuous) 방지 단언이 `toBeGreaterThan(N - 1)` 형태로 우회 표현돼 있어 의도가 즉시 읽히지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:190`
  - 상세: `expect(sf.statements.length).toBeGreaterThan(EXPECTED_EXPORTS.length - 1)` 는 의미상 "statements.length >= EXPECTED_EXPORTS.length" 를 검사하려는 것인데, jest 에 `toBeGreaterThanOrEqual` 이 있음에도 `length - 1` 로 우회해서 표현했다. 틀린 코드는 아니지만 읽을 때 "왜 -1 인가"를 한 번 더 계산해야 하고, 다른 파일의 유사 공허 방지 단언(`:250` `toBeGreaterThan(0)`)과 스타일이 어긋난다.
  - 제안: `expect(sf.statements.length).toBeGreaterThanOrEqual(EXPECTED_EXPORTS.length)` 로 교체. 의미 동일, 가독성만 개선.

## 그 외 확인 — 새로 지적할 결함 없음

- `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 상수와 JSDoc 배치(클래스 JSDoc 위)는 이전 라운드 W2 지적대로 계속 유지되어 있다.
- `websocket-events.types.ts` 는 export 전용 파일로 각 선언마다 출처(spec 문서)·용도가 JSDoc 으로 설명되어 가독성이 높고, `NotificationEventType` 이중 JSDoc·WARN #10 고아 주석은 확인 결과 모두 해소된 상태를 유지한다.
- 직전 라운드가 지적한 `import type` 4곳(`execution-event-emitter.service.ts`/`.spec.ts`, `execution-engine.service.ts`, `ai-turn-executor.ts`, `websocket.service.spec.ts`)은 전부 `type` 키워드가 붙어 있음을 재확인했다.
- `valueEdgeToWebsocketService` 의 `originalName` 교정(로컬 별칭이 아니라 원 export 식별자 기준)은 실제로 반영되어 있고, `export … from` 분기에 `WebsocketService` 예외를 두지 않은 비대칭 설계 의도도 인라인 주석으로 남아 있다.
- 나머지 22개 파일의 import 경로 교체는 전부 기계적 1:1 치환이며 값/타입 구분이 정확하다(`chat-channel.dispatcher.ts`, `notification-fanout.service.ts`, `background-execution.processor.ts`, `embedding.service.ts`, `graph-extraction.service.ts`, `websocket.gateway.ts` 등 직접 대조 완료).

## 요약

이 PR 은 네 차례의 커밋 사이클을 거치며 JSDoc 고아화·순환 노드 누락·회귀 가드 자체의 결함(별칭 오판정, 좁은 순회)·`import type` 누락 등 실질적인 유지보수성 결함을 순차적으로 해소해 왔고, 이번 라운드에서 직전(`20_27_08`) 지적 사항이 실제로 반영됐음을 소스 직접 대조로 재확인했다. 새로 지적할 CRITICAL/WARNING 급 결함은 없다. 남은 것은 신설된 회귀 가드 테스트 파일(`websocket-events.types.spec.ts`) 내부의 사소한 코드 중복(원 식별자 추출 로직 2곳, 파일 전수 순회 골격 2곳)과 한 단언문의 우회적 표현뿐이며, 전부 테스트 전용 코드에 국한되고 기능·정확성에는 영향이 없다.

## 위험도

NONE
