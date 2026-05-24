# 문서화(Documentation) 리뷰 결과

리뷰 대상: workflow-resumable-execution Phase 2 cont — BullMQ 기반 Durable Continuation 전환
검토일: 2026-05-25

---

## 발견사항

### [INFO] continuation-bus.service.spec.ts — 파일 상단 블록 주석이 Phase 전환 맥락을 충분히 설명
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` 라인 43-51
- 상세: 변경된 spec 파일 상단의 블록 주석이 "Phase 2 부터 BullMQ 큐로 교체됨 + 이전 Redis pub/sub 스펙과의 차이"를 명확히 기술한다. commit 참조(`commit 33521233 이전`)를 명시해 변경 이력 맥락도 제공한다. 테스트 의도 설명으로 적절한 수준이다.
- 제안: 없음 (현재 충분).

### [INFO] continuation-bus.service.spec.ts — `fakeRedisInstances` / `createFakeRedis` 의 인라인 주석이 간결하지만 lazy-init 맥락 설명에 충분
- 위치: 라인 123-126
- 상세: `// ioredis lock client 의 in-memory stub. ContinuationBusService 가 lazy 로 new Redis(...) 를 직접 호출하므로 module-level mock 으로 대체.` 주석이 stub 설계 이유를 정확히 설명한다.
- 제안: 없음.

### [WARNING] continuation-execution.processor.ts — `await` 제거 (`applyCancellation`) 에 대한 인라인 주석은 있으나 비동기 위험 설명이 불충분
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` 라인 588-589
- 상세: `// applyCancellation 은 sync (rejectPending 만 호출) — await 불필요.` 라는 주석이 추가됐다. 그러나 `applyCancellation` 이 현재는 sync 이지만 향후 비동기 로직이 추가될 때 실수로 `await` 없이 남길 위험이 있다. "sync 설계 의도가 고정이라면" 또는 "향후 async 전환 시 반드시 await 복구 필요" 중 하나를 명확히 해야 한다.
- 제안: 주석을 `// applyCancellation 은 의도적으로 sync (rejectPending 동기 호출만). 향후 async 로직 추가 시 await 복구 필수.` 로 보강.

### [WARNING] execution-engine.service.ts — `ContinuationPublishResult` 인터페이스의 JSDoc이 `queued: false + jobId: null` 케이스에서 caller 처리 지침이 불명확
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 1306-1317
- 상세: JSDoc 에 "caller 는 throw 또는 `success: false` ack 로 변환"이라고 기술되어 있으나, 실제 WS gateway 구현체는 `result.jobId === null` 조건으로 분기한다. `queued: false` 와 `jobId === null` 이 항상 동시에 성립하는지 — 즉 `queued: false && jobId !== null` 케이스가 존재하는지 — 가 JSDoc 만으로는 불명확하다. 이 두 필드의 성립 관계가 계약으로 보장되는지 명시가 필요하다.
- 제안: JSDoc 에 `queued: false` 일 때 `jobId` 는 반드시 `null` 임을 불변 조건으로 명시. 예: `@invariant queued === false 이면 jobId === null 이 항상 성립`.

### [WARNING] execution-engine.service.ts — `rehydrateContext()` JSDoc 의 "채워지지 않는 항목" 섹션이 `conversationThread` 를 언급하지만 실제 제한 이유가 스펙 참조 없이 기술됨
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `rehydrateContext` JSDoc 내 "채워지지 않는 항목" 섹션
- 상세: `_resumeState` 는 "WARN #6" 로 스펙 추적이 가능하나, `conversationThread` 는 "본 phase 에서는 빈 thread 로 시작 (form / button 노드는 미사용)"으로만 기술되어 있다. form/button 노드가 미사용인 이유, 향후 AI 노드 rehydration 확장 시 이 항목이 어떻게 처리되어야 하는지에 대한 참조가 없다.
- 제안: `conversationThread` 항목에 "AI 노드 rehydration 은 `RESUME_INCOMPATIBLE_STATE` 로 사전 거부 (spec §7.5, WARN #6) 이므로 본 phase 범위 밖" 한 줄 추가.

### [WARNING] execution-engine.service.ts — `resumeFromCheckpoint()` JSDoc 의 `setImmediate` resolver fire 설명이 실제 polling 구현과 표현 차이
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resumeFromCheckpoint` JSDoc
- 상세: JSDoc 에 "setImmediate 로 pendingContinuations 의 resolver 에 payload 를 즉시 fire"라고 기술하나, 실제 구현은 `firePayload(attemptsLeft)` 라는 polling 함수를 사용한다 (diff 라인 1694-1695 에서 truncated). 단순 "setImmediate 즉시 fire"가 아닌 "최대 N회 polling with setImmediate"일 가능성이 높다. JSDoc 과 구현의 표현 불일치는 향후 혼란을 야기한다.
- 제안: JSDoc 의 setImmediate 설명을 실제 polling 횟수/조건을 반영하도록 수정. 예: `setImmediate polling (최대 attemptsLeft 회) 로 waitForX 가 등록한 직후 resolver 를 fire`.

### [WARNING] websocket.gateway.ts — 4개 핸들러의 `result.jobId === null` 분기에 인라인 주석이 있으나 `result.queued` 의 의미론에 대한 설명 미흡
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` 라인 1813-1838 (및 동일 패턴 반복 3곳)
- 상세: `queued: result.queued` 를 ack payload 에 동봉하는데, `queued: true` 와 `resumed: true` 가 동시에 성립하는 케이스의 의미론이 코드 레벨에서 설명되지 않는다. consistency-check 결과(I17)도 동일 지적을 했으나 코드 주석으로는 미보강 상태다.
- 제안: 각 핸들러의 성공 분기에 `// resumed: true = WS layer 에서 publish 완료. queued: true = BullMQ enqueue 성공. 두 필드는 항상 동시에 true (정상 경로).` 한 줄 주석 추가.

### [INFO] execution-engine.service.spec.ts — `getPendings` 헬퍼 함수 위치가 `describe` 블록 상단으로 이동하여 가독성 개선
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 629-642
- 상세: W8 코멘트와 함께 헬퍼를 추출하고 단일 수정점 보장 의도를 주석으로 명시한 점은 문서화 관점에서 양호하다. 헬퍼의 목적과 이전 패턴 대비 개선 이유가 잘 설명되어 있다.
- 제안: 없음.

### [INFO] execution-engine.service.spec.ts — Phase 2.7 rehydration 통합 시나리오 테스트의 step 번호 주석이 로직 흐름 이해에 기여
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 955-1093
- 상세: `// 1. 정상 시작 → ...`, `// 2. NodeExecution outputData 캡처`, `// 3. 인스턴스 재시작 시뮬레이션`, `// 4. DB 응답 mock 갱신`, `// 5. BullMQ Worker pickup 시뮬레이션`, `// 6. 검증` 으로 6단계 flow 를 번호로 구분하여 복잡한 시나리오의 이해를 크게 돕는다.
- 제안: 없음. 이 패턴을 다른 복잡한 통합 테스트에도 적용할 것을 권장.

### [WARNING] execution-engine.service.spec.ts — Rehydration 테스트 describe 블록의 `RehydrationSubject` 타입 정의가 내부에만 존재하며 JSDoc 미비
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 1106-1114
- 상세: `type RehydrationSubject`와 `const subject = () => ...` 패턴이 `private` 메서드를 테스트하기 위한 타입 단언임을 설명하는 주석이 없다. 처음 보는 개발자는 이 패턴의 의도를 파악하기 어렵다.
- 제안: `// private rehydrateAndResume 를 직접 호출하기 위한 타입 단언 헬퍼. 단위 테스트에서 slow-path 분기만 격리 검증.` 한 줄 주석 추가.

### [INFO] plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md — 신규 plan 문서가 spec 변경 제안을 명확한 구조로 기술
- 위치: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`
- 상세: "현재 상태 → 실제 코드 상태 → 제안" 구조로 spec 변경 이유와 근거를 체계적으로 기술한다. `task-queue` 제거 이유, `INVALID_EXECUTION_STATE` spec 등재 필요성, 후행 implementation 후속 작업 분리 권고까지 의사결정 트레일이 잘 보존되어 있다.
- 제안: 없음. 프로젝트 규약에 맞게 잘 작성됨.

### [INFO] plan/in-progress/workflow-resumable-execution.md — 완료 항목에 commit 해시와 커밋 메시지를 명시하여 추적성 확보
- 위치: `plan/in-progress/workflow-resumable-execution.md` 라인 2136-2138
- 상세: `commit 1280ed76`, `commit b6f9e8fe`, `commit a05dfe07` 처럼 commit 해시를 명시하고 완료된 phase 항목의 구현 내용을 요약한 것은 변경 이력 추적에 매우 유용하다.
- 제안: 없음.

### [WARNING] RehydrationError 클래스 — JSDoc 의 세 에러 코드 설명이 `rehydrateAndResume` JSDoc 과 일부 중복되어 단일 진실 원칙 위반
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 1320-1342
- 상세: `RehydrationError` 클래스 JSDoc 에서 세 에러 코드(`RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `RESUME_FAILED`)의 의미를 설명하고, `rehydrateAndResume` 메서드 JSDoc 에서도 동일한 내용을 반복한다. 두 곳 중 한 곳이 변경될 때 다른 곳이 stale 해질 위험이 있다.
- 제안: `RehydrationError` 클래스 JSDoc 에 에러 코드 정의를 집중하고, `rehydrateAndResume` JSDoc 에서는 `@throws {RehydrationError}` 참조로 대체. 또는 반대 방향으로 통일.

### [CRITICAL] websocket.gateway.ts — WS 이벤트 ack payload 스키마 변경(`queued`, `resumed`, `executionId` 필드 추가)에 대한 API 문서/spec 업데이트가 완료 전 상태
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` 4개 핸들러 + `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`
- 상세: `handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 의 ack payload 가 변경됐다. `spec/5-system/6-websocket-protocol.md §4.2` 는 이 ack 스키마의 SoT(단일 진실)인데, plan 문서(파일 8)에서 spec 변경이 "project-planner 위임 필요"로 미완료 상태임을 명시한다. consistency-check I17 (`queued: true + resumed: true 동시 성립 케이스 의미론 명확 서술 필요`)도 spec 미반영 상태. 클라이언트 개발자가 변경된 ack 스키마를 알 수 있는 공식 문서가 없다.
- 제안: Phase 2.5 완료 전 또는 직후 `spec/5-system/6-websocket-protocol.md §4.2` 의 이벤트 ack 스키마 표를 갱신. 최소한 `queued` 필드와 `jobId === null` 분기(`success: false + error: 'Continuation enqueue failed'`) 를 표에 추가. project-planner 위임을 spec-update plan 의 우선 항목으로 승격.

### [INFO] continuation-execution.processor.ts — 코드 포맷팅 변경(long line 분리)에 대한 문서화 영향 없음
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` 라인 567-590
- 상세: 기능 변경 없이 80자 초과 라인을 분리한 포맷팅 변경과 `applyCancellation` 의 `await` 제거만 포함. 기존 주석들은 변경된 코드와 일치 상태 유지.
- 제안: 없음.

---

## 요약

이번 변경은 Redis pub/sub 기반 Continuation Bus 를 BullMQ 큐로 교체한 대규모 아키텍처 전환(Phase 2)의 후속 작업이다. 문서화 품질은 전반적으로 양호하다. 테스트 파일의 단계별 번호 주석, plan 문서의 commit 해시 추적, spec-update plan 의 체계적 근거 기술, `RehydrationError` / `ContinuationPublishResult` 의 JSDoc 작성 노력은 긍정적이다. 그러나 두 가지 주요 미비점이 있다. 첫째, WS ack payload 스키마 변경(`queued`, `resumed`, `executionId` 신규 필드)이 `spec/5-system/6-websocket-protocol.md §4.2` 에 반영되지 않아 클라이언트 개발자가 참조할 공식 문서가 없다 — 이 항목은 CRITICAL 로 분류한다. 둘째, `ContinuationPublishResult` 의 `queued/jobId` 불변 조건, `resumeFromCheckpoint` 의 polling 실제 동작, `applyCancellation` 의 비동기 미사용 의도 등 미세한 계약 기술이 불완전하여 향후 유지보수 시 혼란을 야기할 수 있다.

---

## 위험도

MEDIUM
