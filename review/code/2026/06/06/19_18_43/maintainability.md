# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** `DispatchSubject` 타입이 describe 블록 내부에 지역 선언됨
  - 위치: `describe('dispatchResumeTurn ...')` 내부 타입 정의 (~line 50~55)
  - 상세: `DispatchSubject` 로컬 타입은 해당 describe 내에서만 쓰이므로 스코프는 적절하다. 그러나 `CheckpointSubject` 처럼 describe 바깥 상위 스코프로 승격한 선례(W1 주석에 명시된 패턴)와 일관성이 없다 — 두 타입의 배치 기준이 달라 신규 기여자가 어느 위치에 두어야 할지 헷갈릴 수 있다.
  - 제안: 테스트 파일 내 상위 스코프 타입 선언 위치를 컨벤션으로 명시하거나, `DispatchSubject`도 동일 상위 스코프에 올려 일관성 확보.

- **[INFO]** `makeCtx` 헬퍼가 describe 내부에 선언되어 재사용 범위가 제한됨
  - 위치: ~line 57~69
  - 상세: 유사한 실행 컨텍스트 팩토리 패턴이 다른 describe 블록에도 반복적으로 존재할 가능성이 있으나, 현재 코드에서는 이 describe 내에서만 사용된다. 범위 내 사용이면 문제없다.
  - 제안: 다른 describe 블록에서도 동형 팩토리가 필요해지면 `armSlowPathResume` 같은 상위 스코프 헬퍼로 추출할 것.

- **[INFO]** 테스트 케이스마다 `svc`를 `service as unknown as DispatchSubject`로 반복 캐스팅
  - 위치: 각 it 블록 첫 줄 (~line 76, 97, 122, 143, 162, 185, 205)
  - 상세: 동일한 캐스팅 패턴이 7개 테스트 케이스에서 반복된다. 중복 코드 수준은 낮지만 신규 테스트 추가 시 빠뜨릴 위험이 있다.
  - 제안: describe 블록 상단에 `let svc: DispatchSubject`를 선언하고 `beforeEach`에서 한 번만 캐스팅해 할당. 각 it에서는 이미 선언된 `svc`를 사용.

---

### 파일 2: execution-engine.service.ts

- **[INFO]** `_resumeTurnRegistry` 지연 초기화 getter의 네이밍 불일치
  - 위치: private `_resumeTurnRegistry?: readonly ResumeTurnDispatch[]` + `private get resumeTurnRegistry()`
  - 상세: backing field에 `_` 접두사를 붙이는 규칙은 이 파일에서 `_resumeCheckpoint`, `_resumeState` 같은 *persisted checkpoint 프로퍼티*에 주로 쓰인다. 지연 초기화 캐시 backing field에 동일 접두사를 쓰면 "영속 체크포인트 관련 필드"로 오해될 수 있다.
  - 제안: 지연 캐시 패턴에는 `__resumeTurnRegistry` 또는 `resumeTurnRegistry_` 같은 다른 접두사를 쓰거나, private 설명 주석으로 역할을 구분.

- **[INFO]** `dispatchResumeTurn` 내 `selector` 빌드가 인라인으로 수행됨
  - 위치: `dispatchResumeTurn` 메서드 (~line 1061~1083 기준 diff)
  - 상세: `ResumeTurnSelector` 를 빌드하는 로직이 `dispatchResumeTurn` 본문에 인라인돼 있다. 현재 복잡도는 낮아 적절하지만, `isAiConversation`, `hasResumeCheckpoint` 등 selector 필드가 늘어날수록 `dispatchResumeTurn`이 두 가지 역할(selector 빌드 + 핸들러 탐색)을 수행하게 된다.
  - 제안: 현 규모에서는 수용 가능. selector 필드가 늘어날 경우 `buildResumeTurnSelector(ctx)` 추출 고려.

- **[INFO]** `handleAiResumeTurn` JSDoc의 `buildRetryReentryState` 설명이 실제 역할과 미묘하게 다름
  - 위치: `handleAiResumeTurn` JSDoc (~line 1086~1092 기준 diff)
  - 상세: "retry 재진입과 공유하는 재구성기"라는 설명이 맞지만, "waitForAiConversation 재진입"이라는 문구가 삭제된 old 주석의 흔적을 연상시킬 수 있다. 현재 로직은 재진입 루프가 없고 단발 turn 처리이므로 주석 정확성은 현재 상태에서는 양호하다.
  - 제안: 문제 없음. 현 수준에서 INFO 기록만.

- **[WARNING]** `resumeTurnRegistry` getter 내 AI dispatch의 `selects` 클로저가 `this`를 캡처함
  - 위치: `resumeTurnRegistry` getter 내 ai_conversation 항목의 `selects: (sel) => ... && this.isCheckpointEligibleNodeType(sel.node.type)`
  - 상세: registry는 `readonly` 배열이고 lazy init으로 한 번만 생성된다. `this` 캡처는 arrow function이므로 안전하지만, 만약 `isCheckpointEligibleNodeType`이 memoize되거나 재정의된다면 registry를 재빌드하지 않아 반영되지 않는다. 테스트에서도 `handlerRegistry.getMetadata`를 spy로 모킹하는데 실제로는 `getMetadata`가 `dispatchResumeTurn`에서 호출되고 `selects`에서는 `this.isCheckpointEligibleNodeType`을 직접 호출하므로, registry 자체가 지연 초기화된 후 service가 교체되는 시나리오에서 혼동 가능성이 있다.
  - 제안: 현재 구현에서 실질적 위험은 낮으나, JSDoc에 "registry는 service 인스턴스 생성 후 한 번만 빌드되므로 `isCheckpointEligibleNodeType` 변경 시 registry를 재설정해야 한다"는 주의사항 추가 권장.

---

### 파일 3: resume-turn-dispatch.ts

- **[INFO]** `ResumeTurnContext.nodeExec` 필드의 `null` vs `undefined` 혼재 가능성
  - 위치: `readonly nodeExec: NodeExecution | null;` (line ~1426)
  - 상세: 같은 인터페이스 내 다른 optional 필드(`persistedInteractionType`, `resumeCheckpoint`, `cachedOutput`)는 `| undefined`를 사용하는데 `nodeExec`만 `| null`을 사용한다. `null`을 명시한 것은 의도적 설계(DB에서 조회 실패 구분)이나 팀 컨벤션 확인이 필요하다.
  - 제안: 파일 내 주석("중첩 frame 진입 시 미상이면 null")이 있어 의도는 명확하다. 프로젝트 컨벤션이 "미상=null, 선택=undefined"라면 적절하다. 컨벤션 문서에 명시되어 있다면 수용.

- **[INFO]** 인터페이스 JSDoc 길이
  - 위치: 파일 전체 주석 (~80줄 중 약 30줄이 파일 레벨 JSDoc)
  - 상세: 파일 레벨 주석이 배경·설계 근거를 풍부하게 담고 있어 이해에 도움이 된다. 다만 `ResumeTurnDispatch` 인터페이스 자체의 주석과 내용이 일부 중복된다.
  - 제안: 현 수준에서 수용 가능. 중복 설명은 파일 레벨 vs 인터페이스 레벨로 역할 분리가 명확하다.

---

### 파일 4: process-turn-result.ts

- **[INFO]** 두 가지 park 채널 설명이 이 파일에만 집중됨
  - 위치: 파일 레벨 JSDoc (전체)
  - 상세: return 기반 `PARK_RELEASED`와 throw 기반 `ParkReleaseSignal`의 차이가 이 34줄 파일에서 완결되게 설명된다. `park-release-signal.ts`가 별도 파일인데, 두 채널을 연결하는 설명이 한쪽에만 집중되면 `park-release-signal.ts`를 먼저 읽는 독자가 맥락을 놓칠 수 있다.
  - 제안: `park-release-signal.ts`에도 역방향 참조 한 줄("return 기반 park sentinel은 `process-turn-result.ts` 참조") 추가.

- **[INFO]** `ParkSignal` 타입 노출이 사용처에서 직접 필요한지 불명확
  - 위치: `export type ParkSignal = typeof PARK_RELEASED;`
  - 상세: `ProcessTurnResult = void | ParkSignal`로 충분하고 외부에서 `ParkSignal`을 직접 참조할 필요가 있는지 확인되지 않는다. 불필요한 export는 API surface를 넓힌다.
  - 제안: 현재 사용처 확인 후, 내부 only면 `export` 제거 고려. 단, 테스트 파일이나 다른 모듈에서 직접 임포트한다면 유지.

---

### 파일 5~7: plan/complete/*.md

- **[INFO]** 계획 문서 자체의 유지보수성 이슈는 없음
  - 상세: 세 plan 파일(exec-park-b2a-followup.md, exec-park-polish.md, spec-draft-exec-park-b2-durable.md) 모두 frontmatter 스키마가 일관되고, 항목 구조가 명확하다. 완료 메모가 구현 결과와 게이트 결과를 함께 기록해 추적성이 좋다.
  - 제안: 없음.

---

## 요약

이번 변경의 핵심은 `driveResumeAwaited`·`driveResumeFrame` 두 곳에 중복돼 있던 form/buttons/AI 분기 if-else를 `resumeTurnRegistry` ordered registry로 추출한 것이다. 중복 제거 효과가 크고(`dispatchResumeTurn` 단일 진입점으로 일원화), `ResumeTurnDispatch` 인터페이스로 extension seam이 명확하게 계약화됐으며, `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult`의 `shared/` 이관으로 공유 어휘가 정착됐다. 전반적으로 유지보수성을 향상시키는 방향의 변경이다. 지적 사항은 대부분 INFO 수준으로 — 테스트에서의 반복적 `svc` 캐스팅 패턴(리팩터링 여지 있음), `_resumeTurnRegistry` backing field 네이밍의 맥락 혼동 가능성, `selects` 클로저의 `this` 캡처에 대한 주의사항 미문서화 정도다. 실질적 버그 위험이나 기존 패턴 위반은 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
