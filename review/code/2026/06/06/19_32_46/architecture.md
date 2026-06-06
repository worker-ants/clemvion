# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] `ProcessTurnResult` / `PARK_RELEASED` 를 `shared/execution-resume/` 로 이관 — 올바른 모듈 경계 수립
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts` (신규)
- 상세: `ExecutionEngineService` 내 파일-로컬 `const PARK_RELEASED` + `type ProcessTurnResult` 를 `shared/` 레이어로 분리함으로써, top-level(`driveResumeAwaited`)·중첩(`driveResumeFrame`)·향후 추가될 처리기 모두가 동일 sentinel 타입을 참조할 수 있게 됐다. 두 park 전파 채널(return-기반 vs throw-기반 `ParkReleaseSignal`)의 구분을 JSDoc 으로 명시한 점도 후속 기여자가 혼동하지 않도록 돕는다.
- 제안: 현재 구조 유지. 추가 개선 여지가 있다면 `park-release-signal.ts` 의 throw 기반 sentinel 과 한 파일에 함께 두어 "두 채널 모두 보여주는 단일 진입점" 으로 묶는 것도 고려 가능하나 현재 수준도 명확하다.

### [INFO] `ResumeTurnDispatch` registry 패턴 — 개방-폐쇄(OCP) 충족
- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` + `execution-engine.service.ts` `resumeTurnRegistry` getter
- 상세: 기존 두 곳(`driveResumeAwaited` / `driveResumeFrame`)에 하드코딩돼 있던 form/buttons/AI 3분기 if-else 를 `ResumeTurnDispatch[]` ordered registry 로 추출했다. 새 blocking 노드 타입 추가 시 registry 에 항목 1개 삽입만으로 top-level·중첩 양쪽에 자동 반영되므로, 정책 변경(새 타입 추가)이 기존 핸들러 코드를 건드리지 않는다. 선택 우선순위가 배열 순서로 표현돼 있어 의도가 명시적이다.
- 제안: 현재 구조 유지.

### [WARNING] registry 항목이 `ExecutionEngineService` 인스턴스에 service-bound — 인터페이스 분리 한계
- 위치: `execution-engine.service.ts` `resumeTurnRegistry` getter, 특히 ai_conversation 항목의 `selects` 클로저 (`this.isCheckpointEligibleNodeType` 캡처)
- 상세: `ResumeTurnDispatch` 인터페이스는 `resume-turn-dispatch.ts` 에 순수 데이터 계약으로 정의돼 있으나, registry 의 실제 구현체는 `this.*` 메서드를 closure 로 캡처하는 lambda 객체로 구성된다. 이는 인터페이스가 외부에서 독립 구성될 수 없음을 의미하며, `isCheckpointEligibleNodeType` 판정 로직이 인터페이스 계약 밖에 묵시적으로 걸려 있다.
  - 이는 주석(`ai-review W6`)에 "service-bound 가 전제, 외부 독립 구성 계약 아님"으로 명시돼 있어 의도적 결정임이 기록돼 있다.
  - 미래에 registry 항목을 외부 모듈(예: 별도 NodeType 플러그인)이 등록해야 할 경우, `isCheckpointEligibleNodeType` 의존이 결합 부채로 전환될 수 있다.
- 제안: 현재 규모에서는 수용 가능. 향후 플러그인 형태로 registry 외부 확장이 필요해지면, `selects` 판정에 필요한 부가 서비스(예: `HandlerRegistry`)를 `ResumeTurnDispatch` 팩토리 함수에 주입하는 팩토리 패턴으로 전환하는 것을 검토한다.

### [WARNING] `_resumeTurnRegistry` 지연 초기화 + 테스트 리셋 필요 — 캐싱 상태 누수 가능성
- 위치: `execution-engine.service.ts` L977-979 (`_resumeTurnRegistry?: readonly ResumeTurnDispatch[]`) / 테스트 `afterEach` 리셋 (`_resumeTurnRegistry = undefined`)
- 상세: registry 가 getter 에서 `??=` 로 지연 초기화되는 `readonly` 배열로 캐싱된다. `jest.restoreAllMocks()` 는 spy 만 복원하고 이 캐시를 건드리지 않으므로, 테스트 코드(`afterEach`)에서 명시 리셋이 강제된다. 이 패턴은 테스트 격리가 캐시 상태에 의존한다는 인지 부담을 남긴다.
  - 프로덕션에선 NestJS DI 컨테이너가 서비스를 singleton 으로 유지하므로 실질적 문제는 없다.
  - 그러나 테스트 코드가 private 멤버(`_resumeTurnRegistry`)를 직접 조작해야 하는 구조는 캡슐화 위반이다.
- 제안: registry 를 지연 초기화 캐시 대신 `onModuleInit` 훅에서 한 번 빌드해 `private readonly resumeTurnRegistry` 에 할당하면, 테스트 afterEach 리셋이 불필요해지고 private 멤버 노출도 없어진다.

### [INFO] `handleAiResumeTurn` 추출 — 단일 책임(SRP) 향상
- 위치: `execution-engine.service.ts` `handleAiResumeTurn` (L1066)
- 상세: 기존 `driveResumeAwaited` 내 인라인으로 70+ 라인에 걸쳐 있던 AI checkpoint 재구성 + seed + processAiResumeTurn 호출 로직을 전용 private 메서드로 분리했다. `dispatchResumeTurn` 이 라우팅 판정만 담당하고 각 핸들러가 실제 처리를 담당하는 구조로 응집도가 높아졌다.
- 제안: 현재 구조 유지.

### [INFO] 테스트 `as unknown as DispatchSubject` 캐스팅 패턴 — private API 테스트의 아키텍처 트레이드오프
- 위치: `execution-engine.service.spec.ts` `dispatchResumeTurn — resume dispatch registry` describe 블록
- 상세: private 메서드(`dispatchResumeTurn`, `handleAiResumeTurn`, `buildRetryReentryState`)를 `as unknown as DispatchSubject` 패턴으로 직접 spy/호출하는 방식은 TypeScript 타입 안전망을 우회한다. 이 패턴이 기존 test 파일 전반에 걸쳐 이미 확립된 관행이며, 단위 테스트가 공개 API 경유보다 더 세밀한 라우팅 검증을 제공한다는 실용적 이점이 있다.
  - 다만 `dispatchResumeTurn` 은 `resumeTurnRegistry` 를 통해 실제 처리기로 라우팅하는 "진입점"이므로, 처리기(form/buttons/ai)를 mock 으로 교체하면 **라우팅 결정**만 테스트하게 된다. `handleAiResumeTurn` 내부 로직을 별도 it 블록에서 직접 검증하는 방식(L232~)이 이 간극을 보완하고 있어 설계 의도가 적절히 반영돼 있다.
- 제안: 현재 구조 수용. 다만 `DispatchSubject` 타입 선언을 describe 블록 로컬이 아닌 파일 상단 공유 타입(`CheckpointSubject` 패턴과 동일)으로 승격하면 향후 재사용성이 높아진다.

### [INFO] `ResumeTurnContext` 에 `persistedInteractionType` 이중 역할 — 경미한 인터페이스 응집도 문제
- 위치: `resume-turn-dispatch.ts` `ResumeTurnContext` 인터페이스
- 상세: `persistedInteractionType` 이 `ResumeTurnSelector` 빌드 시와 AI 분기 처리기(`handleAiResumeTurn`) 내부 로깅 양쪽에 재사용된다. `ResumeTurnSelector` 가 이미 `blockingInteraction` · `isAiConversation` · `hasResumeCheckpoint` 를 분리해 선택 판정에 쓰는 만큼, context 에서 `persistedInteractionType` 의 역할은 현재 라우팅 판정보다 로깅/에러 메시지 보조에 더 가깝다. 구조적으로 문제는 없으나, 향후 context 인터페이스 확장 시 의미 명확화가 필요할 수 있다.
- 제안: 현재 수준에서는 수용 가능. 필요 시 context 에 `forLogging`/`forSelector` 구분 주석 추가로 충분.

---

## 요약

이번 변경의 핵심은 두 곳(`driveResumeAwaited` / `driveResumeFrame`)에 중복 하드코딩돼 있던 form/buttons/AI resume 분기를 `ResumeTurnDispatch` ordered registry 로 추출하고, `PARK_RELEASED` / `ProcessTurnResult` sentinel 을 `shared/execution-resume/` 레이어로 이관한 것이다. DRY 해소(OCP), 레이어 책임 분리(공유 어휘의 `shared/` 이동), 모듈 경계 명확화(`resume-turn-dispatch.ts` 인터페이스 파일 신설) 모두 아키텍처 방향이 올바르다. `WARNING` 으로 기록한 두 가지(registry 의 service-bound closure 결합, 지연 초기화 캐시의 테스트 리셋 의존)는 현재 규모에서 허용 수준이나, `onModuleInit` 초기화 전환으로 테스트 캡슐화 문제를 제거하는 개선을 권장한다.

## 위험도

LOW
