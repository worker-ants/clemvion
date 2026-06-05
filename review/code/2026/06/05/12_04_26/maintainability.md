# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] 중복된 노드 타입 가드 — 상수 추출 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L1825, L5056, L5313
- 상세: `node.type === 'ai_agent' || node.type === 'information_extractor'` 패턴이 세 곳(`driveResumeDetached`, `emitAiWaitingForInput`, `handleAiMessageTurn`)에 동일하게 반복된다. 향후 세 번째 resumable 핸들러 타입이 추가될 때 세 곳을 모두 찾아 수정해야 하며, 한 곳이라도 누락되면 조용한 회귀가 발생한다. `isResumableNodeHandler` 유틸이 이미 존재하는데(L82 import) 이를 활용하거나 별도 `CHECKPOINT_ELIGIBLE_NODE_TYPES` 상수 집합으로 중복을 단일화할 수 있다.
- 제안: 파일 상단 상수 영역에 `const CHECKPOINT_ELIGIBLE_NODE_TYPES = new Set(['ai_agent', 'information_extractor'] as const)` 또는 타입 가드 함수 `isCheckpointEligible(type: string): boolean`을 추출하고 세 곳을 통일한다.

### [WARNING] `maxCollectionRetries` 매직 넘버 3
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4239
- 상세: `(resolvedConfig.maxCollectionRetries as number | undefined) ?? 3` 에서 기본값 `3`이 하드코딩되어 있다. `CHECKPOINT_SCHEMA_VERSION = 1` 이 상수로 선언된 패턴과 불일치한다. IE 핸들러가 정의하는 기본 재시도 횟수와 이 기본값이 동일한지 확인하고 동기화할 수단이 없다.
- 제안: `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3` 상수를 파일 상단 또는 IE 핸들러 공유 위치에 선언하고 참조한다.

### [INFO] `buildResumeCheckpoint` allow-list 와 `buildRetryReentryState` 기본값 로직 비대칭 — 장기 유지보수 위험
- 위치: `execution-engine.service.ts` L4302–L4339 (`buildResumeCheckpoint`), L4228–L4246 (`buildRetryReentryState` 내 IE 블록)
- 상세: `buildResumeCheckpoint`에서 `partialResult`/`collectionRetryCount`를 allow-list에 추가하고, `buildRetryReentryState`에서 동일 필드를 복원한다. 두 함수가 서로 대칭을 유지해야 한다는 계약이 주석으로만 표현되어 있다("allow-list invariant — 아래 필드는 credential 을 담지 않는다"). 미래에 IE 필드가 늘어날 경우 한쪽만 수정되는 실수가 발생하기 쉽다.
- 제안: 두 함수 중 한 곳에 `// SYNC: buildRetryReentryState 와 allow-list 쌍 유지 필수` 주석을 추가하거나, 더 근본적으로는 checkpoint 필드 목록을 단일 타입/인터페이스로 선언해 두 함수 모두 해당 타입을 통해 필드를 참조하도록 구조화한다.

### [INFO] 통합 테스트의 private 메서드 접근 패턴 — 타입 단언 중첩
- 위치: `execution-engine.service.spec.ts` L202–L248 (IE 재구성 통합 테스트)
- 상세: `service as unknown as { loadAndBuildGraph: jest.Mock; waitForAiConversation: jest.Mock }` 패턴으로 private 메서드를 Mock 교체한다. `origLoad`/`origWait`를 저장해 finally 블록에서 복원하는 수동 teardown이 필요하다. 이 패턴은 이미 기존 테스트에서도 사용되어 일관성은 있으나, `jest.spyOn`을 사용하면 자동 복원 및 더 나은 가독성을 얻을 수 있다. 현재 코드베이스 패턴을 따른 것이므로 INFO 수준.
- 제안: `jest.spyOn(service as any, 'loadAndBuildGraph').mockResolvedValue(...)` 패턴 전환을 향후 리팩터링 시 검토한다.

### [INFO] 테스트 헬퍼 `cpSubject()` 재호출 — 동일 픽스처 반복 생성
- 위치: `execution-engine.service.spec.ts` L89–L90, L94 (IE 체크포인트 테스트 블록)
- 상세: `cpSubject()`가 `buildRetryReentryState` 테스트 두 곳에서 각각 한 번씩 호출되어 context를 생성하고, 다시 `cpSubject()`를 호출해 `buildRetryReentryState`를 실행한다. 두 번째 호출이 첫 번째와 다른 인스턴스를 반환하면 context가 일치하지 않을 수 있다. 기존 `ai_agent` 테스트 패턴과 일치하므로 회귀 위험은 낮으나, `const subject = cpSubject()` 로컬 변수로 참조를 고정하는 편이 더 명확하다.
- 제안: 테스트 내에서 `const cp = cpSubject()` 로 한 번만 호출하고 재사용한다.

---

## 요약

이번 변경은 아키텍처적으로 작고 집중된 확장이며, `buildResumeCheckpoint`/`buildRetryReentryState`/가드 3곳을 IE까지 넓히는 설계적 의도가 코드와 주석 모두에 잘 표현되어 있다. 가장 큰 유지보수 위험은 `node.type === 'ai_agent' || node.type === 'information_extractor'` 조건이 세 곳에 문자열 리터럴로 중복된 것으로, 세 번째 resumable 핸들러 타입 추가 시 누락 위험이 있다. `maxCollectionRetries` 기본값 `3`의 매직 넘버화도 기존 상수 선언 패턴과 불일치한다. 나머지 발견사항은 기존 코드베이스 패턴을 따른 것이거나 미래 대비 개선 제안 수준이다.

## 위험도

LOW
