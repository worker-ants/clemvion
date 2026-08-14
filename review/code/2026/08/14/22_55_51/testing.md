# Testing Review — EIA §6.4 종결 error 객체화 (chat-channel / execution-engine / retry-turn)

## 발견사항

- **[WARNING]** `finalizeStalledExhausted` / `finalizeFailedExecution` 의 `EXECUTION_FAILED` emit 호출에서 `error` 필드 실제 값을 검증하는 테스트가 없다 — 뮤테이션으로 실측 확인(회귀 시 무증상)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3312` (`toTerminalErrorPayload(stalledError)`), `:4870` (`toTerminalErrorPayload(savedExecution.error)`)
  - 대응 테스트: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `finalizeStalledExhausted` 케이스(`'RUNNING 이면 failed + WORKER_HEARTBEAT_TIMEOUT 마킹 + 자식 cascade + EXECUTION_FAILED emit'`)는 `expect(emitSpy).toHaveBeenCalled()` 만 하고 인자를 전혀 검사하지 않는다. `finalizeFailedExecution` 케이스(`'재개(rehydrated) 종결이 status·save·EXECUTION_FAILED emit·execution_failed dispatch 를 모두 수행'`)는 `expect(emitSpy).toHaveBeenCalledWith(..., expect.objectContaining({ status: ExecutionStatus.FAILED }))` 만 하고 `error` 필드를 assert 하지 않는다.
  - 상세: 이 PR 의 핵심 목적이 "DB 에 쓴 객체를 emit 이 그대로 싣게 해 문구 drift(예: `attempts` 누락)를 없앤다"인데, 정작 그 target 두 곳의 emit 인자를 아무도 확인하지 않는다. 직접 뮤테이션으로 검증: `toTerminalErrorPayload(stalledError)` → `toTerminalErrorPayload('mutated-broken')`, `toTerminalErrorPayload(savedExecution.error)` → `toTerminalErrorPayload('mutated-broken-2')` 로 각각 바꿔도 대상 테스트가 전부 GREEN 으로 남았다(원본 대비 diff 0 으로 원복 확인 완료). 나머지 두 emit 지점(`failFirstSegmentSetup` — `execution-engine.service.spec.ts:7038-7042`, `failRetryExecution` — `retry-turn.service.spec.ts:716-724`)은 이번 diff 에서 정확히 이 패턴(object shape 전체 assert)으로 갱신됐으므로, 두 곳만 빠진 비대칭이다.
  - 제안: 두 테스트에 `error: { code: 'WORKER_HEARTBEAT_TIMEOUT', message: expect.stringContaining('worker crash'), nodeId: null }` / `error: { code: null, message: 'boom', nodeId: null }` 형태의 명시적 assertion 을 추가한다(형제 테스트들과 동일 패턴).

- **[WARNING]** `toTerminalErrorPayload` 의 `typeof err === 'bigint'` 분기가 어떤 테스트로도 검증되지 않는다 — 뮤테이션 생존 실측
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts` — 함수 `toTerminalErrorPayload` 내 `typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint'` 조건 (union 분기)
  - 상세: `terminal-error-payload.spec.ts` 의 스칼라 `it.each`(`[42, '42']`, `[true, 'true']`)는 number·boolean 만 커버한다. 이 조건에서 `|| typeof err === 'bigint'` 를 제거해도 14개 테스트가 전부 GREEN(뮤테이션 실측, 원복 완료) — 회귀 시 `bigint` 입력이 조용히 다음 분기(`message: ''`)로 떨어져도 아무도 못 잡는다. 파일 상단 주석이 "뮤테이션으로 확인해 보니 fixture 가 없을 때 `code`/`nodeId` 가드를 지운 뮤턴트가 생존했다"고 명시할 만큼 뮤테이션 검증을 의식한 스위트인데, 같은 파일의 다른 union 분기(bigint)는 그 검증에서 빠졌다.
  - 제안: `it.each` 배열에 `[BigInt(9), '9']` 케이스를 추가한다.

- **[INFO]** `execution-failure-classifier.spec.ts` 가 `code: null` (신규 타입) 을 명시 케이스로 테스트하지 않는다
  - 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` — 헬퍼 `makeEvent(code: string, ...)` (line 8) 는 여전히 `code: string` 만 받는다
  - 상세: `EiaFailedEvent.error.code` 가 이번 PR 로 `string | null` 이 됐고, 분류기는 `event.error?.code ?? ''` 로 소비한다(`execution-failure-classifier.ts:105`). `??` 연산자는 `null`/`undefined`/키 부재를 동일하게 처리하므로 기존 `'empty code → executionFailedInternal'`(line 172) 케이스가 사실상 같은 경로를 이미 검증하지만, `code: null` 을 문자 그대로 넣는 케이스는 없다 — 타입 변경의 직접 소비처인데 새 타입 값으로 명시 검증되지 않은 갭이다. 이 파일은 이번 diff 대상은 아니지만 타입 변경의 다운스트림이다.
  - 제안: `it('code: null → executionFailedInternal (§6.4 명시적 null)', ...)` 케이스 하나 추가해 타입 계약과 분류기 동작을 직접 연결.

## 관점별 평가

1. **테스트 존재 여부**: 신규 헬퍼 `toTerminalErrorPayload` 는 자체 spec 파일(125줄, 14 케이스)로 충분히 커버됨. `dispatcher`/`retry-turn` 의 back-compat wrap 변경도 대응 테스트가 갱신됨. `execution-engine.service.ts` 의 4개 emit 호출부 중 2곳만 인자 assert 누락(위 WARNING).
2. **커버리지 갭**: `bigint` 분기(위 WARNING), `finalizeStalledExhausted`/`finalizeFailedExecution` emit 인자(위 WARNING). 그 외 `function` 타입 입력(주석상 symbol 과 동일 취급되나 별도 테스트 없음, 실무 영향 낮음 — jsonb 컬럼엔 존재 불가) 은 INFO 수준으로도 안 올릴 만큼 사소함.
3. **엣지 케이스**: null/undefined/string/number/boolean/symbol, 타입가드(code/nodeId/message 각각 비문자열 입력), details optional, 불변성(입력 미변형) 까지 폭넓게 커버 — 뮤테이션 테스트로 실측 검증한 흔적(파일 주석)도 신뢰할 만함.
4. **Mock 적절성**: `execution-engine.service.spec.ts` 의 `eventEmitter.emitExecution` spy 사용은 적절하나, 위 두 케이스는 spy 를 걸어놓고 인자를 확인 안 해 mock 의 가치를 못 씀.
5. **테스트 격리**: 각 `it` 가 독립 fixture 를 구성하고 공유 mutable state 에 의존하지 않음. `terminal-error-payload.spec.ts` 는 순수 함수 테스트라 격리 이슈 없음.
6. **가독성**: 각 테스트에 "왜"를 설명하는 한국어 주석이 붙어 있어 의도가 명확함(예: `code: "INTERNAL_ERROR"` 대신 `null` 을 쓰는 이유). `it.each` 타이틀 포맷(`%s`/`%p`)도 실제 배열 순서와 일치해 케이스 식별이 쉬움.
7. **회귀 테스트**: 기존 back-compat 테스트(`chat-channel.dispatcher.spec.ts`)가 새 계약(`code: null`)에 맞게 갱신됐고, `finalNodeId`/`finalPort` 제거는 참조하는 다른 코드/테스트가 없어 stale 참조 없음(grep 확인). 다만 위 WARNING 두 건은 "회귀를 막아야 할 지점에 회귀 테스트가 없는" 케이스.
8. **테스트 용이성**: `toTerminalErrorPayload(err: unknown)` 는 순수 함수로 DI 없이 바로 단위 테스트 가능하게 설계됨 — 이 구조 덕분에 헬퍼 자체의 커버리지가 특히 좋다. `toChatChannelEvent` 도 순수 함수라 동일하게 테스트하기 쉬움.

## 요약

핵심 신규 헬퍼(`toTerminalErrorPayload`)와 그 대표 소비처(`chat-channel` back-compat wrap, `retry-turn.service`, `failFirstSegmentSetup`)는 뮤테이션 테스트까지 동원해 꼼꼼하게 검증됐고 가독성도 좋다. 다만 같은 헬퍼를 쓰는 4개 emit 지점 중 2곳(`finalizeStalledExhausted`, `finalizeFailedExecution`)은 emit 인자를 전혀 assert 하지 않아, 이 PR 이 고치려던 "DB/wire 표현 drift" 류의 회귀를 그 두 지점에서는 앞으로도 못 잡는다 — 직접 뮤테이션으로 생존을 실측 확인했다. `bigint` 분기도 동일한 방식으로 무증상 회귀 가능성이 실측됐다. 세 갭 모두 패턴이 이미 존재하는 형제 테스트를 복사하면 되는 낮은 비용의 수정이다.

## 위험도

MEDIUM
