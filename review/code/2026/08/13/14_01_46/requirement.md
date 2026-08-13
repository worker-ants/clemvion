# 요구사항(Requirement) Review

## 대상

`plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "선재 테스트 공백 2건" 유예 항목을
메우는 `backlog-final-three` 작업:

1. `chat-channel.dispatcher.ts` `handle()` 의 `toChatChannelEvent` null 분기 —
   `isSubFilterNull` 삼항이 debug/warn 로그 레벨을 가르는 동작을 `handle()` 경유 양방향 테스트로 고정.
2. `executions.service.ts` `snapshotCache` (256건 LRU) 의 상한·evict 방향을 경계값 테스트로 고정,
   테스트에서 참조할 수 있도록 `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `export`.
3. `execution-engine.service.ts` admission 자리에 `Array.isArray(rows)` 런타임 가드 추가
   (fail-closed 명시화) + 해당 가드의 테스트.
4. `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크박스 2건을 완료로 갱신.

## 검증 방법

각 신규 테스트가 실제 소스(`chat-channel.dispatcher.ts`, `executions.service.ts`,
`execution-engine.service.ts`)의 현재 로직과 line-level 로 일치하는지 `Read`/`Grep` 으로
직접 대조했다 (diff 만으로는 신뢰할 수 없어 전체 함수 본문을 열람).

## 발견사항

- **[INFO]** `snapshotCache` 상한(256)·`ChatChannelDispatcher` 의 debug/warn 로그 레벨 분기는
  `spec/` 에 별도 요구사항 문서가 없다 — 순수 내부 성능/운영 세부사항(인스턴스 캐시 크기, 로그
  노이즈 감소)이라 spec 문서화 대상은 아니라고 판단된다. 관련 원자성·정규화 로직 자체는
  `spec/5-system/4-execution-engine.md` §1.1 "원자성 보장" / §"Pre-park read-window 정규화"에
  문서화돼 있고, `executions.service.ts` 의 `reconcilePreParkWaitingStatus` 주석이 그 SoT 를
  정확히 인용한다 — 이 부분은 기존 코드(diff 밖)이며 이번 변경으로 훼손되지 않았다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`SNAPSHOT_CACHE_MAX_ENTRIES` 선언부, `reconcilePreParkWaitingStatus` 함수)
  - 상세: 발견이라기보다 spec 커버리지 확인 결과 — 조치 불요.

## 라인-레벨 정합성 확인 결과 (모두 일치, 결함 없음)

1. **`chat-channel.dispatcher.spec.ts` 신규 테스트 2건** — `chat-channel.dispatcher.ts:192`
   (`const isSubFilterNull = event.eventType === 'execution.node.completed';`) 및 `:197-201`
   (`logFn = isSubFilterNull ? debug : warn`) 과 정확히 일치.
   - Test 1 (`execution.node.completed` + `nodeType: 'http_request'`): `toChatChannelEvent` 의
     `case 'execution.node.completed'` 분기(`chat-channel.dispatcher.ts:601`,
     `PRESENTATION_NODE_TYPES.has(nodeType)` 가 `false` → `null`)를 실제로 거쳐 `isSubFilterNull=true`
     경로에 도달함을 확인 — 테스트가 표방하는 "비-presentation 노드 → 정상 null → debug" 시나리오가
     실제로 그 경로를 태운다(우연한 통과가 아님).
   - Test 2 (`execution.ai_message` + `message: { not: 'string' }`): `case 'execution.ai_message'`
     (`chat-channel.dispatcher.ts:502-503`, `typeof message !== 'string' → null`)을 거쳐
     `isSubFilterNull=false` 경로(warn)에 도달함을 확인.
   - `buildDispatcherForNull()` 의 생성자 인자 5개(`websocketService`/`registry`/`listenerRegistry`/
     `conversationService`/`triggerRepository`) 순서·형태가 `ChatChannelDispatcher` 실제 생성자
     (`chat-channel.dispatcher.ts:59-66`)와 일치. `handle()` 진입 전 가드
     (`SUBSCRIBED_EVENTS.has` → `triggerId` 존재 → `listenerRegistry.has` → `triggerRepository.findOne`
     → `chatChannelCfg` → `conversationKey`)를 모두 테스트 fixture 가 충족해 null 분기까지 정상
     도달함을 확인 — 조기 return 으로 인한 vacuous pass 아님.
   - `finally` 블록에서 `debugSpy`/`warnSpy` 를 항상 `mockRestore()` — 스파이 누출 없음.

2. **`execution-engine.service.spec.ts` 신규 테스트 1건** — `execution-engine.service.ts:2926-2932`
   의 `if (!Array.isArray(rows)) { warn; return false; }` 가드와 일치. `admit()` 헬퍼는 기존
   `admitExecutionOrDefer` private 메서드 캐스팅 패턴을 그대로 재사용(라인 4360-4368 기존 코드,
   diff 밖). mock 이 `query` 를 항상 `undefined` 로 응답하도록 해 `rows=undefined`(non-array) 를
   만들고, `admit(exec)` 가 `'deferred'` 로 해소되며 `executionRunQueue.add` 를 통한 재큐 경로
   (`execution-engine.service.ts:2949-2961`)로 자연히 떨어짐을 확인 — 예외로 새지 않고 명시적
   fail-closed 로 떨어진다는 주석의 주장과 실제 동작이 일치.
   - warn 메시지 단언 `expect.stringContaining('배열이 아님')` 이 소스 문구
     (``UPDATE ... RETURNING 이 배열이 아님 (typeof=...)``)와 정확히 일치.
   - `mockExecutionRepo` 는 outer `beforeEach`(라인 256)에서 매 테스트 새로 구성되므로, 이 테스트가
     `manager.transaction` 을 직접 재할당해도 다른 테스트로 누수되지 않음(격리 확인).

3. **`executions.service.spec.ts` 신규 테스트 2건** — `SNAPSHOT_CACHE_MAX_ENTRIES` export
   (`executions.service.ts:63`)와 `writeSnapshotCache`/`readSnapshotCache`
   (`executions.service.ts:166-202`)의 LRU 구현을 직접 추적해 테스트의 기대값과 대조:
   - 256건 채움 → 상한 도달 시점까지 evict 없음(매 삽입 전 `size >= MAX` 검사이므로 256번째
     삽입 시점엔 `size===255` 라 evict 미발생, 정확히 256에서 멈춤) — 테스트의
     `expect(afterFill).toBe(SNAPSHOT_CACHE_MAX_ENTRIES)` 와 일치.
   - `e-0`, `e-255` 를 먼저 읽어 LRU 를 갱신(`readSnapshotCache` 의 `delete`+`set` 재삽입,
     라인 169-174)한 뒤 `e-256` 삽입 → 가장 오래된 `e-1` 이 evict 됨을 직접 순서를 손으로 추적해
     확인. 이후 `e-1` 조회는 miss(재조회 +1), `e-0` 조회는 hit(재조회 없음) — 테스트 주석이
     주장하는 LRU 방향과 실제 Map 반복 순서 기반 구현이 정확히 일치.
   - `SNAPSHOT_CACHE_MAX_ENTRIES` 를 다른 모듈에서 재-export 하거나 이름이 충돌하는 곳 없음(grep 확인).

4. **`plan/in-progress/backend-lint-gate-broken-on-main.md` 체크박스 갱신** — 두 항목 모두 실제
   코드 변경(테스트 신설 + 가드 신설)과 정합. "뮤턴트 4/4 killed" 등 서술은 본 리뷰의 정적 대조
   범위 밖(뮤테이션 실행 자체는 재현하지 않음)이나, 서술된 테스트 자체가 존재하고 소스 로직과
   일치함은 확인했다.

## 요약

이번 diff 는 두 곳의 "선재 테스트 공백"(dispatcher 로그 레벨 삼항 미검증, snapshotCache 상한/LRU
방향 미검증)을 메우는 테스트 신설과, `execution-engine.service.ts` admission 자리에 이미 안전했던
암묵적 fail-closed 를 명시적 `Array.isArray` 가드 + 로그로 승격한 소품 방어 코드 추가로 구성된다.
모든 신규 테스트를 실제 대상 함수의 현재 로직과 line-level 로 직접 대조한 결과, 어서션이 검증하려는
분기(로그 레벨 삼항, LRU evict 방향, non-array 방어)가 실제로 그 경로를 태우며, 방향성 있는 단언
(양방향 로그 레벨, evict 되는 키가 "가장 오래된" 것인지)까지 갖춰 vacuous pass 위험이 낮다. 프로덕션
코드 변경(`export` 키워드 추가, `Array.isArray` 가드)은 기존 동작을 보존하면서 안전성을 명시화하는
성격으로, 기존 정상 경로(배열 반환 시 `rows.length === 1`)에 영향이 없다. TODO/FIXME/HACK 류
미완성 표식 없음, spec 문서와 상충하는 부분 없음(관련 원자성 규약은 그대로 준수). CRITICAL/WARNING
급 결함을 발견하지 못했다.

## 위험도

NONE
