# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 프로덕션 코드

- **[WARNING]** `waitForFormSubmission` / `waitForButtonInteraction` 의 반환 타입이 `Promise<void | ParkSignal>` 로 선언됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `waitForFormSubmission` 시그니처(diff 라인 `-  ): Promise<void>` → `+  ): Promise<void | ParkSignal>`) 및 `waitForButtonInteraction` 동일
  - 상세: `void | T` 유니온은 TypeScript 에서 nullable 반환임을 명시하지 않고 호출 측이 `=== PARK_RELEASED` 비교로 구분해야 한다. 두 메서드가 ParkMode에 따라 완전히 다른 책임(대기 vs 즉시 반환)을 하나의 함수에 혼재시키고 있어 단일 책임 원칙이 희석된다. `parkMode` 파라미터가 추가된 것 자체가 향후 호출 경로 파악을 어렵게 만드는 신호다.
  - 제안: 현재 `parkMode='release'` 경로는 다음 PR (B2) 에서 `pendingContinuations` 전체를 제거할 때 재설계될 것이므로 PR-B2 에서 두 함수를 분리하거나 `parkMode` 를 제거하는 계획을 plan 에 명시한다. PR-B1 범위 내에서는 인라인 주석으로 "B2 에서 함수 분리 예정" 을 각 함수 JSDoc 에 한 줄 추가하는 것으로 충분하다.

- **[WARNING]** `cancelParkedExecution` 내부 이중 try-catch 중첩 — 중첩 깊이·복잡도
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L1060–L1101
  - 상세: 외부 `try` 안에 `emitExecution` 호출을 위한 내부 `try-catch` 가 다시 중첩된다. "emit 실패는 warn + 계속, DB 실패는 error + 삼키기" 라는 서로 다른 두 정책이 한 함수 안에서 구조적으로 구분하기 어렵게 뒤섞여 있다. 나중에 이 함수를 읽을 때 어느 catch 가 어떤 오류를 처리하는지 즉시 파악하기 어렵다.
  - 제안: emit 전용 로직을 `emitCancellationEvent(executionId)` 같은 private 헬퍼로 분리하면 중첩이 제거되고 단일 catch 로 단순화된다. 또는 외부 catch 에서도 re-throw 없이 삼킨다는 사실을 최상단 JSDoc 에 명시해 의도를 드러낸다.

- **[INFO]** `PARK_RELEASED` Symbol 과 `ParkSignal` 타입이 파일 최상단 모듈 스코프 상수로 선언됨
  - 위치: `execution-engine.service.ts` L684–688 (`const PARK_RELEASED = Symbol('park_released')` / `type ParkSignal`)
  - 상세: Symbol 이름 `'park_released'` 는 소문자 스네이크케이스이나 TypeScript 관용적으로 Symbol 이름은 단순 설명 문자열이라 규약 이슈는 없다. 다만 `ParkSignal` 타입(`typeof PARK_RELEASED`)이 private 구현 세부사항임에도 모듈 수준에서 export 없이 선언되어 있어 향후 파일 분리 시 처리가 필요함을 인식해 둬야 한다. PR-B2 에서 `waitForX` 함수 전체를 재구성할 때 이 두 선언의 위치를 재검토하면 충분하다.
  - 제안: 현 상태 유지. PR-B2 리팩토링 시 정리 대상으로 plan 체크박스에 등록 권장.

- **[INFO]** `runNodeDispatchLoop` 반환 타입이 `Promise<void>` → `Promise<{ parked: boolean }>` 로 변경됨
  - 위치: `execution-engine.service.ts` L1501–1503
  - 상세: 반환값 `{ parked: boolean }` 은 단순하고 명확하나, 이 객체가 미래에 필드가 추가될 경우(예: `waitingNodeId` 등) 타입을 확장하기 쉽다. 현재는 필드 1개라 인라인 리터럴 타입으로 충분하나, PR-B2 이후 park 정보가 풍부해지면 별도 `interface NodeDispatchResult`로 추출하는 것이 가독성을 높인다.
  - 제안: 현 상태 유지. 향후 확장 시 인터페이스 추출 고려.

---

### 테스트 코드

- **[WARNING]** `armSlowPathResume` 헬퍼 함수 내부의 복잡한 타입 캐스팅 체인 — 가독성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `armSlowPathResume` 함수 내 `saveCalls.find(...)` 부분
  - 상세: `(c[0] as { status?: string; nodeId?: string })?.status` 처럼 인라인 타입 단언이 한 표현식 안에 2회 이상 겹친다. 이 패턴이 `waitingSave?.[0]` 접근에서도 반복되어 mock 데이터 추출 의도를 파악하는 데 인지 부하가 크다. 테스트 헬퍼임에도 이 함수는 ~50줄이며 DB mock 의 4개 레이어를 한꺼번에 무장하는 복합 책임을 갖는다.
  - 제안: `armSlowPathResume` 내부에서 mock 레이어별로 로컬 변수를 추출하고(`const executionMock = ...`, `const nodeExecFindMock = ...` 등) 타입 단언을 최소화한다. 단순히 가독성이 목적이므로 기능 변경 없이 변수 추출만으로 충분하다.

- **[WARNING]** `for (let i = 0; i < 50; i++) { ... await flushResumeDrive(20); }` 폴링 루프 — 매직 넘버·가독성
  - 위치: `execution-engine.service.spec.ts` — button park resume 테스트 내 완료 대기 루프(diff `+        for (let i = 0; i < 50; i++) {`)
  - 상세: `50`(최대 반복) × `20`ms = 최대 1000ms 대기라는 계산이 코드에서 즉시 보이지 않는다. `flushResumeDrive(ms = 40)` 의 40ms 와 이 루프의 20ms 는 서로 다른 목적(일반 flush vs 완료 대기)인데 같은 유틸을 재사용하면서 인자만 바꿔 혼란을 줄 수 있다.
  - 제안: 상수를 추출하거나 루프 직전에 `// 최대 50 * 20ms = 1000ms 대기` 주석을 추가한다. 또는 이 패턴을 `waitUntilEmitted(spy, eventName, { maxMs })` 같은 헬퍼로 추출하면 중복 제거와 가독성이 모두 개선된다. 비슷한 패턴이 다른 테스트에도 생길 경우 중복 코드 이슈가 된다.

- **[INFO]** `flushResumeDrive` vs `flushPromises` 두 헬퍼의 의미 차이가 이름만으로 불명확
  - 위치: `execution-engine.service.spec.ts` L227–229 (`flushResumeDrive`)
  - 상세: `flushPromises` 는 마이크로태스크 플러시(setImmediate 기반), `flushResumeDrive` 는 실제 타이머(setTimeout 기반)로 근본적으로 다른 메커니즘이다. JSDoc 에서 40ms 이유를 잘 설명하나, 함수 이름의 `Resume` 이 "resume 드라이브" 의 줄임임을 모르는 독자에게는 모호하다.
  - 제안: 함수 이름을 `flushSlowPathDrive` 또는 `advanceRehydrationTimer` 처럼 메커니즘을 드러내는 이름으로 변경하는 것을 고려한다. 현재 JSDoc 이 충분히 설명하므로 변경 필수는 아니다.

- **[INFO]** `cancelParkedExecution` 을 검증하는 테스트에서 `createQueryBuilder` mock 이 7단계 체이닝으로 구성됨 — 중첩 깊이
  - 위치: `execution-engine.service.spec.ts` diff 내 `mockExecutionRepo.createQueryBuilder = jest.fn().mockReturnValue({ update: ... })` 부분
  - 상세: TypeORM QueryBuilder 체이닝(`.update().set().where().andWhere().execute()`)을 mock 하려면 7단계 중첩 객체 리터럴이 불가피하다. 이는 TypeORM API 구조상 어쩔 수 없으나, 이 패턴이 다른 테스트에서도 반복될 경우 `buildQueryBuilderMock({ affected: 1 })` 같은 팩토리 헬퍼로 추출하면 중복이 줄어든다.
  - 제안: 현재는 1회 사용이므로 현상 유지. 재사용 시 헬퍼로 추출 권장.

---

### 프로세서 / 마이너 변경

- **[INFO]** 테스트 설명 문자열에 구현 세부사항·PR 식별자가 포함됨
  - 위치: `continuation-execution.processor.spec.ts` — `it('calls applyCancellation with executionId (await — Phase B PR-B1: async)', ...)`
  - 상세: `(await — Phase B PR-B1: async)` 는 PR 식별자와 구현 메모를 테스트 명세 이름에 혼합한 것이다. PR 이 merge 되면 이 이름은 영구히 코드베이스에 남으나 더 이상 정보가 되지 않는다. `git log` 나 PR 링크가 이 정보의 올바른 위치다.
  - 제안: 테스트 명칭을 행위(behavior) 중심으로 단순화한다. 예: `'calls applyCancellation with executionId and awaits the result'`. PR-B2 에서 관련 코드 정리 시 함께 수정하는 것이 자연스럽다.

---

## 요약

이번 변경은 형식(fire-and-forget → await)과 모델(in-process 코루틴 유지 → park 즉시 해제)이 동시에 바뀌는 아키텍처 이행이다. 프로덕션 코드의 핵심 변경(`applyCancellation` async화, `cancelParkedExecution` 분리, `PARK_RELEASED` sentinel, `runNodeDispatchLoop` 반환 타입 변경)은 목적이 명확하고 네이밍 일관성도 양호하다. 다만 `waitForFormSubmission`/`waitForButtonInteraction` 이 `parkMode` 파라미터로 인해 두 가지 책임을 담게 된 것은 PR-B2 에서 정리될 기술 부채임을 인식해야 한다. 테스트 코드에서는 `armSlowPathResume` 헬퍼의 복잡한 타입 캐스팅과 폴링 루프의 매직 넘버가 가독성을 낮추며, 이는 phase 이행이 완료된 후 리팩토링 대상이다. 전반적으로 이 규모의 아키텍처 변경치고 코드 품질이 잘 관리되고 있으며, 지적된 사항들은 대부분 PR-B2 정리 단계에서 자연스럽게 해소 가능한 수준이다.

## 위험도

LOW
