# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 신규 `buildDispatcherForNull()` 가 같은 파일의 기존 `buildDispatcher()` 와 ~80% 동일한 setup(어댑터 `{provider:'slack', supportsNativeForm:true, sendMessage:...}`, `listenerRegistry:{has:...}`, `triggerRepository.findOne` 고정 literal `{id:'trig-1', workspaceId:'ws', workflowId:'wf-1', config:{chatChannel:{provider:'slack'}}, chatChannelHealth:'healthy'}`, `ChatChannelDispatcher` 생성자 호출)를 중복 구현한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:715` (신규 `buildDispatcherForNull`) vs `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:822` (기존 `buildDispatcher`)
  - 상세: 두 함수는 `conversationService`/`renderNode` 반환값만 다르고 나머지 mock 구조(특히 `triggerRepository.findOne` 의 고정 fixture)가 문자 그대로 동일하다. 향후 `ChatChannelDispatcher` 생성자 시그니처나 trigger fixture shape 이 바뀌면 두 곳을 함께 고쳐야 하며, 실제로 이미 한쪽만 고치고 다른 쪽을 놓치는 패턴이 이 프로젝트 메모리에 반복 기록돼 있다(`feedback_defense_defined_one_notch_narrow`).
  - 제안: 기존 `buildDispatcher()` 를 옵션 인자(`{ renderResult?, conversationService? }` 등)로 확장해 재사용하거나, 공통 fixture(`triggerRepository`/`listenerRegistry`/기본 adapter shape)를 모듈 상단 헬퍼로 추출해 두 describe 블록이 함께 참조하게 한다.

- **[INFO]** `dispatcher as unknown as { handle: (e: ExecutionChannelEvent) => Promise<void> }` 인라인 타입 캐스트 리터럴이 파일 내 4곳(기존 2곳 + 이번 diff 로 2곳 추가)에 문자 그대로 반복된다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:774`, `:802` (신규) / `:898`, `:916` (기존)
  - 상세: private `handle()` 접근을 위한 캐스트 타입이 매번 새로 타이핑돼 있어, 시그니처가 바뀌면 4곳을 동시에 고쳐야 한다. 이번 diff 가 그 표면을 2곳 더 늘렸다.
  - 제안: 파일 상단에 `type DispatcherWithHandle = { handle: (e: ExecutionChannelEvent) => Promise<void> }` 같은 로컬 타입 별칭을 두고 4곳 모두 재사용.

- **[INFO]** 신규 admission 가드 테스트에서 `try/finally` 가 `warnSpy.mockRestore()` 만 보장하고, 같은 스코프의 `emitSpy()` 반환 `spy` 는 `finally` 밖에서 마지막 줄에만 `mockRestore()` 된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4491-4520` (`it('UPDATE ... RETURNING 이 배열이 아니면 예외가 아니라 defer (fail-closed)', ...)`)
  - 상세: 두 `expect(...)` 단언 중 하나가 실패하면 `spy.mockRestore()` 가 스킵된다. 같은 파일의 outer `beforeEach`(약 line 256)가 매 테스트마다 testing module 을 재생성하므로 실제 오염 위험은 낮지만, 같은 `it` 안에서 한쪽 spy(`warnSpy`)만 `finally` 로 보호하고 다른 쪽(`spy`)은 보호하지 않는 것은 내적으로 일관성이 없다.
  - 제안: 두 spy 모두 같은 `finally` 블록에서 복원하거나, 이 describe 블록의 다른 테스트들처럼 try/finally 없이 통일한다.

## 요약

이번 변경은 대부분 3개 spec 파일에 대한 테스트 보강(`snapshotCache` LRU 경계값 고정, `toChatChannelEvent` null 의 debug/warn 로그 레벨 분기 양방향 고정, admission 가드 fail-closed 회귀 테스트)과, 그에 대응하는 작지만 명확한 production 코드 변경 2건(`execution-engine.service.ts` 의 `Array.isArray(rows)` guard clause, `executions.service.ts` 의 `SNAPSHOT_CACHE_MAX_ENTRIES` export)으로 구성된다. 신규 코드는 네이밍·상수 사용·주석 밀도 모두 기존 코드베이스 관례와 일관되고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮다. 유일하게 눈에 띄는 구조적 문제는 `chat-channel.dispatcher.spec.ts` 에서 새 테스트 fixture 빌더가 기존 빌더와 상당 부분 중복된다는 점이며, 그 외에는 사소한 캐스트 반복·spy 복원 비일관성 정도의 INFO 성 관찰뿐이다.

## 위험도

LOW
