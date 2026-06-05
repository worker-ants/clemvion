# 테스트(Testing) 리뷰 결과

## 발견사항

- **[WARNING]** 통합 테스트에서 `loadAndBuildGraph` / `waitForAiConversation` 을 직접 monkey-patch 후 `finally` 복원하는 패턴 사용
  - 위치: `execution-engine.service.spec.ts` diff +202~+249 (IE 재구성 통합 테스트)
  - 상세: `svcAny.loadAndBuildGraph = jest.fn()` / `svcAny.waitForAiConversation = jest.fn()` 를 테스트 바디에서 직접 교체하고 `finally` 블록으로 복원한다. 이 방식은 테스트가 비동기 예외로 `finally` 를 건너뛰거나 테스트 러너가 강제 중단될 경우 전역 서비스 인스턴스를 오염시킬 수 있다. `jest.spyOn` + `mockImplementation` 을 사용하면 `afterEach` 복원 훅과 결합되어 격리가 훨씬 안전해진다.
  - 제안: `jest.spyOn(svcAny, 'loadAndBuildGraph').mockResolvedValue(...)` 패턴으로 전환하고, `afterEach(() => jest.restoreAllMocks())` 를 describe 블록에 등록하거나 global `restoreMocks: true` jest 설정을 활용한다. `try/finally` 수동 복원 블록은 제거한다.

- **[WARNING]** `buildRetryReentryState` IE config 재유도 테스트에서 `cpSubject()` 가 매 호출마다 새 인스턴스를 생성하는지 불분명
  - 위치: `execution-engine.service.spec.ts` diff +88~+126, +128~+150
  - 상세: `cpSubject()` 팩토리가 테스트별로 독립된 인스턴스를 반환하는지, 공유 싱글턴을 반환하는지 diff 에서 확인되지 않는다. 두 `buildRetryReentryState` 테스트가 동일 `wf-1` workflowId 와 `node-ie` nodeId 를 공유하므로, 만약 `cpSubject()` 가 상태를 재사용한다면 첫 번째 테스트의 `createContext('exec-a2b-ie', ...)` 가 두 번째 테스트(`exec-a2b-ie2`)와 컨텍스트 맵을 공유해 격리가 깨질 수 있다.
  - 제안: `cpSubject()` 구현을 확인하고, 각 `it` 블록이 독립 컨텍스트 인스턴스를 사용함을 보장한다. 필요시 `beforeEach` 에서 초기화하거나 `describe` 블록 스코프 내 `let` 변수를 쓴다.

- **[WARNING]** `emitAiWaitingForInput` 가드 확장(`node.type === 'ai_agent' || node.type === 'information_extractor'`)에 대한 직접 단위 테스트 부재
  - 위치: `execution-engine.service.ts` diff L1822 + `handleAiMessageTurn` 가드 (diff L5308)
  - 상세: 변경된 가드 3곳 중 통합 테스트는 `driveResumeDetached`(rehydrateAndResume) 경로만 검증한다. `emitAiWaitingForInput` 내부에서 IE 노드가 체크포인트를 저장하는 경로와, `handleAiMessageTurn` 에서 IE 가 재진입하는 경로에 대한 unit/통합 테스트가 없다. 가드 오탈자·조건 반전 등의 회귀가 감지되지 않는다.
  - 제안: `emitAiWaitingForInput` 호출 시 IE 노드에 `_resumeCheckpoint` 가 저장되는지 검증하는 테스트, `handleAiMessageTurn` 에서 IE 타입 노드에 AI 메시지 턴 처리가 실행되는지 검증하는 테스트를 각각 추가한다.

- **[WARNING]** IE 재구성 통합 테스트에서 `waitForAiConversation` 가 호출된 후의 실제 `resumeState` 내용(partialResult, collectionRetryCount 등)이 검증되지 않음
  - 위치: `execution-engine.service.spec.ts` diff +224~+250
  - 상세: 통합 테스트는 `waitForAiConversation` 이 1회 호출됐는지와 `RESUME_INCOMPATIBLE_STATE` 코드 미발생만 확인한다. `buildRetryReentryState` 가 실제로 IE checkpoint 의 `partialResult: { email: 'a@b.c' }` / `collectionRetryCount: 1` 을 `resumeState` 에 복원했는지는 검증하지 않는다. 재구성 로직의 핵심 계약이 통합 레벨에서 누락된 상태다.
  - 제안: `waitForAiConversation` 의 호출 인자(`resumeState`)를 캡처하여 `partialResult` / `collectionRetryCount` / `outputSchema` 가 checkpoint 에서 올바르게 복원됐는지 `expect(resumeState).toMatchObject(...)` 로 검증한다.

- **[INFO]** `buildResumeCheckpoint` 기본값 테스트에서 `ai_agent` 노드에 IE 필드가 inert(빈 값)로 저장되는 회귀 케이스 미포함
  - 위치: `execution-engine.service.spec.ts` diff +79~+86
  - 상세: 커밋 메시지는 "ai_agent 에는 빈값 inert" 를 설계 계약으로 명시한다. 이 계약의 회귀 방지 테스트(ai_agent 타입 노드의 checkpoint 에 `partialResult: {}` / `collectionRetryCount: 0` 이 추가되더라도 ai_agent 핸들러가 이를 무시함)가 없다. 현재 테스트는 "IE 노드에서의 기본값" 만 확인한다.
  - 제안: ai_agent 타입 노드의 `buildRetryReentryState` 결과에 IE 필드 기본값이 포함되더라도 기존 ai_agent 재개 동작이 정상임을 확인하는 회귀 케이스를 추가한다.

- **[INFO]** `buildRetryReentryState` 에서 `collectionRetryCount` 의 `typeof === 'number'` 타입 가드를 사용하지만 테스트에서 비-숫자(`"2"` 문자열) 입력 케이스가 없음
  - 위치: `execution-engine.service.ts` diff L4324~L4326
  - 상세: 구현이 `typeof resumeFields.collectionRetryCount === 'number'` 가드로 비-숫자를 0으로 fallback 한다. 이 방어 코드에 대응하는 엣지 케이스 테스트(문자열 `"2"`, `null`, `NaN` 입력 시 0으로 수렴)가 없다. JSONB 에서 잘못된 타입이 역직렬화될 경우 방어 코드가 실제로 작동하는지 미검증.
  - 제안: `collectionRetryCount: "2"` / `collectionRetryCount: null` 을 checkpoint 에 넣은 단위 테스트를 추가하여 `0` 으로 기본값 처리됨을 검증한다.

- **[INFO]** `schemaVersion` 미래 버전 테스트(PR-A2a, diff 외부)가 IE 체크포인트에도 동일하게 적용되는지 확인 없음
  - 위치: `execution-engine.service.spec.ts` diff L254(기존 `RESUME_INCOMPATIBLE_STATE` 테스트 참조)
  - 상세: 미래 `schemaVersion` 으로 인한 graceful reset 테스트는 `ai_agent` 타입 노드에 한정된 것으로 보인다. IE 노드에서도 `schemaVersion: 999` checkpoint 가 동일하게 `RESUME_INCOMPATIBLE_STATE` 로 처리되는지 명시적 테스트가 없다.
  - 제안: IE 노드 + `schemaVersion: 999` → `RESUME_INCOMPATIBLE_STATE` graceful reset 케이스를 기존 future-version 테스트 패턴과 동일하게 추가한다.

---

## 요약

PR-A2b 의 핵심 단위 테스트(buildResumeCheckpoint IE 필드 2건, buildRetryReentryState IE config 재유도 2건)는 명확하게 작성됐고 검증 대상이 분명하다. 그러나 통합 테스트에서 monkey-patch 방식의 취약한 테스트 격리(WARNING), 변경된 3개 가드 중 2개(`emitAiWaitingForInput`, `handleAiMessageTurn`)에 대한 직접 검증 부재(WARNING), 통합 레벨에서 실제 복원된 `resumeState` 내용을 확인하지 않는 약한 assertion(WARNING)이 핵심 갭이다. IE 노드 경로 전체의 end-to-end 계약은 현재 unit 테스트에서만 분할 검증되며, 가드 3곳 중 1곳(`driveResumeDetached`)만 통합 테스트로 커버된다. 이 갭들은 향후 가드 조건 오탈자나 resumeState 필드 누락을 회귀로 감지하지 못하는 위험을 남긴다.

## 위험도

MEDIUM
