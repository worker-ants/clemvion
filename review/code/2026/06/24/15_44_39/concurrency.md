# 동시성(Concurrency) 리뷰 결과

**대상 커밋**: `ecd70dd` — refactor(execution-engine): M-4 park-진입 dispatch 를 ParkEntryDispatch registry 로 추출

---

## 발견사항

### park-entry-dispatch.ts / execution-engine.service.ts

- **[INFO]** `_parkEntryRegistry` lazy 초기화 패턴 — 기존 `_resumeTurnRegistry`와 동일 구조, 단일 스레드(Node.js 이벤트 루프) 내 race-free
  - 위치: `execution-engine.service.ts` — `private _parkEntryRegistry?: readonly ParkEntryDispatch[]` 필드 및 `parkEntryRegistry` getter
  - 상세: `??=` 연산자로 lazy 캐시하는 패턴. Node.js 싱글 스레드 특성상 동시 초기화 경합이 없으며, `buildParkEntryRegistry` 자체가 순수 동기 factory 이므로 중복 호출 시에도 동일 결과를 반환하는 멱등 구조다. 실질적 위험 없음.
  - 제안: 현행 유지 (기존 `_resumeTurnRegistry` 선례와 일관, 위험 없음).

- **[INFO]** `dispatchParkEntry` 내 `getMetadata` + `getInteractionType` 두 호출 — await 없는 동기 흐름으로 경합 없음
  - 위치: `execution-engine.service.ts` — `dispatchParkEntry` 메서드 (`meta = this.handlerRegistry.getMetadata(...)`, `interactionType: this.getInteractionType(...)`)
  - 상세: 두 호출 모두 동기 조회(registry lookup, nodeOutputCache 읽기). async/await 경계가 없으므로 중간 상태 노출 없음. `handler.handle(ctx)` 에서만 첫 await 발생 — 이 시점에서 ctx 는 이미 완전히 구성된 불변 객체다.
  - 제안: 현행 유지.

- **[INFO]** `dispatchParkEntry` 반환 타입 `Promise<ProcessTurnResult>` — `handler` 미발견 시 `undefined` 반환 타입 불일치 허용
  - 위치: `execution-engine.service.ts` — `return handler ? handler.handle(ctx) : undefined;`
  - 상세: `undefined` 가 직접 반환(Promise 래핑 없이). TypeScript `async` 함수이므로 실제로는 `Promise.resolve(undefined)` 로 wrapping 되어 런타임 동작은 정상. 동시성 문제는 아니나, `ProcessTurnResult`가 `undefined`를 포함하는 union 타입임이 확인되면 타입 안전 문제도 없다.
  - 제안: 현행 유지 (기존 else-fallthrough 동작 보존 의도 명시됨).

### review/consistency 파일 (md / json)

동시성 관련 코드 없음. 분석 대상 외.

---

## 요약

이번 변경의 동시성 관련 코드는 `execution-engine.service.ts` 의 `_parkEntryRegistry` lazy 초기화 필드와 `dispatchParkEntry` 메서드다. Node.js 단일 이벤트 루프 환경이며, `??=` lazy 패턴은 동기이므로 경합이 없다. `buildParkEntryRegistry` 는 순수 동기 factory 로 부작용 없으며, `dispatchParkEntry` 의 비동기 경계는 `handler.handle(ctx)` 1곳으로 명확히 격리돼 있다. 세 호출 사이트(runExecution·executeInline·runNodeDispatchLoop) 각각의 `PARK_RELEASED` 이후 control-flow(bare return / ParkReleaseSignal throw / {parked:true})가 호출측에서 보존돼 추출 전 동작과 동일하다. 동시성 관점에서 신규 위험이 도입된 부분은 없다.

---

## 위험도

NONE
