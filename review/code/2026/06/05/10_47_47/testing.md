# Testing Review — PR-A2a (_resumeCheckpoint schemaVersion + 재구성 견고화)

## 발견사항

### [INFO] buildResumeCheckpoint: 기존 필드 보존 테스트 부분 커버
- 위치: spec.ts L87–97 (`stamps the current schemaVersion` 테스트)
- 상세: `messages`, `turnCount`, `model` 세 필드만 보존 여부를 검증하며, `totalInputTokens`, `totalOutputTokens`, `totalThinkingTokens`, `toolCalls` 등 서비스 실제 코드(service.ts L4274)에서 함께 stamp 하는 나머지 핵심 필드의 pass-through 여부는 미검증.
- 제안: 테스트 내 `checkpoint` 검증 대상을 `totalInputTokens`, `totalOutputTokens`, `totalThinkingTokens`, `toolCalls` 까지 확장하거나, 최소한 spread 후 extra key 없음을 확인하는 assertion 추가. 현재 기능에는 영향 없으나 향후 `buildResumeCheckpoint` 내부가 변경될 때 회귀를 잡지 못할 수 있음.

---

### [INFO] buildRetryReentryState retry 모드(non-resumeMode) 경로 미테스트
- 위치: spec.ts L103–145 (두 개의 `buildRetryReentryState` 테스트)
- 상세: 두 테스트 모두 `{ resumeMode: true }` 옵션을 명시한 resume 경로만 검증. 코드 주석 "retry 모드(full `_retryState`)에서는 no-op" 경로, 즉 `opts?.resumeMode` 가 `false`/`undefined`일 때 방어적 기본값 로직이 마찬가지로 정상 동작하는지(실제로는 retryState 에 값이 이미 있으므로 덮어쓰기 없음) 확인하는 테스트가 없음.
- 제안: `opts` 생략(retry 모드) + 완전한 `_retryState` 를 넘겼을 때 `resumeState.messages`·`turnCount` 가 원본 값을 그대로 유지하는 단순 단언을 추가하면 분기 완결.

---

### [INFO] 버전 가드 통합 테스트의 RESUME_INCOMPATIBLE_STATE 단언이 간접적
- 위치: spec.ts L157–225 (버전 가드 통합 테스트)
- 상세: `cancelSetCalls` → `codes` 파이프라인으로 `createQueryBuilder.mock.results` 를 flatMap 해 error.code 를 추출하는 방식은 QueryBuilder mock 구성 변경에 취약하며, 어느 레이어에서 `RESUME_INCOMPATIBLE_STATE` 가 실제로 던져지고 기록됐는지 명시적이지 않음. 현재 테스트 코드 자체는 동작하지만, mock 의 체인(`.set?.mock?.calls`) 이 실패해도 `codes` 가 빈 배열이 되어 `toContain` 이 실패하는 방식으로만 탐지되는 점에서 오탐 가능성이 있음.
- 제안: `RESUME_INCOMPATIBLE_STATE` 코드를 지닌 `RehydrationError` 가 던져진다는 사실을 직접 검증하는 방법을 보조로 추가하는 것이 이상적. 예: `rehydrateAndResume` 이 `RehydrationError` 를 throw 한다는 `rejects` assertion 이후 cancel 마킹을 확인하는 두 단계 구조. 현재 구조는 `rehydrateAndResume` 가 내부에서 에러를 catch 후 cancel 로 전환하기 때문에 에러가 외부로 propagate 되지 않음을 전제로 설계됐으나, 이 전제를 주석으로 명시하면 가독성 향상.

---

### [INFO] schemaVersion === CHECKPOINT_SCHEMA_VERSION(경계값 = 1) 케이스 미테스트
- 위치: spec.ts 전체 추가 블록
- 상세: 테스트는 미래 버전(`schemaVersion: 999`) 과 구버전(`schemaVersion` 부재) 만 검증. 경계값인 `schemaVersion === 1`(현재 버전과 동일) 이 정상 통과하는지 확인하는 테스트가 없음. 버전 가드 조건이 `> CHECKPOINT_SCHEMA_VERSION` 이므로 동일 버전은 통과해야 하는데, 향후 상수 값이 변경되거나 `>=` 로 로직이 바뀌었을 때 회귀를 잡을 가드가 없음.
- 제안: `schemaVersion: 1` checkpoint 를 가진 실행이 `RESUME_INCOMPATIBLE_STATE` 를 발생시키지 않고 정상 재개 경로로 진입하는(혹은 다른 이유로 실패하지 않는) 케이스를 추가.

---

### [INFO] 통합 테스트에서 `waitForAiConversation` 원본 복원 패턴의 가독성
- 위치: spec.ts L193–224 (`origWait` 보존 + `finally` 복원)
- 상세: `try/finally` 로 `svcAny.waitForAiConversation` 을 수동 복원하는 방식 대신, `jest.spyOn` + `mockImplementation` + `spy.mockRestore()` 를 `finally` 에서 호출하는 표준 Jest 패턴을 사용할 수 있음. 현재 방식은 테스트 격리 자체에는 문제없으나 의도가 불명확하고 향후 유지보수 시 혼란 유발 가능.
- 제안: `jest.spyOn(svcAny, 'waitForAiConversation').mockResolvedValue(undefined)` 패턴으로 교체.

---

### [INFO] `buildResumeCheckpoint(undefined)` 이외 falsy/non-object 입력 미테스트
- 위치: spec.ts L99–101
- 상세: `undefined` 만 검증하며, `null`, `""`, `42`, `[]` 등 다른 non-object 입력에 대한 동작이 미검증. `buildResumeCheckpoint` 의 방어 분기가 `typeof s !== 'object' || s === null` 류 체크를 한다면 경계를 명확히 할 필요가 있음.
- 제안: `null` 입력에 대해서도 `toBeUndefined()` 단언을 추가하는 것을 권고. 현실 발생 가능성이 낮으므로 low-priority.

---

## 요약

PR-A2a 에서 추가된 5개 테스트(`buildResumeCheckpoint` stamp 2개, `buildRetryReentryState` strip·방어적 기본값 2개, 버전 가드 rehydration 통합 1개)는 핵심 시나리오(schemaVersion stamp, 미래 버전 graceful reset, 구버전 방어적 기본값)를 적절히 커버하며, 테스트 격리와 beforeEach 구조도 기존 spec 관습을 따른다. 주요 갭은 (1) 경계값(`schemaVersion === 1` 정상 통과) 미검증, (2) retry 모드(non-resumeMode) 분기 미검증, (3) `buildResumeCheckpoint` 보존 필드 부분 커버 세 가지다. 통합 테스트의 RESUME_INCOMPATIBLE_STATE 단언 방식은 간접적이나 mock 구조와 일관성은 유지된다. 전체적으로 신규 로직 대비 테스트 충실도는 양호하고 회귀 가드도 존재하며, 위 INFO 항목들은 선택적 보강 권고 수준이다.

## 위험도

LOW

STATUS: SUCCESS
