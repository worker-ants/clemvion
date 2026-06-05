# 부작용(Side Effect) 리뷰 결과

리뷰 대상: PR-A2b — information_extractor 멀티턴 checkpoint 재개 확장
커밋: b6dda4d9ac6707815e1ed3bf61e97d5a7354124c

---

## 발견사항

### [INFO] `buildRetryReentryState` 반환 객체에 IE 전용 필드 추가 — ai_agent 호출 경로에 inert 전파

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4231–L4246
- 상세: `resumeState` 객체에 `outputSchema`, `examples`, `instructions`, `maxCollectionRetries`, `partialResult`, `collectionRetryCount` 6개 필드가 새로 추가된다. 이 함수는 `ai_agent` 재진입 경로에서도 호출되므로, ai_agent 의 `resumeState` 에 IE 전용 필드가 함께 포함된다. 코드 주석과 커밋 메시지는 "ai_agent 핸들러가 읽지 않으며 inert" 임을 명시하고 있다. 실제로 ai_agent 핸들러가 이 필드들을 소비하지 않는다면 런타임 동작에는 영향이 없다. 다만 `resumeState` 의 shape 이 넓어졌으므로, (1) 이 객체가 DB 에 `_resumeCheckpoint` 로 저장되는 경로(`buildResumeCheckpoint` allow-list)에서 ai_agent checkpoint row 크기가 기본값(빈 객체/0)만큼 미세하게 증가하고, (2) 타입 추론 또는 로깅에서 예상치 못한 필드가 노출될 수 있다.
- 제안: 현재 구조에서 ai_agent 에 대한 실제 부작용은 없다. 다만 `buildResumeCheckpoint` allow-list 가 새 필드를 명시적으로 포함하는지 확인하여 ai_agent checkpoint 에 빈 IE 필드가 의도적으로 포함되는 것인지 문서화하는 것이 권장된다.

---

### [INFO] `buildResumeCheckpoint` allow-list 확장 — DB `_resumeCheckpoint` JSONB 컬럼 크기 변화

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4328–L4339 (`buildResumeCheckpoint` 내)
- 상세: `partialResult`와 `collectionRetryCount` 2개 필드가 checkpoint allow-list에 추가된다. 이는 DB `NodeExecution.outputData._resumeCheckpoint` JSONB 값의 shape 변화다. ai_agent 노드의 경우 `partialResult: {}`, `collectionRetryCount: 0` 기본값이 항상 저장된다. IE 노드의 경우 수집된 부분 결과가 영속된다. 기존 ai_agent checkpoint row (배포 이전)에는 이 필드가 없으므로, `buildRetryReentryState` 에서 `resumeFields.partialResult ?? {}` 와 `resumeFields.collectionRetryCount ?? 0` 기본값 처리가 올바르게 적용된다 — 기존 row와의 하위 호환성은 유지된다. 파일시스템 부작용은 없으며 DB 쓰기 경로는 기존 `emitAiWaitingForInput` / `handleAiMessageTurn` 의 분기와 동일하다.
- 제안: 추가 조치 불필요. 기존 ai_agent 재개 경로에 회귀 없음.

---

### [INFO] 가드 3곳의 `node.type === 'ai_agent'` → `||` 확장 — information_extractor에 신규 코드 경로 개방

- 위치:
  - `execution-engine.service.ts` L1822: `driveResumeDetached` (rehydrateAndResume 내)
  - `execution-engine.service.ts` L5056: `emitAiWaitingForInput` 내 checkpoint 저장
  - `execution-engine.service.ts` L5308 부근: `handleAiMessageTurn` 내 checkpoint 저장
- 상세: IE 노드가 `_resumeCheckpoint`가 있는 `WAITING_FOR_INPUT` 상태일 때, 이전에는 `RESUME_INCOMPATIBLE_STATE` graceful 종료로 처리되었다. 변경 후에는 `buildRetryReentryState` → `waitForAiConversation` 재진입 경로로 진입한다. IE 핸들러(`processMultiTurnMessage` / `endMultiTurnConversation`)가 이미 존재한다는 전제 하에 구조적으로 안전하다. 그러나 가드 확장은 "이전에 차단되던 경로"를 여는 것이므로, IE 핸들러가 `waitForAiConversation` 루프 내에서 예상치 못한 상태를 만날 경우의 오류 경로가 새로 노출된다.
- 제안: 기존 통합 테스트(`information_extractor 노드 + _resumeCheckpoint 존재 → 재구성 후 재진입`)가 happy-path를 커버하고 있다. IE 핸들러 내부에서 `partialResult` / `collectionRetryCount` 가 누락된 재개 state를 받았을 때 방어 처리가 되어 있는지 별도 확인이 권장된다.

---

### [INFO] 테스트 코드 내 private 메서드 직접 접근 패턴 — `service as unknown as {...}` 일시 오염 후 복원

- 위치: `execution-engine.service.spec.ts` L202–L248
- 상세: 통합 테스트에서 `svcAny.loadAndBuildGraph` 와 `svcAny.waitForAiConversation` 을 jest.fn()으로 교체한 뒤 `finally` 블록에서 원본 함수 참조를 복원한다. `origLoad` / `origWait` 로 백업 후 복원하는 패턴이므로 테스트 간 상태 오염 위험은 낮다. 단, `origLoad = svcAny.loadAndBuildGraph` 는 이 시점의 함수 참조를 캡처하는데, 다른 테스트가 이미 이 값을 교체한 상태라면 복원값이 원래 구현이 아닐 수 있다. 현재 테스트 구조상 이 패턴은 이 파일 내 다른 테스트에서도 유사하게 사용되는 기존 관행이다.
- 제안: 테스트 독립성 보장을 위해 `beforeEach`/`afterEach` 훅에서 mock 복원을 관리하는 방식으로 리팩터링하는 것을 장기적으로 권장하나, 이번 변경 자체의 부작용은 없다.

---

## 요약

이번 변경(PR-A2b)은 `information_extractor` 노드를 기존 `ai_agent` 전용 멀티턴 checkpoint 재개 경로에 추가하는 것으로, 부작용 관점에서 전반적으로 안전하게 설계되어 있다. 새로 추가된 IE 전용 필드(`partialResult`, `collectionRetryCount`, `outputSchema` 등)는 `buildRetryReentryState` 반환 객체의 shape을 넓히지만, ai_agent 핸들러가 이 필드를 소비하지 않으므로 기존 ai_agent 재개 경로에 회귀 없음이 확인된다. DB checkpoint JSONB에 기본값 필드가 추가 저장되는 것은 의도된 동작이며 기존 row와의 하위 호환성도 유지된다. 가드 3곳의 `||` 확장은 IE 노드에 새 코드 경로를 개방하지만, IE 핸들러가 이미 멀티턴 처리를 지원하고 있고 통합 테스트가 happy-path를 커버하고 있어 위험도가 낮다. 전역 변수 도입, 환경 변수 읽기/쓰기, 네트워크 호출 추가, 이벤트 발생 경로 변경, 공개 API 시그니처 변경은 이번 diff에서 발생하지 않았다.

## 위험도

LOW
