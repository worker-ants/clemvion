# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `admitExecutionOrDefer` non-array fail-closed 테스트가 형제 테스트(`cap 초과(affected=0) → deferred`)와 달리 `executionRunQueue.add` 호출(delayed 재큐)을 단언하지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4491` (`it('UPDATE ... RETURNING 이 배열이 아니면 예외가 아니라 defer (fail-closed)', ...)`)
  - 상세: 이 테스트의 목적(런타임 shape 가드가 예외 대신 `deferred` 로 fail-closed 하는지)은 이미 명확히 검증됐고, `deferred` 반환 시의 재큐잉 배선은 인접 테스트(`4421` 라인)가 이미 커버하므로 실질적 커버리지 갭은 아니다. 다만 "왜 defer 로 떨어져도 안전한가"의 완결성(재큐까지 확인)을 이 테스트 하나로 닫고 싶다면 `mockExecutionRunQueue.add` 단언을 추가하는 편이 더 자기완결적이다.
  - 제안: 선택 사항. 현재 상태로도 회귀 방어 목적은 달성됨.

- **[INFO]** 같은 테스트에서 `spy`(emitSpy) 의 `mockRestore()` 가 `try` 블록 안, `warnSpy.mockRestore()` 만 `finally` 에 있다. `warnSpy` 는 `Logger.prototype` 전역을 spy 하므로 finally 처리가 맞지만, `spy` 는 인스턴스별(`service.eventEmitter`)이라 매 테스트 `beforeEach` 에서 `service` 가 새로 생성돼 실질적 누수 위험은 낮다. 이는 이 파일 전체에서 반복되는 기존 관례(`4417`·`4463`·`4479`·`4563` 등)와 동일한 패턴이라 이번 diff 가 새로 도입한 결함은 아니다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4504-4516`
  - 상세: 단언(`expect(warnSpy).toHaveBeenCalledWith(...)`)이 실패하면 `spy.mockRestore()` 줄이 스킵되지만, `service` 인스턴스 자체가 다음 테스트에서 재생성되므로 실질 영향은 미미.
  - 제안: 선택 사항 — 일관성을 위해 `spy.mockRestore()` 도 `finally` 로 옮기면 더 견고하지만, 기존 파일 관례와의 통일성 문제로 강제할 사안은 아님.

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `const` → `export const` 로 바꾼 변경은 테스트 전용 노출이다(프로덕션 소비자 없음). 심볼을 외부에 노출하는 것이 이 모듈의 캡슐화를 아주 소폭 넓히지만, 테스트가 "상수 값 자체(256)도 리터럴로 별도 고정"하는 패턴(`executions.service.spec.ts:518-520`)을 병행해 "심볼만 쓰면 상한이 조용히 바뀌어도 테스트가 따라간다"는 함정을 스스로 방지하고 있어 설계상 문제는 없다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:63`

## 검증 완료 사항 (긍정적 발견)

- **LRU 캐시 경계값+방향 테스트** (`executions.service.spec.ts:522-562`, `snapshotCache 는 256건 상한 — 257번째가 가장 오래된 키를 evict`): 257회 삽입 후 evict 대상이 실제로 "가장 오래된" 키인지, 중간에 `읽기`로 LRU 순서를 갱신한 키(e-0)가 evict 되지 않는지를 함께 검증한다. 직접 손으로 삽입/읽기 순서를 추적해 기대값(`afterFill`, `afterFill+1`, `afterFill+2`)을 검산했고 프로덕션 코드(`writeSnapshotCache`/`readSnapshotCache`, `executions.service.ts:166-202`)의 실제 LRU 로직과 정확히 일치함을 확인했다. `service` 는 최상위 `beforeEach` 에서 매 테스트 재생성되므로 `snapshotCache`(인스턴스 필드) 오염 없이 격리된다. 캐시 키가 `id` 파라미터(엔티티 자체의 `row.id` 아님)라는 점도 프로덕션 코드(`findById`, 527-614행)와 일치함을 확인했다.

- **`admitExecutionOrDefer` non-array 방어 테스트** (`execution-engine.service.spec.ts:4491-4520`): `EntityManager.query` 가 배열이 아닌 값(`undefined`)을 반환할 때 `TypeError` 로 죽지 않고 `deferred` 로 fail-closed 하는지, `logger.warn` 이 남는지를 검증한다. 프로덕션 코드(`execution-engine.service.ts:2926-2932`)의 `Array.isArray(rows)` 가드·warn 문구(`배열이 아님`)와 정확히 매치한다. 이웃 테스트들과 동일한 mock 스타일(`manager.transaction` 재정의)을 따라 회귀 위험이 낮다.

- **`ChatChannelDispatcher.handle` 의 debug/warn 삼항 분기 양방향 테스트** (`chat-channel.dispatcher.spec.ts:748-819`): `toChatChannelEvent` 가 null 을 반환할 때 `execution.node.completed`(정상 skip → debug)와 그 외 eventType(에러성 → warn)을 모두 고정한다. `Logger.prototype.debug`/`warn` 을 spy 해 두 조합(`debug 호출 + warn 미호출`, `warn 호출 + debug 미호출`) 을 각각 검증하므로 삼항을 한쪽으로 뒤집는 회귀를 놓치지 않는다. `handle()` 이 그 지점까지 도달하기 위한 선행 가드(triggerId·listenerRegistry·trigger lookup·chatChannelCfg·conversationKey)를 모두 통과하도록 mock 이 정확히 구성돼 있음을 프로덕션 코드(`chat-channel.dispatcher.ts:93-209`)와 대조해 확인했다. 두 테스트 모두 `debugSpy`/`warnSpy` 를 `finally` 에서 확실히 `mockRestore()` 해 전역 `Logger.prototype` 오염을 방지한다 — 이 파일에서 가장 견고한 격리 패턴이다.

- 프로덕션 diff 전 범위(파일 3 `Array.isArray` 가드, 파일 5 `export` 전환)가 새로 추가된 테스트로 빠짐없이 커버된다. 회귀 위험이 있는 기존 테스트(예: `W-27` 캐시 적재 테스트, `admitExecutionOrDefer` 기존 4건)는 diff 로 인해 깨지지 않으며, 새 테스트가 기존 테스트 위에 상한/방향만 얹는 방식으로 설계돼 중복이 없다.

## 요약

이번 diff 는 이전 라운드에서 유예됐던 두 개의 실측 테스트 공백(`snapshotCache` LRU 상한/방향 미검증, dispatcher 의 debug/warn 로그 레벨 분기 편방향 미검증)과 새 프로덕션 방어 코드(admission 의 `Array.isArray` fail-closed 가드) 각각에 대해 정확히 표적화된 회귀 테스트를 추가한다. 직접 로직을 추적해 검증한 결과 세 테스트 세트 모두 프로덕션 코드의 실제 조건·로그 문구·캐시 키 규약과 정확히 일치하고, LRU 방향성처럼 "그냥 하나 지운다"만 고정하면 놓치는 회귀 형태까지 방향성 있게 잡아낸다. 격리(인스턴스 재생성, 전역 `Logger.prototype` spy 의 `finally` 복원)도 견고하다. 유일한 지적은 `execution-engine.service.spec.ts` 의 신규 fail-closed 테스트가 delayed 재큐잉 단언을 생략하고 `spy.mockRestore()` 를 `try` 안에 둔 점인데, 둘 다 기존 파일 관례와 일치하고 실질 위험이 낮아 INFO 수준이다. Mock 사용도 실제 시그니처(constructor 인자 수, `EntityManager.query` 반환 타입 `Promise<any>`)와 괴리 없이 적절하다.

## 위험도

NONE
