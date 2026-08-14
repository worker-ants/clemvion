# Testing Review — EIA §6.4 종결 `error` 객체화 (재라운드, `22_55_51` 이후)

## 발견사항

- **[WARNING]** `failFirstSegmentSetup` 의 `EXECUTION_FAILED` emit — 4개 emit 지점 중 유일하게 `error` 값이 어떤 테스트에서도 검증되지 않는다 (뮤테이션으로 생존 실측)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:657-666` (특히 `:664` `error: toTerminalErrorPayload(row.error)`) / 대응 테스트 `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5132-5178` (`it('W2: setup 단계 throw 시 catch 가 execution 을 FAILED 로 best-effort 마킹', ...)`), 단언은 `:5169-5172` `expect(emitSpy).toHaveBeenCalledWith(executionId, ExecutionEventType.EXECUTION_FAILED, expect.objectContaining({ status: ExecutionStatus.FAILED }))`.
  - 상세: 이번 PR 의 핵심 동기는 "4개 `EXECUTION_FAILED` emit 지점이 DB 에 쓴 것과 같은 `error` 객체를 싣는지" 이고, 직전 라운드(`22_55_51` testing W8)에서 같은 클래스의 갭이 `finalizeStalledExhausted`/`finalizeFailedExecution` 두 곳에서 지적돼 이번 diff 로 고쳐졌다(`execution-engine.service.spec.ts:4772-4787`, `:7049-7058`에서 `error` 전체 객체를 명시 단언). 그런데 네 번째 지점인 `failFirstSegmentSetup`(`:657-666`)은 이번에도 빠졌다. 이 함수를 실제로(spy 로 대체하지 않고) 실행하는 테스트는 `execution-engine.service.spec.ts:5132`(W2) 하나뿐인데, 그 단언이 `objectContaining({ status: ... })` 뿐이라 `error` 필드는 어떤 값이 나가든 통과한다. 나머지 `failFirstSegmentSetup` 관련 테스트(M-4 `:3775`·`:3803`, W5 `:19054`, W7 `:19166`)는 전부 `jest.spyOn(svc, 'failFirstSegmentSetup')` 로 함수 자체를 mock 해 내부 emit 로직을 아예 실행하지 않는다.
  - **뮤테이션으로 검증**: `:664` 를 `error: toTerminalErrorPayload(row.error)` → `error: toTerminalErrorPayload('MUTATED')` 로 바꾼 뒤 `npx jest execution-engine.service.spec.ts -t "W2: setup 단계 throw"` 실행 — **GREEN 유지**(448 테스트 전부 통과, 대상 테스트도 통과). 원본으로 복원 후 재실행해 diff 0 및 전체 448 테스트 통과 재확인.
  - 제안: `:5169-5172` 의 단언을 `expect.objectContaining({ status: ExecutionStatus.FAILED, error: { code: null, message: expect.stringContaining('boom'), nodeId: null } })` 형태로 확장(형제 테스트들과 동일 패턴, `errMessage = error instanceof Error ? error.message : String(error)` 이 `row.error = { message: errMessage }` 로 저장되는 경로를 따라가면 됨).

- **[INFO]** 프런트엔드 `handleExecutionFailed` 의 신규 정규화 로직 중 "object 인데 `message` 가 없는 경우"·"`error` 자체가 `null`/누락" 경로가 명시 테스트로 고정되지 않았다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-271` (`payload.error?.message` / `errorMessage ?? "Execution failed before the tool completed"`). 대응 신규 테스트는 `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1140-1159` (object with `message` 케이스)와 기존 `:1123-1128`(string 케이스) 뿐이다.
  - 상세: `{ error: {} }`(message 없는 object) 나 `{ error: null }`/`{}`(error 자체 부재) 를 넣으면 `errorMessage` 가 `undefined` 가 되고 `??` 로 기본 문구로 떨어지는데, 이 분기를 직접 때리는 테스트는 없다. 로직이 단순하고(`typeof` 삼항 + `??`) 같은 파일의 `node.failed` 핸들러가 이미 쓰는 검증된 관용구를 그대로 재사용한 것이라 실사용 리스크는 낮지만, CRITICAL 로 지적됐던 "객체가 스토어로 새는" 회귀와 인접한 코드라 캐너리를 하나 더 두면 저렴하게 방어선을 넓힐 수 있다.
  - 제안: `it("execution.failed — error 객체에 message 가 없으면 기본 문구로 fallback", ...)` 케이스 하나만 추가해 `errorMessage ?? "..."` 분기를 직접 고정. 차단 사유는 아님.

## 관점별 평가

1. **테스트 존재 여부**: 신규 헬퍼 `toTerminalErrorPayload` 는 자체 spec(14+ 케이스, `it.each` 포함)으로 충분히 커버됨. `dispatcher`/`retry-turn`/프런트엔드 `use-execution-events` 의 back-compat·객체화 변경도 대응 테스트가 갱신·신설됨. 직전 라운드 CRITICAL(프런트 소비자 미검증)과 W8(2/4 emit 지점 값 미검증)·W9(bigint 분기)는 이번 diff 로 실제로 닫혔다(재확인 완료) — 다만 W8 과 같은 클래스의 세 번째 지점(`failFirstSegmentSetup`)이 새로 드러났다(위 WARNING).
2. **커버리지 갭**: `failFirstSegmentSetup` emit 값(위 WARNING)이 유일하게 남은 실측 갭. 그 외 4개 `EXECUTION_FAILED` 지점(`finalizeStalledExhausted`·`finalizeFailedExecution`·`retry-turn.failRetryExecution`)은 전부 실제 실행 경로에서 `error` 객체 전체를 단언한다(`execution-engine.service.spec.ts:4775-4787`·`:7047-7059`, `retry-turn.service.spec.ts:716-725`).
3. **엣지 케이스**: `terminal-error-payload.spec.ts` 는 null/undefined/string/number/boolean/**bigint**/symbol, 필드별 타입가드(`code`/`nodeId`/`message` 비문자열), `details` optional, 입력 불변성까지 폭넓게 커버 — 뮤테이션 검증 흔적(주석)도 신뢰할 만하다. `bigint` 케이스는 실제로 실행해 통과 확인.
4. **Mock 적절성**: `execution-engine.service.spec.ts`/`retry-turn.service.spec.ts` 의 `eventEmitter.emitExecution` spy 사용은 실제 서비스 로직을 그대로 태우고 emit 인자만 가로채는 적절한 패턴. 다만 `failFirstSegmentSetup` 을 다루는 대다수 테스트는 그 함수 자체를 `jest.spyOn().mockResolvedValue()` 로 완전히 대체해 — 상위 호출 계약(“호출됐는가”)은 검증하지만 내부 emit 로직은 어떤 테스트에서도 실행 대상이 아니게 만든다. 유일하게 실제 실행되는 W2 테스트가 값 단언을 안 해 그 틈이 그대로 남았다(위 WARNING).
5. **테스트 격리**: 각 `it`/`it.each` 케이스가 독립 fixture 를 구성하고, `terminal-error-payload.spec.ts` 는 순수 함수 테스트라 격리 문제 없음. `execution-engine.service.spec.ts` 는 `mockExecutionRepo` 를 케이스별로 `mockResolvedValueOnce` 로 스코프해 순서 의존이 통제돼 있다.
6. **가독성**: 각 테스트에 "왜"를 설명하는 한국어 주석(특히 뮤테이션 생존 이력을 명시한 `terminal-error-payload.spec.ts` 주석)이 의도를 명확히 드러낸다. `it.each` 타이틀(`%p`/`%s`)과 배열 순서가 일치해 실패 시 케이스 식별이 쉽다.
7. **회귀 테스트**: `chat-channel.dispatcher.spec.ts` 의 back-compat 테스트가 새 계약(`code: null`)에 맞게 전부 갱신됐고 실제 실행 확인(96 tests passed). 프런트 `use-execution-events.test.ts` 의 신규 캐너리(객체가 스토어에 안 들어감)는 CRITICAL fix 의 회귀 방지선으로 유효(84 tests passed, 실행 확인). `finalNodeId`/`finalPort` 제거도 참조하는 죽은 코드/테스트 없음.
8. **테스트 용이성**: `toTerminalErrorPayload(err: unknown)` 는 DI 없는 순수 함수라 격리 테스트가 쉽고 실제로 그 이점을 최대로 활용했다. 반면 `failFirstSegmentSetup` 은 private 메서드 + 내부에서 repo/eventEmitter 를 직접 참조하는 구조라, 이 함수 하나만을 격리해 emit 인자를 검증하는 테스트를 만들기가 상대적으로 번거롭다(그래서 대부분 테스트가 이 함수를 통째로 mock 하는 쪽을 택한 것으로 보인다) — 이 구조적 특성이 위 WARNING 갭이 생긴 근본 원인 중 하나.

## 요약

핵심 신규 헬퍼(`toTerminalErrorPayload`)와 그 대표 소비처(`chat-channel` back-compat wrap, `retry-turn.service`, `finalizeStalledExhausted`, `finalizeFailedExecution`, 프런트엔드 `use-execution-events`)는 이번 라운드에서 값 단언까지 촘촘히 보강됐고 전부 실행 확인(백엔드 3개 타깃 spec 96 passed, 대상 서비스 spec 448 passed, 프런트 84 passed)했다. 직전 라운드 CRITICAL(프런트 객체 렌더 회귀)·W8(2개 emit 값 미검증)·W9(bigint 무증상)는 실측으로 닫힌 것을 재확인했다. 다만 같은 클래스의 갭이 세 번째 emit 지점 `failFirstSegmentSetup` 에 남아 있다 — 이 PR 이 스스로 세운 "DB 에 쓴 것과 같은 문구가 나가는지 확인한다"는 원칙이 4곳 중 1곳에서는 아직 검증되지 않았고, 뮤테이션으로 실측 확인했다(값을 깨도 GREEN). 프런트엔드의 사소한 fallback 분기 하나는 INFO 로 남긴다.

## 위험도

LOW
