# Side Effect Review — M-4 park-entry-dispatch 추출

## 발견사항

### [INFO] `_parkEntryRegistry` 인스턴스 필드 신규 도입 (lazy 캐시)
- **위치**: `execution-engine.service.ts` — `private _parkEntryRegistry?: readonly ParkEntryDispatch[];`
- **상세**: `_resumeTurnRegistry` 선례와 동일 패턴. `parkEntryRegistry` getter 가 첫 접근 시 `??=` 로 단 1회 초기화하고 이후 재사용. 클로저가 `this` 를 캡처(this-bound `waitForX`)하기 때문에 인스턴스 생존 기간과 수명이 일치해 상태 누수 없음. NestJS Singleton scope 에서 인스턴스가 재생성되지 않으므로 안전.
- **제안**: 현행 유지 적절.

### [INFO] `dispatchParkEntry` 반환 타입 — `Promise<ProcessTurnResult>` vs 실제 반환
- **위치**: `execution-engine.service.ts` 라인 1748, 1758 `return handler ? handler.handle(ctx) : undefined;`
- **상세**: `ProcessTurnResult = void | ParkSignal`. 핸들러 없을 때 `undefined` 를 반환하는데, TypeScript 에서 `void` 는 `undefined` 를 허용하므로 타입 계약상 문제없다. 세 호출 사이트 모두 `=== PARK_RELEASED` 비교만 하고 `undefined` / `void` 분기를 별도로 처리하지 않으므로 기존 else-fallthrough 동작과 동일.
- **제안**: 현행 유지 적절. 필요하다면 `return undefined as ProcessTurnResult;` 로 명시적 캐스팅을 추가할 수 있으나 기능 영향 없음.

### [INFO] `_parkEntryRegistry` 는 실행 간 공유됨
- **위치**: `parkEntryRegistry` getter
- **상세**: registry 는 `waitForX` 함수 레퍼런스만 담고 실행별 상태(executionId, context 등)는 `ParkEntryContext` 를 통해 호출 시 전달되므로 여러 실행이 동시에 registry 를 사용해도 상태 공유 문제가 없음. `buttons` 핸들러가 `ctx.graphEdges` 를 context 에서 읽는 구조도 마찬가지로 안전.
- **제안**: 현행 유지 적절.

### [INFO] 세 호출 사이트의 `ai_form_render` 처리 동작 변경 여부 확인
- **위치**: `runExecution` 메인 루프 (라인 ~3028 구간)
- **상세**: 기존 메인 루프 코드는 `ai_form_render` 에 대해 명시적 분기(`interactionType === 'ai_form_render'`)를 갖고 있었으나, 추출 전 diff 를 보면 해당 사이트의 원래 코드는 `ai_conversation || ai_form_render` 분기였다. `buildParkEntryRegistry` 의 `ai_conversation` 항목이 두 값을 모두 매칭하므로 동작 보존 확인됨. `runNodeDispatchLoop`(드라이브) 사이트에서도 동일.
- **제안**: 현행 유지 적절.

### [INFO] 전역 변수·환경 변수·파일시스템·네트워크 부작용 없음
- **위치**: `park-entry-dispatch.ts` 전체
- **상세**: `buildParkEntryRegistry` 는 순수 factory 함수. 전역 변수 참조/수정 없음. 파일시스템·환경 변수·네트워크 호출 없음. 반환하는 배열은 매 호출마다 새로 생성되며 registry 항목은 외부 참조를 클로저로만 보유.
- **제안**: 해당 없음.

### [INFO] 공개 API / 시그니처 변경 없음
- **위치**: `execution-engine.service.ts` public 메서드 전체
- **상세**: 신규 추가된 `_parkEntryRegistry`, `parkEntryRegistry` getter, `dispatchParkEntry` 는 모두 `private`. 기존 public 메서드(`execute`, `executeSync`, `executeAsync`, `executeInline`, `continueExecution`, `applyContinuation` 등)의 시그니처·반환 타입은 변경 없음. 소비자 코드에 영향 없음.
- **제안**: 해당 없음.

### [INFO] 이벤트/콜백 변경 없음
- **위치**: `dispatchParkEntry` → `waitForX` 위임 경로
- **상세**: `waitForFormSubmission`, `waitForButtonInteraction`, `waitForAiConversation` 로의 위임 인자가 기존과 동일하게 전달됨. 이벤트 emit 순서·횟수·payload 변경 없음. `PARK_RELEASED` escape 는 각 호출 사이트가 보유하므로 control-flow 반응도 사이트마다 기존과 동일.
- **제안**: 해당 없음.

---

## 요약

M-4 리팩터링은 behavior-preserving 추출이다. 신규 private 인스턴스 필드 `_parkEntryRegistry` 가 유일한 상태 변경으로, `_resumeTurnRegistry` 와 동일한 lazy 캐시 패턴을 따르며 실행별 context 는 호출 인자로 분리되어 있어 공유 상태 오염이 없다. 공개 API·이벤트·파일시스템·환경 변수·네트워크 경로 중 어떤 것도 변경되지 않았다. `dispatchParkEntry` 가 `undefined` 를 반환하는 no-match 경로는 추출 전 else-fallthrough 와 동일하며, TypeScript `void | ParkSignal` 계약 안에 있다. 부작용 관점에서 식별된 문제는 없다.

## 위험도

NONE
